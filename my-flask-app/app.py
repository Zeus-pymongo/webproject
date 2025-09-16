from flask import Flask, render_template

app = Flask(__name__)

# 메인 페이지 라우팅
@app.route('/')
def home():
    return render_template('index.html')

# 서버 실행
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

