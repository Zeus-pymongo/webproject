from flask import Flask, render_template, g, jsonify, request
import os
from dotenv import load_dotenv
import pymysql
from pymongo import MongoClient
import requests
import re # 정규표현식을 사용하기 위해 re 모듈을 import 합니다.

# .env 파일 로드
load_dotenv() 

app = Flask(__name__)

# --- 설정 정보 (기존과 동일) ---
MARIADB_CONFIG = {
    'host': '192.168.0.221', 
    'port': 3306, 
    'user': 'jongro', 
    'password': 'pass123#', 
    'db': 'jongro', 
    'charset': 'utf8'
}
MONGO_CONFIG = {
    'host': '192.168.0.222', 
    'port': 27017, 
    'username': 'kevin', 
    'password': 'pass123#', 
    'db_name': 'jongro'
}

# --- 데이터베이스 연결 관리 (기존과 동일) ---
def get_mariadb_conn():
    if 'mariadb_conn' not in g:
        g.mariadb_conn = pymysql.connect(**MARIADB_CONFIG)
    return g.mariadb_conn

@app.teardown_appcontext
def close_db_connections(exception):
    mariadb_conn = g.pop('mariadb_conn', None)
    if mariadb_conn is not None and mariadb_conn.open:
        mariadb_conn.close()

# --- 라우트(Routes) 정의 ---

@app.route('/')
def index():
    # ... 이 부분은 기존 코드와 동일하게 유지 ...
    naver_client_id = os.getenv('NAVER_CLIENT_ID')
    conn = get_mariadb_conn()
    types, regions, floors, scales = [], [], [], []
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT TYPE_NAME FROM TYPE ORDER BY TYPE_ID")
        types = [row['TYPE_NAME'] for row in cursor.fetchall()]
        cursor.execute("SELECT REGION_ID, REGION_NAME FROM REGION ORDER BY REGION_ID")
        regions = cursor.fetchall()
        cursor.execute("SELECT DISTINCT FLOOR FROM RENT ORDER BY FLOOR ASC")
        floors = [row['FLOOR'] for row in cursor.fetchall()]
        # 테이블 이름을 실제 DB에 맞게 SCALE_PURCHASE로 수정
        cursor.execute("SELECT SCALE_ID, SIZE_SCALE FROM SCALE_PURCHASE ORDER BY SCALE_ID ASC")
        scales = cursor.fetchall()
    except Exception as e:
        print(f"❌ DB 목록 조회 오류: {e}")
    
    return render_template('index.html', naver_client_id=naver_client_id, types=types, regions=regions, floors=floors, scales=scales)


# [★★★★★ 핵심 수정 부분 ★★★★★]
def parse_size_scale_to_m2(text):
    """'30m² - 50m² 미만' 같은 텍스트를 (최소, 최대) m² 숫자로 변환하는 함수"""
    numbers = [float(s) for s in re.findall(r'\d+\.?\d*', text)]
    if '미만' in text and len(numbers) == 1:
        return (0, numbers[0])
    if '이상' in text and len(numbers) == 1:
        return (numbers[0], float('inf'))
    if len(numbers) == 2:
        return (numbers[0], numbers[1])
    return (0, 0)

@app.route('/api/calculate_cost', methods=['POST'])
def calculate_cost():
    data = request.get_json()
    region_id, floor, pyeong, type_name = data.get('region_id'), data.get('floor'), data.get('pyeong'), data.get('type')

    if not all([region_id, floor, pyeong, type_name]):
        return jsonify({'error': '모든 값을 선택해야 합니다.'}), 400

    try:
        conn = get_mariadb_conn()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        pyeong = float(pyeong)
        
        # 1. 총 월 임차료 계산
        cursor.execute("""
            SELECT AVG(REN_AMOUNT) as AVG_RENT 
            FROM (
                SELECT REN_AMOUNT FROM RENT 
                WHERE REGION_ID = %s AND FLOOR = %s 
                ORDER BY YEAR DESC, QUARTER DESC LIMIT 4
            ) as T
        """, (region_id, floor))
        rent_per_pyeong_mandanwi = float((cursor.fetchone() or {}).get('AVG_RENT', 0))
        total_rent_cost = (pyeong * rent_per_pyeong_mandanwi)

        # 2. 시설/구매 비용 계산 (Python 로직으로 변경)
        size_m2 = pyeong * 3.305785
        cursor.execute("SELECT SIZE_SCALE, PURCHASE_QTY FROM SCALE_PURCHASE")
        all_scales = cursor.fetchall()
        
        purchase_cost_mandanwi = 0
        for scale in all_scales:
            min_m2, max_m2 = parse_size_scale_to_m2(scale['SIZE_SCALE'])
            if min_m2 <= size_m2 < max_m2:
                purchase_cost_mandanwi = float(scale['PURCHASE_QTY'])
                break # 맞는 구간을 찾으면 루프 종료
        total_purchase_cost = purchase_cost_mandanwi * 10000

        # 3. 업태별 초기 투자 비용
        cursor.execute("""
            SELECT i.INV_AMOUNT FROM INVEST i JOIN TYPE t ON i.TYPE_ID = t.TYPE_ID
            WHERE t.TYPE_NAME = %s
        """, (type_name,))
        invest_cost_mandanwi = float((cursor.fetchone() or {}).get('INV_AMOUNT', 0))
        total_invest_cost = invest_cost_mandanwi * 10000

        # 4. 최종 비용 합산
        total_cost = total_rent_cost + total_purchase_cost + total_invest_cost

        return jsonify({
            'costs': {
                'rent': {'pyeong': pyeong, 'per_pyeong': rent_per_pyeong_mandanwi * 10000, 'total': total_rent_cost},
                'purchase': total_purchase_cost,
                'invest': total_invest_cost,
                'total': total_cost
            }
        })
    
    except Exception as e:
        print(f"❌ 비용 계산 API 오류: {e}")
        return jsonify({'error': '비용 계산 중 오류 발생'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)