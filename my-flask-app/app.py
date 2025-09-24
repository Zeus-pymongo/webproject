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
from soynlp.noun import LRNounExtractor_v2
from bson.objectid import ObjectId # 파일 상단에 추가해야 합니다.
import traceback
import matplotlib.font_manager as fm # <-- 이 코드가 있는지 확인

load_dotenv()
app = Flask(__name__)

# --- 설정 정보 ---
MARIADB_CONFIG = { 'host': '192.168.0.221', 'port': 3306, 'user': 'jongro', 'password': 'pass123#', 'db': 'jongro', 'charset': 'utf8' }
MONGO_CONFIG = { 'host': '192.168.0.222', 'port': 27017, 'username': 'kevin', 'password': 'pass123#', 'db_name': 'jongro' }
CRAWLED_COLLECTION = 'crawled_naver_api_blogs'
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

# app.py의 기존 final_analysis 함수를 아래 코드로 전체 교체하세요.
# app.py의 기존 final_analysis 함수를 아래 코드로 전체 교체하세요.

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
        
        # --- 폰트 설정: NanumGothic.ttf 파일을 직접 사용하도록 통일 ---
        font_prop_title = fm.FontProperties(fname=FONT_PATH, size=16)
        font_prop_label = fm.FontProperties(fname=FONT_PATH, size=12)
        font_prop_ticks = fm.FontProperties(fname=FONT_PATH, size=10)
        
        # --- 1. 연령대 및 성별 유동인구 차트 생성 ---
        cursor.execute("SELECT AGE, GENDER, SUM(MOV_COUNT) as total_moves FROM MOVEMENT WHERE DES_ID = %s GROUP BY AGE, GENDER ORDER BY AGE, GENDER", (region_id,))
        age_gender_data = cursor.fetchall()
        age_gender_chart_image = None
        if age_gender_data and any(row.get('total_moves') is not None for row in age_gender_data):
            data_map = {}
            for row in age_gender_data:
                age, gender = str(row['AGE']), row['GENDER']
                moves = float(row.get('total_moves') or 0)
                if age not in data_map: data_map[age] = {'M': 0, 'F': 0}
                data_map[age][gender] = moves
            
            sorted_ages = sorted(data_map.keys(), key=int)
            labels = [f"{age}대" for age in sorted_ages]
            male_moves = [data_map[age].get('M', 0) for age in sorted_ages]
            female_moves = [data_map[age].get('F', 0) for age in sorted_ages]

            x, width = np.arange(len(labels)), 0.35
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.bar(x - width/2, male_moves, width, label='남성', color='#36A2EB')
            ax.bar(x + width/2, female_moves, width, label='여성', color='#FF6384')
            
            ax.set_ylabel('유동인구 수', fontproperties=font_prop_label)
            ax.set_title('연령대 및 성별 유동인구', fontproperties=font_prop_title)
            ax.set_xticks(x)
            ax.set_xticklabels(labels, fontproperties=font_prop_ticks)
            ax.legend(prop=font_prop_label)
            
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            age_gender_chart_image = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close(fig)

        # --- 2. 방문 목적별 유동인구 차트 생성 ---
        cursor.execute("SELECT MOV_TYPE, SUM(MOV_COUNT) as total_moves FROM MOVEMENT WHERE DES_ID = %s GROUP BY MOV_TYPE ORDER BY MOV_TYPE", (region_id,))
        mov_typ_data = cursor.fetchall()
        mov_typ_chart_image = None
        if mov_typ_data and any(row.get('total_moves') is not None for row in mov_typ_data):
            type_mapping = {'HH':'거주지↔거주지','HW':'거주지→직장','HE':'거주지→기타','WH':'직장→거주지','WW':'직장↔직장','WE':'직장→기타','EH':'기타→거주지','EW':'기타→직장','EE':'기타'}
            labels = [type_mapping.get(row['MOV_TYPE'], row['MOV_TYPE']) for row in mov_typ_data]
            sizes = [float(row.get('total_moves') or 0) for row in mov_typ_data]

            fig, ax = plt.subplots(figsize=(10, 7))
            # ✨ [오류 수정] plt.cm.Pastel1.colors 로 실제 색상 리스트를 전달
            ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90, pctdistance=0.85, colors=plt.cm.Pastel1.colors, textprops={'fontproperties': font_prop_label})
            ax.axis('equal')
            ax.set_title('방문 목적별 유동인구 비율', fontproperties=font_prop_title, pad=20)
            
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            mov_typ_chart_image = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close(fig)

        # --- 3. 시간대별 방문 목적 유동인구 차트 생성 ---
