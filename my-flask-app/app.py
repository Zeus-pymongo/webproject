from flask import Flask, render_template, g, jsonify, request
import os
from dotenv import load_dotenv
import pymysql
from pymongo import MongoClient
import requests

# .env 파일 로드
load_dotenv() 

app = Flask(__name__)

# ★★★★★ 이 부분에 데이터베이스 설정값을 직접 넣습니다. ★★★★★
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

# Geocoding API 키 (네이버 클라우드 플랫폼에서 발급받은 키를 .env 파일에 저장해야 합니다.)
NAVER_GEOCODE_CLIENT_ID = os.getenv('NAVER_GEOCODE_CLIENT_ID')
NAVER_GEOCODE_CLIENT_SECRET = os.getenv('NAVER_GEOCODE_CLIENT_SECRET')

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

# --- 웹 페이지 라우팅 ---
# app.py의 index 함수를 아래와 같이 수정
# app.py의 index 함수를 아래와 같이 수정
# app.py
@app.route('/')
def index():
    naver_client_id = os.getenv('NAVER_CLIENT_ID') # .env와 변수 이름 통일 권장
    
    mariadb_conn = get_mariadb_conn()
    types = []
    regions = []
    floors = []
    scales = []

    try:
        cursor = mariadb_conn.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("SELECT TYPE_NAME FROM TYPE ORDER BY TYPE_ID")
        types = [row['TYPE_NAME'] for row in cursor.fetchall()]

        cursor.execute("SELECT REGION_ID, REGION_NAME FROM REGION ORDER BY REGION_ID")
        regions = cursor.fetchall()
        
        cursor.execute("SELECT DISTINCT FLOOR FROM RENT ORDER BY FLOOR ASC")
        floors = [row['FLOOR'] for row in cursor.fetchall()]
        
        # [★★★★★ 수정된 부분 ★★★★★]
        # scales 데이터를 가져오기 전에 cursor.execute()를 호출합니다.
        cursor.execute("SELECT SCALE_ID, SIZE_SCALE FROM SCALE_PURCHASE ORDER BY SCALE_ID ASC")
        scales = cursor.fetchall()
        # [★★★★★ 수정된 부분 끝 ★★★★★]
        
    except Exception as e:
        print(f"❌ DB에서 목록을 가져오는 데 실패했습니다: {e}")
    finally:
        if mariadb_conn and mariadb_conn.open:
            mariadb_conn.close()

    # 디버깅 출력 (수정 없음)
    print("---")
    print(f"Flask가 .env에서 읽은 Client ID: '{naver_client_id}'")
    print(f"DB에서 가져온 업태 목록: {types}")
    print(f"DB에서 가져온 동 목록: {regions}")
    print(f"DB에서 가져온 층수 목록: {floors}")
    print(f"💡 DB에서 가져온 규모 목록: {scales}") # 이 부분이 정상적으로 출력되는지 확인
    print("---")
    
    return render_template('index.html', naver_client_id=naver_client_id, types=types, regions=regions, floors=floors, scales=scales)
