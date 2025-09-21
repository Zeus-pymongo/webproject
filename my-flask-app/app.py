from flask import Flask, render_template, g, jsonify, request
import os
from dotenv import load_dotenv
import pymysql
import re
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from pymongo import MongoClient
from konlpy.tag import Okt
from collections import Counter
from wordcloud import WordCloud

load_dotenv()
app = Flask(__name__)

# --- 설정 정보 ---
MARIADB_CONFIG = { 'host': '192.168.0.221', 'port': 3306, 'user': 'jongro', 'password': 'pass123#', 'db': 'jongro', 'charset': 'utf8' }
MONGO_CONFIG = { 'host': '192.168.0.222', 'port': 27017, 'username': 'kevin', 'password': 'pass123#', 'db_name': 'jongro' }
CRAWLED_COLLECTION = 'crawled_nave_blogs'
RESTAURANTS_COLLECTION = 'RESTAURANTS_GENERAL' # 식당 정보 컬렉션 이름 추가
FONT_PATH = 'NanumGothic.ttf' # 프로젝트 폴더 내 폰트 경로

# --- DB 연결 ---
def get_mariadb_conn():
    if 'mariadb_conn' not in g:
        g.mariadb_conn = pymysql.connect(**MARIADB_CONFIG)
    return g.mariadb_conn

def get_mongodb_conn():
    if 'mongodb_conn' not in g:
        g.mongodb_conn = MongoClient(f"mongodb://{MONGO_CONFIG['username']}:{MONGO_CONFIG['password']}@{MONGO_CONFIG['host']}:{MONGO_CONFIG['port']}/")
    return g.mongodb_conn

@app.teardown_appcontext
def close_db_connections(exception):
    mariadb_conn = g.pop('mariadb_conn', None)
    if mariadb_conn is not None and mariadb_conn.open:
        mariadb_conn.close()
    mongodb_conn = g.pop('mongodb_conn', None)
    if mongodb_conn is not None:
        mongodb_conn.close()

def parse_size_scale_to_m2(text):
    if not text: return (0, 0)
    numbers = [float(s) for s in re.findall(r'\d+\.?\d*', text)]
    if '미만' in text and len(numbers) == 1: return (0, numbers[0])
    if '이상' in text and len(numbers) == 1: return (numbers[0], float('inf'))
    if len(numbers) == 2: return (numbers[0], numbers[1])
    return (0, 0)

# --- 라우트(Routes) 정의 ---
@app.route('/')
def index():
    # 지도 관련 기능이 삭제되었으므로 naver_client_id는 더 이상 필요 없습니다.
    conn = get_mariadb_conn()
    types, regions, floors = [], [], []
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        # 상권 분석 모달에서 계속 사용되는 정보는 그대로 둡니다.
        cursor.execute("SELECT TYPE_NAME FROM TYPE ORDER BY TYPE_ID")
        types = [row['TYPE_NAME'] for row in cursor.fetchall()]
        cursor.execute("SELECT REGION_ID, REGION_NAME FROM REGION ORDER BY REGION_ID")
        regions = cursor.fetchall()
        cursor.execute("SELECT DISTINCT FLOOR FROM RENT ORDER BY FLOOR ASC")
        floors = [row['FLOOR'] for row in cursor.fetchall()]
        print("✅ MariaDB에서 모달 필터 목록을 성공적으로 불러왔습니다.")
    except Exception as e:
        print(f"❌ MariaDB 목록 조회 오류: {e}")
    
    return render_template('index.html', types=types, regions=regions, floors=floors)

