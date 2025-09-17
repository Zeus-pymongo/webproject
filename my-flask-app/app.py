from flask import Flask, render_template
import os
from dotenv import load_dotenv

load_dotenv() 

app = Flask(__name__)

@app.route('/')
def index():
    naver_client_id = os.getenv('NAVER_MAP_CLIENT_ID')
    
    # [★★★★★ 디버깅 코드 추가 ★★★★★]
    # 터미널에 .env에서 읽은 값을 출력해봅니다.
    print("---")
    print(f"Flask가 .env에서 읽은 Client ID: '{naver_client_id}'")
    print("---")
    
    return render_template('index.html', naver_client_id=naver_client_id)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)