# ...
@app.route('/api/restaurants_by_filter', methods=['POST'])
def get_restaurants_by_filter():
    mariadb_conn = None
    mongodb_client = None
    data = request.get_json()
    region_id = data.get('region_id')
    type_name = data.get('type_name')

    try:
        mariadb_conn = get_mariadb_conn()
        mongodb_client = get_mongodb_client()
        
        query_restaurants = """
        SELECT RG.STORE_NAME, RG.DETAIL_ADD
        FROM RESTAURANTS_GENERAL RG
        JOIN TYPE T ON RG.TYPE_NUM = T.TYPE_ID
        JOIN REGION R ON RG.REGION_ID = R.REGION_ID
        WHERE R.REGION_ID = %s AND T.TYPE_NAME = %s
        """
        
        cursor = mariadb_conn.cursor()
        cursor.execute(query_restaurants, (region_id, type_name))
        restaurants_in_mariadb = cursor.fetchall()
        
        if not restaurants_in_mariadb:
            return jsonify({"error": "해당 조건의 음식점이 없습니다."}), 200 # 💡 404 대신 200과 빈 목록 반환
        
        restaurant_names = [row[0] for row in restaurants_in_mariadb]
        restaurant_address_map = {row[0]: row[1] for row in restaurants_in_mariadb}

        mongo_collection = mongodb_client[MONGO_CONFIG['db_name']]['CRWAL']
        crawled_data = list(mongo_collection.find(
            {'original_name': {'$in': restaurant_names}, 'status': 'success'}
        ))
        
        final_list = []
        for doc in crawled_data:
            original_name = doc['original_name']
            address = restaurant_address_map.get(original_name)
            
            if address:
                url = f"https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query={address}"
                headers = {
                    'X-NCP-APIGW-API-KEY-ID': os.getenv('NAVER_GEOCODE_CLIENT_ID'),
                    'X-NCP-APIGW-API-KEY': os.getenv('NAVER_GEOCODE_CLIENT_SECRET')
                }
                geocode_response = requests.get(url, headers=headers)
                
                if geocode_response.ok and geocode_response.json()['addresses']:
                    geocode_data = geocode_response.json()['addresses'][0]
                    doc['lat'] = geocode_data['y']
                    doc['lng'] = geocode_data['x']
                    doc['address'] = address
                    final_list.append(doc)
                
        return jsonify(final_list)
        
    except pymysql.Error as e:
        return jsonify({"error": f"MariaDB 오류: {e}"}), 500
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return jsonify({"error": f"서버 내부 오류 발생: {e}"}), 500
    finally:
        if mariadb_conn and mariadb_conn.open:
            mariadb_conn.close()
        if mongodb_client:
            mongodb_client.close()

# app.py 파일 하단에 추가

@app.route('/api/calculate_cost', methods=['POST'])
def calculate_cost():
    """선택된 층수, 규모, 업태를 받아 예상 창업 비용을 계산하는 API"""
    data = request.get_json()
    floor = data.get('floor')
    scale_id = data.get('scale')
    type_name = data.get('type')

    # 1. 전달받은 값이 유효한지 확인
    if not all([floor, scale_id, type_name]):
        return jsonify({'error': '모든 값을 선택해야 합니다.'}), 400

    try:
        conn = get_mariadb_conn()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # 2. 각 테이블에서 비용 정보 조회
        # 2-1. 층수에 따른 임대료 조회 (RENT 테이블)
        cursor.execute("SELECT RENT_PRICE FROM RENT WHERE FLOOR = %s", (floor,))
        rent_result = cursor.fetchone()
        rent_cost = rent_result['RENT_PRICE'] if rent_result else 0

        # 2-2. 규모에 따른 구매비용 조회 (SCALE 테이블)
        # 보내주신 이미지의 PURCHASE_QTY 컬럼을 사용합니다.
        cursor.execute("SELECT PURCHASE_QTY FROM SCALE WHERE SCALE_ID = %s", (scale_id,))
        purchase_result = cursor.fetchone()
        purchase_cost = purchase_result['PURCHASE_QTY'] if purchase_result else 0
        
        # 2-3. 업태에 따른 기타 비용 조회 (TYPE 테이블 - 예시)
        # TYPE 테이블에 'ETC_COST'라는 컬럼이 있다고 가정합니다.
        cursor.execute("SELECT ETC_COST FROM TYPE WHERE TYPE_NAME = %s", (type_name,))
        etc_result = cursor.fetchone()
        etc_cost = etc_result['ETC_COST'] if etc_result else 0

        # 3. 최종 비용 계산
        total_cost = float(rent_cost) + float(purchase_cost) + float(etc_cost)

        # 4. 계산된 비용 항목들을 JSON으로 반환
        result = {
            'rent_cost': rent_cost,
            'purchase_cost': purchase_cost,
            'etc_cost': etc_cost,
            'total_cost': total_cost
        }
        return jsonify(result)
    
    except Exception as e:
        print(f"❌ 비용 계산 중 오류: {e}")
        return jsonify({'error': '비용을 계산하는 중 서버에서 오류가 발생했습니다.'}), 500
    finally:
        if conn and conn.open:
            conn.close()

# if __name__ == '__main__': 바로 위에 추가하시면 됩니다.

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)