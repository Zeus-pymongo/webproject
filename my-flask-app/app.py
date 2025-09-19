from flask import Flask, render_template, g, jsonify, request
import os
from dotenv import load_dotenv
import pymysql
from pymongo import MongoClient
import requests

# .env 파일 로드
load_dotenv() 

app = Flask(__name__)

# --- 설정 정보 ---
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

# --- 데이터베이스 연결 관리 ---
def get_mariadb_conn():
    if 'mariadb_conn' not in g:
        g.mariadb_conn = pymysql.connect(**MARIADB_CONFIG)
    return g.mariadb_conn

def get_mongodb_client():
    if 'mongodb_client' not in g:
        uri = f"mongodb://{MONGO_CONFIG['username']}:{MONGO_CONFIG['password']}@{MONGO_CONFIG['host']}:{MONGO_CONFIG['port']}/"
        g.mongodb_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return g.mongodb_client

@app.teardown_appcontext
def close_db_connections(exception):
    mariadb_conn = g.pop('mariadb_conn', None)
    if mariadb_conn is not None and mariadb_conn.open:
        mariadb_conn.close()

# --- 라우트(Routes) 정의 ---

@app.route('/')
def index():
    """메인 페이지 렌더링 및 사이드바/모달 데이터 조회"""
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
        
        cursor.execute("SELECT SCALE_ID, SIZE_SCALE FROM SCALE_PURCHASE ORDER BY SCALE_ID ASC")
        scales = cursor.fetchall()

    except Exception as e:
        print(f"❌ DB에서 목록 조회 중 오류: {e}")
    
    return render_template('index.html', naver_client_id=naver_client_id, types=types, regions=regions, floors=floors, scales=scales)


@app.route('/api/restaurants_by_filter', methods=['POST'])
def get_restaurants_by_filter():
    """선택된 동/업태에 맞는 음식점 목록을 좌표와 함께 반환"""
    data = request.get_json()
    region_id = data.get('region_id')
    type_name = data.get('type_name')
    
    try:
        conn = get_mariadb_conn()
        mongodb_client = get_mongodb_client()
        
        query = """
        SELECT RG.STORE_NAME, RG.DETAIL_ADD
        FROM RESTAURANTS_GENERAL RG
        JOIN TYPE T ON RG.TYPE_NUM = T.TYPE_ID
        JOIN REGION R ON RG.REGION_ID = R.REGION_ID
        WHERE R.REGION_ID = %s AND T.TYPE_NAME = %s
        """
        cursor = conn.cursor()
        cursor.execute(query, (region_id, type_name))
        restaurants_db = cursor.fetchall()

        if not restaurants_db:
            return jsonify([])

        names = [row[0] for row in restaurants_db]
        address_map = {row[0]: row[1] for row in restaurants_db}

        mongo_collection = mongodb_client[MONGO_CONFIG['db_name']]['CRWAL']
        crawled_data = list(mongo_collection.find({'original_name': {'$in': names}, 'status': 'success'}))

        final_list = []
        for doc in crawled_data:
            address = address_map.get(doc.get('original_name'))
            if address:
                url = f"https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query={address}"
                headers = {
                    'X-NCP-APIGW-API-KEY-ID': os.getenv('NAVER_CLIENT_ID'),
                    'X-NCP-APIGW-API-KEY': os.getenv('NAVER_CLIENT_SECRET')
                }
                res = requests.get(url, headers=headers, timeout=5)
                
                if res.ok and res.json().get('addresses'):
                    geo = res.json()['addresses'][0]
                    if isinstance(doc, dict):
                        doc['lat'], doc['lng'], doc['address'] = geo.get('y'), geo.get('x'), address
                        final_list.append(doc)
            
        return jsonify(final_list)
        
    except Exception as e:
        print(f"❌ 필터링 API 오류: {e}")
        return jsonify({"error": f"서버 오류 발생: {e}"}), 500

# app.py

@app.route('/api/calculate_cost', methods=['POST'])
def calculate_cost():
    """선택된 값들로 예상 창업 비용을 계산"""
    data = request.get_json()
    floor, scale_id, type_name = data.get('floor'), data.get('scale'), data.get('type')

    if not all([floor, scale_id, type_name]):
        return jsonify({'error': '모든 값을 선택해야 합니다.'}), 400

    try:
        conn = get_mariadb_conn()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # 1. 층수에 따른 임대료 조회 (실제 컬럼명 확인 필요)
        cursor.execute("SELECT `REN_AMOUNT` FROM RENT WHERE FLOOR = %s", (floor,))
        rent_cost = (cursor.fetchone() or {}).get('REN_AMOUNT', 0)

        # [★★★★★ 수정된 부분 ★★★★★]
        # 2. 규모에 따른 구매비용 조회 (테이블 이름을 SCALE_PURCHASE로 수정)
        cursor.execute("SELECT `PURCHASE_QTY` FROM SCALE_PURCHASE WHERE SCALE_ID = %s", (scale_id,))
        purchase_cost = (cursor.fetchone() or {}).get('PURCHASE_QTY', 0)
        # [★★★★★ 수정된 부분 끝 ★★★★★]
        
        # 3. 업태별 투자금액 조회
        invest_query = """
            SELECT i.INV_AMOUNT 
            FROM INVEST i
            JOIN TYPE t ON i.TYPE_ID = t.TYPE_ID
            WHERE t.TYPE_NAME = %s
        """
        cursor.execute(invest_query, (type_name,))
        invest_cost = (cursor.fetchone() or {}).get('INV_AMOUNT', 0)

        # 4. 업태에 따른 기타 비용 조회 (이 부분은 실제 컬럼이 있을 경우 사용)
        etc_cost = 0 # 현재는 기타 비용을 0으로 처리

        # 5. 최종 비용 계산
        total_cost = float(rent_cost) + float(purchase_cost)*10000 + float(etc_cost) + float(invest_cost)

        return jsonify({
            'rent_cost': float(rent_cost),
            'purchase_cost': float(purchase_cost),
            'invest_cost': float(invest_cost),
            'etc_cost': float(etc_cost),
            'total_cost': total_cost
        })
    
    except Exception as e:
        print(f"❌ 비용 계산 API 오류: {e}")
        return jsonify({'error': '비용 계산 중 오류 발생'}), 500
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)