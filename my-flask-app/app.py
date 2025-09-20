# app.py

from flask import Flask, render_template, g, jsonify, request
import os
from dotenv import load_dotenv
import pymysql
import re
# 이미지 처리를 위한 라이브러리 추가
import io
import base64
import matplotlib
matplotlib.use('Agg') # GUI 백엔드가 없는 환경에서 Matplotlib 실행을 위한 설정
import matplotlib.pyplot as plt
import numpy as np

load_dotenv()
app = Flask(__name__)

# --- 설정 정보 ---
MARIADB_CONFIG = { 'host': '192.168.0.221', 'port': 3306, 'user': 'jongro', 'password': 'pass123#', 'db': 'jongro', 'charset': 'utf8' }

# --- DB 연결 ---
def get_mariadb_conn():
    if 'mariadb_conn' not in g:
        g.mariadb_conn = pymysql.connect(**MARIADB_CONFIG)
    return g.mariadb_conn

@app.teardown_appcontext
def close_db_connections(exception):
    mariadb_conn = g.pop('mariadb_conn', None)
    if mariadb_conn is not None and mariadb_conn.open:
        mariadb_conn.close()
        
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
    naver_client_id = os.getenv('NAVER_CLIENT_ID')
    conn = get_mariadb_conn()
    types, regions, floors = [], [], []
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT TYPE_NAME FROM TYPE ORDER BY TYPE_ID")
        types = [row['TYPE_NAME'] for row in cursor.fetchall()]
        cursor.execute("SELECT REGION_ID, REGION_NAME FROM REGION ORDER BY REGION_ID")
        regions = cursor.fetchall()
        cursor.execute("SELECT DISTINCT FLOOR FROM RENT ORDER BY FLOOR ASC")
        floors = [row['FLOOR'] for row in cursor.fetchall()]
    except Exception as e:
        print(f"❌ DB 목록 조회 오류: {e}")
    
    return render_template('index.html', naver_client_id=naver_client_id, types=types, regions=regions, floors=floors)

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
        
        # --- 1. 비용 계산 로직 ---
        cursor.execute("SELECT AVG(REN_AMOUNT) as AVG_RENT FROM RENT WHERE REGION_ID = %s AND FLOOR = %s", (region_id, floor))
        rent_per_pyeong_mandanwi = float((cursor.fetchone() or {}).get('AVG_RENT', 0))
        total_rent_cost = (pyeong * rent_per_pyeong_mandanwi) * 10000

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
        
        # --- 2. 유동인구 데이터 조회 ---
        cursor.execute("SELECT GENDER, SUM(MOV_COUNT) as total_moves FROM MOVEMENT WHERE DES_ID = %s GROUP BY GENDER", (region_id,))
        by_gender = cursor.fetchall()
        print(f"📊 [로그 1] 성별 데이터 조회 결과: {by_gender}")

        # --- 3. Matplotlib으로 차트 이미지 생성 ---
        gender_chart_image = None
        if by_gender:
            print("🎨 [로그 2] 차트 이미지 생성을 시작합니다...")

            labels = ['남성' if row['GENDER'] == 'M' else '여성' for row in by_gender]
            sizes = [row['total_moves'] for row in by_gender]

            try:
                plt.rcParams['font.family'] = 'Malgun Gothic'
            except:
                plt.rcParams['font.family'] = 'AppleGothic'
            plt.rcParams['axes.unicode_minus'] = False

            fig, ax = plt.subplots(figsize=(4, 4))
            ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90, colors=['#36A2EB', '#FF6384'])
            ax.axis('equal')
            plt.title('성별 비율')

            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            
            gender_chart_image = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close(fig)
            print(f"🖼️ [로그 3] 차트 이미지 생성 완료. (데이터 길이: {len(gender_chart_image)})")

        # --- 4. 최종 데이터 반환 ---
        return jsonify({
            'costs': {
                'rent': {'total': total_rent_cost}, 'purchase': total_purchase_cost,
                'invest': total_invest_cost, 'total': total_cost
            },
            'movement': { 'gender_chart_image': gender_chart_image }
        })
        
    except Exception as e:
        print("🔥🔥🔥 [로그 5] 백엔드 에러 발생! 🔥🔥🔥")

        import traceback
        traceback.print_exc()
        return jsonify({'error': '최종 분석 중 서버 오류 발생'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)