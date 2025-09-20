// app.js

document.addEventListener('DOMContentLoaded', function () {
    // --- 지도, 사이드바, 제어 버튼 기능 ---
    const mapElement = document.getElementById('map');
    if (!mapElement) return;
    if (typeof naver === 'undefined' || typeof naver.maps === 'undefined') {
        mapElement.innerHTML = '<div style="padding:20px; text-align:center;">지도 로딩 실패</div>';
        return;
    }
    const TAPGOL_LAT_LNG = new naver.maps.LatLng(37.5716, 126.9880);
    const map = new naver.maps.Map(mapElement, { center: TAPGOL_LAT_LNG, zoom: 14, zoomControl: true });
    
    // (이하 지도/사이드바 관련 코드는 기존과 동일하게 유지)

    // app.js의 '// --- 4. 상권 분석 모달 기능 ---' 이하를 이 코드로 교체하세요.

// --- 4. 상권 분석 모달 기능 ---
const analysisModal = document.getElementById('analysisModal');
if (analysisModal) {
    const modalOpenBtn = document.getElementById('show-analysis-modal');
    // (이하 변수 선언은 기존과 동일)
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

    // (showStep, resetSelections 및 다른 이벤트 리스너는 기존과 동일)
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

    modalCloseBtns.forEach(btn => btn.addEventListener('click', () => { analysisModal.style.display = 'none'; }));
    regionBtns.forEach(btn => btn.addEventListener('click', function() {
        analysisSelections.region_id = this.dataset.value;
        analysisSelections.region_name = this.dataset.name;
        showStep(2);
    }));
    floorBtns.forEach(btn => btn.addEventListener('click', function() {
        analysisSelections.floor = this.dataset.value;
        showStep(3);
    }));
    if(pyeongSlider) pyeongSlider.addEventListener('input', function() {
        sliderValue.textContent = this.value;
        analysisSelections.pyeong = this.value;
    });
    if(pyeongNextBtn) pyeongNextBtn.addEventListener('click', () => showStep(4));
    
    typeBtns.forEach(btn => {
        btn.addEventListener('click', async function() {
            analysisSelections.type = this.dataset.value;
            showStep(5);
            
            const costResultDiv = document.getElementById('cost-result-box');
            
            // ★★★★★ 수정된 로딩 로직 ★★★★★
            // 로딩 메시지를 표시하기 전에 모든 img 태그를 숨깁니다.
            const chartItems = document.querySelectorAll('.chart-display-area .chart-item');
            chartItems.forEach(item => {
                const img = item.querySelector('img');
                const p = item.querySelector('p');
                if (img) img.style.display = 'none';
                if (p) p.remove(); // 이전 결과 메시지가 있다면 삭제
                
                const loadingMessage = document.createElement('p');
                loadingMessage.textContent = '그래프를 생성 중입니다...';
                item.appendChild(loadingMessage);
            });
            costResultDiv.innerHTML = '<p>데이터를 계산 중입니다...</p>';
            // ★★★★★★★★★★★★★★★★★★★★★

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
                chartItems.forEach(item => {
                    item.querySelector('p')?.remove(); // 로딩 메시지 제거
                    const errorMessage = document.createElement('p');
                    errorMessage.textContent = '표시 실패';
                    errorMessage.style.color = 'red';
                    item.appendChild(errorMessage);
                });
            }
        });
    });

 // app.js의 renderCostInfo 함수를 이 코드로 전체 교체하세요.

function renderCostInfo(costs) {
    const costResultDiv = document.getElementById('cost-result-box');
    if (!costResultDiv) return;

    const formatKRW = (num) => Math.round(num).toLocaleString('ko-KR');
    
    costResultDiv.innerHTML = `
        <ul style="list-style:none; padding:0; margin:10px 0;">
            <li>
                <strong>임차료:</strong> ${formatKRW(costs.rent.total)} 원
                <small style="display:block; color:#666; padding-left:15px;">
                    (${costs.rent.pyeong}평 × 평당 ${formatKRW(costs.rent.per_pyeong)}원)
                </small>
            </li>
            <li><strong>시설/구매:</strong> ${formatKRW(costs.purchase)} 원</li>
            <li><strong>초기 투자금:</strong> ${formatKRW(costs.invest)} 원</li>
        </ul>
        <hr>
        <h4>초기 총 예상 비용: <br><span style="color: #007bff; font-size: 1.2em;">${formatKRW(costs.total)} 원</span></h4>
    `;
}
    
    // ★★★★★ 수정된 렌더링 함수 ★★★★★
    function renderMovementCharts(movement) {
        const renderChart = (chartId, imageData) => {
            const imageElement = document.getElementById(chartId);
            if (!imageElement) return;

            const chartItem = imageElement.closest('.chart-item');
            const loadingMessage = chartItem.querySelector('p');
            if (loadingMessage) loadingMessage.remove(); // 로딩 메시지 제거

            if (imageData) {
                imageElement.src = "data:image/png;base64," + imageData;
                imageElement.style.display = 'block';
            } else {
                const noDataMessage = document.createElement('p');
                noDataMessage.textContent = '차트 데이터가 없습니다.';
                chartItem.appendChild(noDataMessage);
            }
        };

        renderChart('ageGenderChartImage', movement.age_gender_chart_image);
        renderChart('movTypChartImage', movement.mov_typ_chart_image);
        renderChart('timeMovTypChartImage', movement.time_mov_typ_chart_image);
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => { showStep(1); });
    }
}
});