# app.py의 final_analysis 함수 내 3번째 차트 생성 부분을 아래 코드로 교체

# --- 3. 시간대별 방문 목적 유동인구 차트 생성 (그룹화 적용) ---
        cursor.execute("SELECT MOV_TIME, MOV_COUNT, MOV_TYPE FROM MOVEMENT WHERE DES_ID = %s", (region_id,))
        time_mov_typ_data = cursor.fetchall()
        time_mov_typ_chart_image = None
        if time_mov_typ_data and any(row.get('MOV_COUNT') is not None for row in time_mov_typ_data):
            type_mapping = {'HH':'거주지↔거주지','HW':'거주지→직장','HE':'거주지→기타','WH':'직장→거주지','WW':'직장↔직장','WE':'직장→기타','EH':'기타→거주지','EW':'기타→직장'}
            all_mov_types = list(type_mapping.keys())
            
            # ✨ [수정] 시간대를 4개의 그룹으로 나누어 데이터를 담을 딕셔너리 생성
            periods = ['새벽', '아침', '점심', '저녁']
            data_by_period = {period: {typ: 0 for typ in all_mov_types} for period in periods}

            # ✨ [수정] 시간대별 데이터를 그룹에 맞게 합산
            for row in time_mov_typ_data:
                hour = int(row['MOV_TIME'])
                moves = float(row.get('MOV_COUNT') or 0)
                mov_type = row['MOV_TYPE']

                period = ''
                if 0 <= hour < 6:
                    period = '새벽'
                elif 6 <= hour < 12:
                    period = '아침'
                elif 12 <= hour < 18:
                    period = '점심'
                elif 18 <= hour < 24:
                    period = '저녁'
                
                if period and mov_type in data_by_period[period]:
                    data_by_period[period][mov_type] += moves

            # ✨ [수정] 그룹화된 데이터를 차트에 맞게 재구성
            chart_data = {typ: [data_by_period[period].get(typ, 0) for period in periods] for typ in all_mov_types}

            fig, ax = plt.subplots(figsize=(12, 6))
            bottoms = np.zeros(len(periods))

            for mov_type in all_mov_types:
                # x축을 시간대 그룹(periods)으로 하여 막대그래프 생성
                ax.bar(periods, chart_data[mov_type], label=type_mapping.get(mov_type, mov_type), bottom=bottoms)
                bottoms += np.array(chart_data[mov_type])
            
            ax.set_ylabel('유동인구 수', fontproperties=font_prop_label)
            ax.set_xlabel('시간대 그룹', fontproperties=font_prop_label)
            ax.set_title('시간대 그룹별 방문 목적 유동인구', fontproperties=font_prop_title)
            ax.tick_params(axis='x', labelsize=12) # x축 글자 크기 조정
            legend = ax.legend(prop=font_prop_label, title='이동 목적', bbox_to_anchor=(1.05, 1), loc='upper left')
            legend.get_title().set_fontproperties(font_prop_label)
            
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            time_mov_typ_chart_image = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close(fig)
        
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
        
        return jsonify({
            'costs': {
                'rent': { 'total': total_rent_cost, 'pyeong': pyeong, 'per_pyeong': rent_per_pyeong_mandanwi * 10000 },
                'purchase': total_purchase_cost, 'invest': total_invest_cost, 'total': total_cost
            },
            'movement': {
                'age_gender_chart_image': age_gender_chart_image,
                'mov_typ_chart_image': mov_typ_chart_image,
                'time_mov_typ_chart_image': time_mov_typ_chart_image
            }
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': '최종 분석 중 서버 오류가 발생했습니다.'}), 500
        
@app.route('/api/restaurant/<restaurant_id>')
def get_restaurant_api(restaurant_id):
    """맛집 상세 정보를 JSON 데이터로 반환하는 API"""
    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        
        # 1. 식당 상세 정보 조회
        restaurant_collection = db[RESTAURANTS_COLLECTION]
        obj_id = ObjectId(restaurant_id)
        restaurant = restaurant_collection.find_one({'_id': obj_id})
        
        if not restaurant:
            return jsonify({'success': False, 'error': '맛집 정보 없음'}), 404
            
        restaurant['_id'] = str(restaurant['_id']) # ObjectId를 문자열로 변환

        # 2. 관련 블로그 목록 조회
        crawled_collection = db[CRAWLED_COLLECTION]
        blogs = list(crawled_collection.find(
            {'restaurant_name': restaurant.get('name')},
            # 블로그 목록에서는 내용 제외하고 필요한 정보만 선택
            {'blog_url': 1, 'title': 1, 'post_date': 1, '_id': 0}
        ))
        
        return jsonify({'success': True, 'restaurant': restaurant, 'blogs': blogs})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'API 처리 중 오류 발생'}), 500
 
    
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



