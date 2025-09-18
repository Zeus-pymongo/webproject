from flask import Flask, render_template, g, jsonify, request
import os
from dotenv import load_dotenv
import pymysql
from pymongo import MongoClient
import requests # requests 라이브러리 추가
from flask import Flask, render_template, request, jsonify, g
import pymysql
from pymongo import MongoClient

# .env 파일 로드
load_dotenv() 

app = Flask(__name__)

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

# --- 데이터베이스 연결 함수 ---
def get_mariadb_conn():
    if 'mariadb_conn' not in g:
        g.mariadb_conn = pymysql.connect(**MARIADB_CONFIG)
    return g.mariadb_conn

def get_mongodb_client():
    if 'mongodb_client' not in g:
        # uri 문자열로 연결
        uri = f"mongodb://{MONGO_CONFIG['username']}:{MONGO_CONFIG['password']}@{MONGO_CONFIG['host']}:{MONGO_CONFIG['port']}/"
        g.mongodb_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return g.mongodb_client

# Flask 요청이 끝날 때 데이터베이스 연결 종료
# app.py 파일에서 아래 함수를 찾아서 수정하세요.
@app.teardown_appcontext
def close_db_connections(exception):
    mariadb_conn = g.pop('mariadb_conn', None)
    
    # 💡 연결이 있고, 아직 닫히지 않은 상태일 때만 close() 호출
    if mariadb_conn is not None and mariadb_conn.open:
        mariadb_conn.close()
    
    # MongoDB 연결은 자동으로 관리되므로 따로 닫지 않아도 됩니다.
    
    # MongoDB 연결은 자동으로 관리되므로 따로 닫지 않아도 됩니다.

# --- 웹 페이지 라우팅 ---
@app.route('/')
def index():
    naver_client_id = os.getenv('NAVER_MAP_CLIENT_ID')
    
    # 💡 MariaDB에서 업태명(TYPE_NAME) 목록 가져오기
    types = []
    mariadb_conn = None
    try:
        mariadb_conn = get_mariadb_conn()
        cursor = mariadb_conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT TYPE_NAME FROM TYPE ORDER BY TYPE_ID")
        types = [row['TYPE_NAME'] for row in cursor.fetchall()]
    except Exception as e:
        print(f"❌ DB에서 업태명 목록을 가져오는 데 실패했습니다: {e}")
    finally:
        if mariadb_conn:
            mariadb_conn.close()
    
    # 디버깅 코드
    print("---")
    print(f"Flask가 .env에서 읽은 Client ID: '{naver_client_id}'")
    print(f"DB에서 가져온 업태 목록: {types}")
    print("---")
    
    # 💡 HTML 템플릿에 types 목록 전달
    return render_template('index.html', naver_client_id=naver_client_id, types=types)

@app.route('/api/movement_data', methods=['POST'])
def get_movement_data():
    conn = get_mariadb_conn()
    data = request.get_json()
    start_dong = data.get('start_dong')
    gender = data.get('gender')
    age_groups = data.get('age_groups', [])

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        query = """
        SELECT
            T1.REGION_NAME AS start_region,
            T2.REGION_NAME AS end_region,
            SUM(M.MOV_COUNT) AS total_count
        FROM MOVEMENT M
        JOIN REGION T1 ON M.STR_ID = T1.REGION_ID
        JOIN REGION T2 ON M.DES_ID = T2.REGION_ID
        WHERE T1.REGION_NAME = %s
        """
        params = [start_dong]
        
        if gender and gender != 'all':
            query += " AND M.GENDER = %s"
            params.append(gender)

        if age_groups:
            age_conditions = []
            for age_range in age_groups:
                start_age, end_age = map(int, age_range.split('-'))
                age_conditions.append(f"(M.AGE BETWEEN {start_age} AND {end_age})")
            if age_conditions:
                query += " AND (" + " OR ".join(age_conditions) + ")"
        
        query += " GROUP BY T1.REGION_NAME, T2.REGION_NAME ORDER BY total_count DESC"

        cursor.execute(query, params)
        movement_data = cursor.fetchall()
        
        return jsonify(movement_data)
    except Exception as e:
        print(f"❌ 유동인구 데이터 조회 실패: {e}")
        return jsonify({"error": "유동인구 데이터를 가져오지 못했습니다."}), 500
    finally:
        conn.close()