@app.route('/api/final_analysis', methods=['POST'])
def final_analysis():
    data = request.get_json()
    region_id, floor, pyeong, type_name = data.get('region_id'), data.get('floor'), data.get('pyeong'), data.get('type')

    if not all([region_id, floor, pyeong, type_name]):
        return jsonify({'error': '모든 값을 선택해야 합니다.'}), 400

    try:
        conn = get_mariadb_conn()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        pyeong = float(pyeong)
        
        # --- 비용 계산 로직 ---
        cursor.execute("SELECT AVG(REN_AMOUNT) as AVG_RENT FROM RENT WHERE REGION_ID = %s AND FLOOR = %s", (region_id, floor))
        rent_per_pyeong_mandanwi = float((cursor.fetchone() or {}).get('AVG_RENT', 0))
        total_rent_cost = (pyeong * rent_per_pyeong_mandanwi) 

        size_m2 = pyeong * 3.305785
        cursor.execute("SELECT SIZE_SCALE, PURCHASE_QTY FROM SCALE_PURCHASE")
        all_scales = cursor.fetchall()
        purchase_cost_mandanwi = 0
        for scale in all_scales:
            min_m2, max_m2 = parse_size_scale_to_m2(scale['SIZE_SCALE'])
            if min_m2 <= size_m2 < max_m2:
                purchase_cost_mandanwi = float(scale.get('PURCHASE_QTY', 0)); break
        total_purchase_cost = purchase_cost_mandanwi * 10000

        cursor.execute("SELECT i.INV_AMOUNT FROM INVEST i JOIN TYPE t ON i.TYPE_ID = t.TYPE_ID WHERE t.TYPE_NAME = %s", (type_name,))
        invest_cost_mandanwi = float((cursor.fetchone() or {}).get('INV_AMOUNT', 0))
        total_invest_cost = invest_cost_mandanwi * 10000
        total_cost = total_rent_cost + total_purchase_cost + total_invest_cost
        
        # --- 1. 연령대 및 성별 유동인구 차트 생성 ---
        cursor.execute("SELECT AGE, GENDER, SUM(MOV_COUNT) as total_moves FROM MOVEMENT WHERE DES_ID = %s GROUP BY AGE, GENDER ORDER BY AGE, GENDER", (region_id,))
        age_gender_data = cursor.fetchall()
        age_gender_chart_image = None
        if age_gender_data:
            data_map = {}
            for row in age_gender_data:
                age, gender, moves = str(row['AGE']), row['GENDER'], row['total_moves']
                if age not in data_map: data_map[age] = {'M': 0, 'F': 0}
                data_map[age][gender] = moves
            
            sorted_ages = sorted(data_map.keys(), key=int)
            labels = [f"{age}대" for age in sorted_ages]
            male_moves = [data_map[age]['M'] for age in sorted_ages]
            female_moves = [data_map[age]['F'] for age in sorted_ages]

            plt.rcParams['font.family'] = 'Malgun Gothic'
            plt.rcParams['axes.unicode_minus'] = False
            x = np.arange(len(labels))
            width = 0.35
            fig, ax = plt.subplots(figsize=(12, 8))
            ax.bar(x - width/2, male_moves, width, label='남성', color='#36A2EB')
            ax.bar(x + width/2, female_moves, width, label='여성', color='#FF6384')
            ax.set_ylabel('유동인구 수'); ax.set_title('연령대 및 성별 유동인구', fontsize=16)
            ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=12)
            ax.legend(); fig.tight_layout()

            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=120) 
            buf.seek(0)
            age_gender_chart_image = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close(fig)

        # --- 2. 방문 목적별 유동인구 차트 생성 ---
        cursor.execute("SELECT MOV_TYPE, SUM(MOV_COUNT) as total_moves FROM MOVEMENT WHERE DES_ID = %s GROUP BY MOV_TYPE ORDER BY MOV_TYPE", (region_id,))
        mov_typ_data = cursor.fetchall()
        mov_typ_chart_image = None
        if mov_typ_data:
            type_mapping = {'HH':'거주지↔거주지','HW':'거주지→직장','HE':'거주지→기타','WH':'직장→거주지','WW':'직장↔직장','WE':'직장→기타','EH':'기타→거주지','EW':'기타→직장','EE':'기타↔기타'}
            labels = [type_mapping.get(row['MOV_TYPE'], row['MOV_TYPE']) for row in mov_typ_data]
            sizes = [float(row['total_moves']) for row in mov_typ_data]

            fig, ax = plt.subplots(figsize=(12, 8))
            ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90, pctdistance=0.85, colors=plt.cm.Pastel1.colors)
            centre_circle = plt.Circle((0,0),0.70,fc='white')
            fig.gca().add_artist(centre_circle)
            ax.axis('equal'); ax.set_title('방문 목적별 유동인구 비율', fontsize=16); fig.tight_layout()
            
            buf = io.BytesIO(); plt.savefig(buf, format='png', dpi=120)
            buf.seek(0); mov_typ_chart_image = base64.b64encode(buf.getvalue()).decode('utf-8'); plt.close(fig)

        # --- 3. 시간대별 방문 목적 유동인구 차트 생성 ---
        cursor.execute("SELECT MOV_TIME, MOV_TYPE, SUM(MOV_COUNT) as total_moves FROM MOVEMENT WHERE DES_ID = %s GROUP BY MOV_TIME, MOV_TYPE ORDER BY MOV_TIME, MOV_TYPE", (region_id,))
        time_mov_typ_data = cursor.fetchall()
        time_mov_typ_chart_image = None
        if time_mov_typ_data:
            all_mov_types = list(type_mapping.keys())
            data_by_time = {}
            for row in time_mov_typ_data:
                time, mov_type, moves = str(row['MOV_TIME']), row['MOV_TYPE'], float(row['total_moves'])
                if time not in data_by_time: data_by_time[time] = {typ: 0 for typ in all_mov_types}
                data_by_time[time][mov_type] = moves
            
            sorted_times = sorted(data_by_time.keys(), key=int)
            chart_data = {typ: [data_by_time[time][typ] for time in sorted_times] for typ in all_mov_types}

            fig, ax = plt.subplots(figsize=(12, 8))
            bottoms = np.zeros(len(sorted_times))
            for mov_type in all_mov_types:
                ax.bar(sorted_times, chart_data[mov_type], label=type_mapping.get(mov_type, mov_type), bottom=bottoms)
                bottoms += np.array(chart_data[mov_type])
            
            ax.set_ylabel('유동인구 수'); ax.set_xlabel('시간대')
            ax.set_title('시간대별 방문 목적 유동인구', fontsize=16)
            ax.legend(title='이동 목적', bbox_to_anchor=(1.05, 1), loc='upper left'); fig.tight_layout()
            
            buf = io.BytesIO(); plt.savefig(buf, format='png', dpi=120)
            buf.seek(0); 
            time_mov_typ_chart_image = base64.b64encode(buf.getvalue()).decode('utf-8'); plt.close(fig)
        
        return jsonify({
            'costs': {
                'rent': { 'total': total_rent_cost, 'pyeong': pyeong, 'per_pyeong': rent_per_pyeong_mandanwi },
                'purchase': total_purchase_cost, 'invest': total_invest_cost, 'total': total_cost
            },
            'movement': {
                'age_gender_chart_image': age_gender_chart_image,
                'mov_typ_chart_image': mov_typ_chart_image,
                'time_mov_typ_chart_image': time_mov_typ_chart_image
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': '최종 분석 중 서버 오류가 발생했습니다.'}), 500

@app.route('/api/mongo_filters')
def get_mongo_filters():
    """트렌드 분석(워드클라우드)을 위한 필터 목록을 MongoDB에서 가져옵니다."""
    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        
        dongs = sorted(db[CRAWLED_COLLECTION].distinct('admin_dong'))
        categories = sorted(db[RESTAURANTS_COLLECTION].distinct('category'))

        return jsonify({'success': True, 'dongs': dongs, 'categories': categories})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'MongoDB 필터 목록을 가져오는 중 오류가 발생했습니다.'}), 500

# app.py

@app.route('/api/wordcloud', methods=['POST'])
def get_wordcloud():
    """★★★ 수정된 워드클라우드 API ★★★"""
    data = request.get_json()
    dong_name = data.get('dong_name')
    categories = data.get('categories')

    if not dong_name or not categories:
        return jsonify({'error': '동과 업태를 모두 선택해야 합니다.'}), 400

    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        
        # 1. 선택된 동, 업태에 해당하는 식당 이름들을 먼저 찾습니다.
        restaurant_collection = db[RESTAURANTS_COLLECTION]
        target_restaurants = restaurant_collection.find(
            {'admin_dong': dong_name, 'category': {'$in': categories}},
            {'restaurant_name': 1, '_id': 0}
        )

        # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ [오류 수정] 이 부분을 수정했습니다 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
        # r.get('restaurant_name')을 사용하여 키가 없어도 오류가 나지 않게 하고, 
        # 값이 있는 경우에만 리스트에 추가합니다.
        target_restaurant_names = [
            r.get('restaurant_name') for r in target_restaurants if r.get('restaurant_name')
        ]
        # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ [오류 수정] 여기까지 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        if not target_restaurant_names:
            return jsonify({'success': False, 'message': '해당 조건에 맞는 식당 정보가 없습니다.'})

        # 2. 찾은 식당 이름과 일치하는 블로그 포스트의 본문을 가져옵니다.
        blog_collection = db[CRAWLED_COLLECTION]
        posts = blog_collection.find(
            {'restaurant_name': {'$in': target_restaurant_names}},
            {'blog_content': 1}
        )
        all_content = " ".join([post.get('blog_content', '') for post in posts])
        
        if not all_content.strip():
            return jsonify({'success': False, 'message': '수집된 블로그 리뷰가 없습니다.'})

        # 3. KoNLPy로 명사 추출 및 워드클라우드 생성
        okt = Okt()
        nouns = okt.nouns(all_content)
        stopwords = {'곳', '것', '등', '수', '이', '그', '저', '때', '해', '맛집', '카페', '방문'}
        words = [word for word in nouns if word not in stopwords and len(word) > 1]
        word_counts = Counter(words)

        if not word_counts:
            return jsonify({'success': False, 'message': '분석할 키워드가 부족합니다.'})

        wc = WordCloud(font_path=FONT_PATH, background_color='white', width=800, height=600).generate_from_frequencies(word_counts)
        
        # 4. 이미지를 Base64로 인코딩하여 반환
        buf = io.BytesIO()
        wc.to_file(buf, format='png')
        buf.seek(0)
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return jsonify({'success': True, 'image': image_base64})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': '워드클라우드 생성 중 서버 오류가 발생했습니다.'}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)