@app.route('/api/wordcloud', methods=['POST'])
def get_wordcloud():
    data = request.get_json()
    dong_name = data.get('dong_name')
    categories = data.get('categories')

    if not dong_name or not categories:
        return jsonify({'error': '동과 업태를 모두 선택해야 합니다.'}), 400

    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        
        # ▼▼▼ [수정] Top 5 맛집 정보 조회 로직 (find_one -> find) ▼▼▼
        top_restaurants = [] 
        try:
            restaurant_collection = db[RESTAURANTS_COLLECTION]
            top_docs_cursor = restaurant_collection.find(
                {'admin_dong': dong_name},
                sort=[('weighted_score', -1)],
                projection={'name': 1, 'category': 1}
            ).limit(5)
            top_restaurants = list(top_docs_cursor)
            for r in top_restaurants:
                r['_id'] = str(r['_id'])
        except Exception as e:
            print(f"⚠️ Top 5 맛집 조회 중 오류: {e}")
        # ▲▲▲ [수정] 로직 끝 ▲▲▲

        blog_collection = db[CRAWLED_COLLECTION]
        posts = blog_collection.find(
            {'admin_dong': dong_name, 'category': {'$in': categories}},
            {'blog_content': 1}
        )
        all_content = " ".join([post.get('blog_content', '') for post in posts])
        
        if not all_content.strip():
            return jsonify({
                'success': False, 
                'message': '해당 조건에 대한 블로그 리뷰가 없습니다.',
                'top_restaurants': top_restaurants # 변수명 수정
            })

        noun_extractor = LRNounExtractor_v2(verbose=False)
        noun_extractor.train(all_content.splitlines())
        nouns = noun_extractor.extract()
        stopwords = {'곳', '것', '등', '수', '이', '그', '저', '때', '해', '맛집', '카페', '방문'}
        word_counts = {noun: score.score for noun, score in nouns.items() if len(noun) > 1 and noun not in stopwords}

        if not word_counts:
            return jsonify({
                'success': False, 
                'message': '분석할 키워드가 부족합니다.',
                'top_restaurants': top_restaurants # 변수명 수정
            })

        wc = WordCloud(font_path=FONT_PATH, background_color='white', width=800, height=600).generate_from_frequencies(word_counts)
        buf = io.BytesIO()
        image = wc.to_image()
        image.save(buf, format='PNG')
        buf.seek(0)
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return jsonify({
            'success': True, 
            'image': image_base64,
            'top_restaurants': top_restaurants # 변수명 수정
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': '워드클라우드 생성 중 서버 오류가 발생했습니다.'}), 500

# app.py 에서 get_restaurants_by_dong 함수를 찾아 교체하세요.

@app.route('/api/restaurants_by_dong')
def get_restaurants_by_dong():
    """특정 동에 속한 모든 음식점 목록을 리뷰 수 순으로 반환합니다."""
    dong_name = request.args.get('dong_name')
    if not dong_name:
        return jsonify({'success': False, 'error': '동 이름이 필요합니다.'}), 400

    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        collection = db[RESTAURANTS_COLLECTION]

        # ▼▼▼ [수정] 프로젝션에서 '_id': 0 제거 ▼▼▼
        restaurants = list(collection.find(
            {'admin_dong': dong_name},
            {'name': 1, 'category': 1, 'rating': 1, 'visitor_reviews': 1}, # '_id': 0 제거
            sort=[('weighted_score', -1)]
        ))
        
        # ▼▼▼ [추가] ObjectId를 문자열로 변환하는 로직 ▼▼▼
        for r in restaurants:
            r['_id'] = str(r['_id'])
        
        return jsonify({'success': True, 'restaurants': restaurants})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': '맛집 목록 조회 중 오류가 발생했습니다.'}), 500
    

@app.route('/api/categories_by_dong')
def get_categories_by_dong():
    """특정 동에 존재하는 카테고리 목록을 반환합니다."""
    dong_name = request.args.get('dong_name')
    if not dong_name:
        return jsonify({'success': False, 'error': '동 이름이 필요합니다.'}), 400

    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        collection = db[CRAWLED_COLLECTION]

        # 해당 '동'에 있는 문서들에서 'category' 필드의 고유한 값들을 찾습니다.
        categories = collection.distinct('category', {'admin_dong': dong_name})
        
        return jsonify({'success': True, 'categories': sorted(categories)})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': '카테고리 조회 중 오류가 발생했습니다.'}), 500



@app.route('/api/charts/by_dong')
def get_dong_chart():
    """동별 식당 수 차트 이미지를 생성하여 반환하는 API"""
    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        collection = db[RESTAURANTS_COLLECTION]
        
        pipeline = [
            {'$group': {'_id': '$admin_dong', 'count': {'$sum': 1}}},
            {'$sort': {'count': 1}}  # 가로 막대그래프이므로 오름차순으로 정렬
        ]
        result = list(collection.aggregate(pipeline))
        
        if not result:
            return jsonify({'success': False, 'error': '데이터가 없습니다.'})

        labels = [item['_id'] for item in result if item['_id']]
        counts = [item['count'] for item in result if item['_id']]

        plt.rcParams['font.family'] = 'Malgun Gothic'
        plt.rcParams['axes.unicode_minus'] = False
        
        fig, ax = plt.subplots(figsize=(10, len(labels) * 0.4)) # 동 개수에 따라 높이 조절
        ax.barh(labels, counts, color='skyblue')
        ax.set_xlabel('식당 수')
        ax.set_title('동별 식당 수', fontsize=16)
        fig.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120)
        buf.seek(0)
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        plt.close(fig)

        return jsonify({'success': True, 'image': image_base64})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': '동별 차트 생성 중 오류 발생'}), 500
# app.py 파일에 추가할 코드 (기존 업태 분석 API는 삭제)

@app.route('/api/categories/top')
def get_top_categories():
    """식당 수가 많은 상위 20개 카테고리(업태) 목록을 반환하는 API"""
    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        collection = db[RESTAURANTS_COLLECTION]
        
        pipeline = [
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 30}
        ]
        result = list(collection.aggregate(pipeline))
        
        # 카테고리 이름만 추출하여 리스트로 만듭니다.
        categories = [item['_id'] for item in result if item['_id']]
        
        return jsonify({'success': True, 'categories': categories})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': '상위 카테고리 조회 중 오류 발생'}), 500