# app.py 파일에 추가
# ... (기존 설정, 데이터베이스 연결 함수) ...

# Geocoding API 키
NAVER_GEOCODE_CLIENT_ID = os.getenv('NAVER_GEOCODE_CLIENT_ID')
NAVER_GEOCODE_CLIENT_SECRET = os.getenv('NAVER_GEOCODE_CLIENT_SECRET')

# Geocoding API를 호출하는 라우트
@app.route('/api/geocode')
def geocode():
    address = request.args.get('address')
    if not address:
        return jsonify({'error': '주소 매개변수가 누락되었습니다.'}), 400

    url = f"https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query={address}"
    headers = {
        'X-NCP-APIGW-API-KEY-ID': NAVER_GEOCODE_CLIENT_ID,
        'X-NCP-APIGW-API-KEY': NAVER_GEOCODE_CLIENT_SECRET
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status() # HTTP 오류가 발생하면 예외를 발생시킵니다.
        data = response.json()

        if data['addresses']:
            lat = data['addresses'][0]['y']
            lng = data['addresses'][0]['x']
            return jsonify({'lat': lat, 'lng': lng})
        else:
            return jsonify({'error': '주소를 찾을 수 없습니다.'}), 404

    except requests.exceptions.RequestException as e:
        print(f"Geocoding API 요청 오류: {e}")
        return jsonify({'error': 'Geocoding API 요청 중 오류가 발생했습니다.'}), 500

# get_restaurants_by_type 함수를 아래와 같이 수정
@app.route('/api/restaurants_by_type/<type_name>')
def get_restaurants_by_type(type_name):
    mariadb_conn = None
    mongodb_client = None
    try:
        mariadb_conn = get_mariadb_conn()
        mongodb_client = get_mongodb_client()

        # 1. MariaDB에서 업태명(type_name)에 해당하는 TYPE_ID를 찾습니다.
        query_type_id = "SELECT TYPE_ID FROM TYPE WHERE TYPE_NAME = %s"
        cursor = mariadb_conn.cursor()
        cursor.execute(query_type_id, (type_name,))
        type_id_result = cursor.fetchone()

        if not type_id_result:
            return jsonify({"error": "업태명을 찾을 수 없습니다."}), 404

        type_id = type_id_result[0]

        # 2. MariaDB에서 해당 TYPE_ID를 가진 모든 음식점 ID를 가져옵니다.
        query_restaurants = "SELECT RESTAURANT_ID, STORE_NAME, DETAIL_ADD FROM RESTAURANTS_GENERAL WHERE TYPE_NUM = %s"
        cursor.execute(query_restaurants, (type_id,))
        restaurants_in_mariadb = cursor.fetchall()

        if not restaurants_in_mariadb:
            return jsonify({"error": "해당 업태의 음식점이 없습니다."}), 404

        restaurant_names = [row[1] for row in restaurants_in_mariadb]
        restaurant_address_map = {row[1]: row[2] for row in restaurants_in_mariadb}

        # 3. MongoDB에서 해당 음식점 이름들의 크롤링된 데이터를 가져옵니다.
        # ★★★ 이 부분이 누락되어 있었습니다. ★★★
        mongo_collection = mongodb_client['jongro']['CRWAL']
        crawled_data = list(mongo_collection.find(
            {'original_name': {'$in': restaurant_names}, 'status': 'success'},
            {'name': 1, 'original_name': 1}
        ))
        
        # 4. 각 음식점의 주소를 위도/경도로 변환하고 최종 목록을 만듭니다.
        final_list = []
        for doc in crawled_data:
            original_name = doc['original_name']
            address = restaurant_address_map.get(original_name)
            
            if address:
                # Geocoding API를 호출하여 주소를 좌표로 변환하는 로직을 추가해야 합니다.
                # 임시로 빈 리스트를 반환하거나, 실제 Geocoding API를 사용해야 합니다.
                final_list.append(doc)

        return jsonify(final_list)

    except pymysql.Error as e:
        return jsonify({"error": f"MariaDB 오류: {e}"}), 500
    except Exception as e:
        return jsonify({"error": f"오류 발생: {e}"}), 500
    finally:
        if mariadb_conn: mariadb_conn.close()
        if mongodb_client: mongodb_client.close()



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)