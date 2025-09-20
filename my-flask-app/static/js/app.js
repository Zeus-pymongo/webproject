// app.js

document.addEventListener('DOMContentLoaded', function () {
    // --- 1, 2, 3 부분 (지도, 사이드바 등)은 기존 코드를 그대로 사용 ---
    // (생략)

    // --- 4. 상권 분석 모달 기능 ---
    const analysisModal = document.getElementById('analysisModal');
    if (analysisModal) {
        const modalOpenBtn = document.getElementById('show-analysis-modal');
        const modalCloseBtns = analysisModal.querySelectorAll('.close');
        const modalSteps = analysisModal.querySelectorAll('.modal-step');
        const regionBtns = analysisModal.querySelectorAll('.region-btn');
        const floorBtns = analysisModal.querySelectorAll('.floor-btn');
        const pyeongSlider = analysisModal.querySelector('#pyeong-slider');
        const sliderValue = analysisModal.querySelector('#slider-value');
        const pyeongNextBtn = analysisModal.querySelector('#pyeong-next-btn');
        const typeBtns = analysisModal.querySelectorAll('.type-btn');
        const restartBtn = analysisModal.querySelector('#restart-analysis-btn');

        let analysisSelections = {};
        
        const showStep = (stepNumber) => {
            modalSteps.forEach(step => { step.style.display = 'none'; });
            const nextStep = analysisModal.querySelector(`#step${stepNumber}`);
            if(nextStep) nextStep.style.display = 'block';
        };
        
        const resetSelections = () => {
            analysisSelections = { region_id: null, region_name: null, floor: null, pyeong: 30, type: null };
            if(pyeongSlider) pyeongSlider.value = 30;
            if(sliderValue) sliderValue.textContent = 30;
        };

        modalOpenBtn.addEventListener('click', () => {
            resetSelections();
            analysisModal.style.display = 'flex';
            showStep(1);
        });

        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => { analysisModal.style.display = 'none'; });
        });

        regionBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                analysisSelections.region_id = this.dataset.value;
                analysisSelections.region_name = this.dataset.name;
                showStep(2);
            });
        });

        floorBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                analysisSelections.floor = this.dataset.value;
                showStep(3);
            });
        });

        if(pyeongSlider) {
            pyeongSlider.addEventListener('input', function() {
                sliderValue.textContent = this.value;
                analysisSelections.pyeong = this.value;
            });
        }
        if(pyeongNextBtn) {
            pyeongNextBtn.addEventListener('click', () => showStep(4));
        }
        
        typeBtns.forEach(btn => {
            btn.addEventListener('click', async function() {
                analysisSelections.type = this.dataset.value;
                showStep(5);
                
                const costResultDiv = document.getElementById('cost-result-box');
                const chartContainer = document.querySelector('.chart-display-area .chart-item');
                
                costResultDiv.innerHTML = '<p>데이터를 계산 중입니다...</p>';
                if(chartContainer) chartContainer.innerHTML = '<p>그래프를 생성 중입니다...</p>';

                try {
                    const response = await fetch('/api/final_analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(analysisSelections)
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || '서버 응답 오류');
                    }
                    const data = await response.json();
                    console.log("📬 [프론트엔드 로그] 서버로부터 받은 최종 분석 데이터:", data);

                    renderCostInfo(data.costs);
                    renderMovementCharts(data.movement);

                } catch (error) {
                    console.error("❌ 최종 분석 API 호출 오류:", error);
                    costResultDiv.innerHTML = `<p style="color:red;">분석 실패: ${error.message}</p>`;
                    if(chartContainer) chartContainer.innerHTML = '';
                }
            });
        });

        function renderCostInfo(costs) {
            const costResultDiv = document.getElementById('cost-result-box');
            const formatKRW = (num) => Math.round(num).toLocaleString('ko-KR');
            costResultDiv.innerHTML = `
                <ul style="list-style:none; padding:0; margin:10px 0;">
                    <li><strong>임차료:</strong> ${formatKRW(costs.rent.total)} 원</li>
                    <li><strong>시설/구매:</strong> ${formatKRW(costs.purchase)} 원</li>
                    <li><strong>초기 투자금:</strong> ${formatKRW(costs.invest)} 원</li>
                </ul>
                <hr>
                <h4>초기 총 예상 비용: <br><span style="color: #007bff; font-size: 1.2em;">${formatKRW(costs.total)} 원</span></h4>
            `;
        }
        
      // app.js의 renderMovementCharts 함수를 이 코드로 교체하세요.

function renderMovementCharts(movement) {
    const chartContainer = document.querySelector('.chart-display-area .chart-item');
    if (!chartContainer) return;

    // 서버로부터 이미지 데이터가 성공적으로 도착했는지 확인
    if (movement && movement.gender_chart_image) {
        // 1. 컨테이너의 내용을 비우고, 새로운 img 태그를 확실하게 추가합니다.
        chartContainer.innerHTML = `<img id="genderChartImage" alt="성별 비율 그래프" style="width: 100%; height: auto;">`;
        
        // 2. 새로 만든 img 태그를 다시 찾습니다.
        const imageElement = document.getElementById('genderChartImage');
        
        // 3. 찾은 img 태그에 이미지 데이터를 설정합니다.
        imageElement.src = "data:image/png;base64," + movement.gender_chart_image;

    } else {
        // 이미지 데이터가 없는 경우
        chartContainer.innerHTML = '<p>차트 데이터가 없습니다.</p>';
    }
}

        if (restartBtn) {
            restartBtn.addEventListener('click', () => { showStep(1); });
        }
    }
});