@app.route('/api/charts/keywords_by_category')
def get_keyword_pie_chart_by_category():
    """선택된 카테고리의 voted_keywords를 집계하여 파이 차트 이미지를 생성하는 API"""
    category_name = request.args.get('category_name')
    if not category_name:
        return jsonify({'success': False, 'error': '카테고리 이름이 필요합니다.'}), 400

    try:
        mongodb_conn = get_mongodb_conn()
        db = mongodb_conn[MONGO_CONFIG['db_name']]
        collection = db[RESTAURANTS_COLLECTION]

        # 해당 카테고리의 모든 식당 문서를 찾습니다.
        restaurants = list(collection.find({'category': category_name}))

        if not restaurants:
            return jsonify({'success': False, 'error': '해당 카테고리의 식당 정보가 없습니다.'})

        # 모든 식당의 voted_keywords를 하나로 합산합니다.
        keyword_counts = {}
        for r in restaurants:
            if 'voted_keywords' in r and r['voted_keywords']:
                for keyword_obj in r['voted_keywords']:
                    keyword = keyword_obj.get('keyword')
                    count = keyword_obj.get('count', 0)
                    if keyword:
                        keyword_counts[keyword] = keyword_counts.get(keyword, 0) + count
        
        if not keyword_counts:
            return jsonify({'success': False, 'message': '분석할 키워드 데이터가 없습니다.'})
        
        # 가장 많이 나온 상위 7개 키워드를 선택합니다. (파이 차트 가독성)
        sorted_keywords = sorted(keyword_counts.items(), key=lambda item: item[1], reverse=True)
        top_keywords = sorted_keywords[:7]
        
        labels = [item[0] for item in top_keywords]
        counts = [item[1] for item in top_keywords]

        # Matplotlib으로 파이 차트 생성
        plt.rcParams['font.family'] = 'Malgun Gothic'
        plt.rcParams['axes.unicode_minus'] = False
        
        fig, ax = plt.subplots(figsize=(10, 8))
        ax.pie(counts, labels=labels, autopct='%1.1f%%', startangle=90, textprops={'fontsize': 12})
        ax.axis('equal')  # 파이를 원형으로 만듭니다.
        ax.set_title(f"'{category_name}' 업태 주요 리뷰 키워드", fontsize=16, pad=20)
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120)
        buf.seek(0)
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        plt.close(fig)

        return jsonify({'success': True, 'image': image_base64})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': '키워드 파이 차트 생성 중 오류 발생'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)