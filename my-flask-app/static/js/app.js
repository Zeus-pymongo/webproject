document.addEventListener('DOMContentLoaded', function () {
    // --- 지도 관련 초기화 코드 전체 삭제 ---

    // --- 1. 상권 분석 모달 기능 ---
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

        if (modalOpenBtn) {
            modalOpenBtn.addEventListener('click', () => {
                resetSelections();
                analysisModal.style.display = 'flex';
                showStep(1);
            });
        }
        
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
                
                // 로딩 메시지 표시
                const chartItems = document.querySelectorAll('.chart-display-area .chart-item');
                chartItems.forEach(item => {
                    const img = item.querySelector('img');
                    const p = item.querySelector('p');
                    if (img) img.style.display = 'none';
                    if (p) p.remove();
                    
                    const loadingMessage = document.createElement('p');
                    loadingMessage.textContent = '그래프를 생성 중입니다...';
                    item.appendChild(loadingMessage);
                });
                costResultDiv.innerHTML = '<p>데이터를 계산 중입니다...</p>';

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
                    
                    renderCostInfo(data.costs);
                    renderMovementCharts(data.movement);

                } catch (error) {
                    console.error("❌ 최종 분석 API 호출 오류:", error);
                    costResultDiv.innerHTML = `<p style="color:red;">분석 실패: ${error.message}</p>`;
                    chartItems.forEach(item => {
                        item.querySelector('p')?.remove();
                        const errorMessage = document.createElement('p');
                        errorMessage.textContent = '표시 실패';
                        errorMessage.style.color = 'red';
                        item.appendChild(errorMessage);
                    });
                }
            });
        });

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
            
        function renderMovementCharts(movement) {
            const renderChart = (chartId, imageData) => {
                const imageElement = document.getElementById(chartId);
                if (!imageElement) return;

                const chartItem = imageElement.closest('.chart-item');
                const loadingMessage = chartItem.querySelector('p');
                if (loadingMessage) loadingMessage.remove();

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
    } // -- 상권 분석 모달 기능 끝 --

    // --- 2. MongoDB 기반 트렌드 분석 기능 ---
    const trendForm = document.getElementById('trend-filter-form');
    const dongButtonsContainer = document.getElementById('dong-buttons-mongo');
    const categorySelect = document.getElementById('category-select-mongo');
    
    // 워드클라우드 표시 영역 관련 변수
    const initialMessageDiv = document.getElementById('initial-message');
    const resultContentDiv = document.getElementById('result-content');
    const wordcloudTitle = document.getElementById('wordcloud-title');
    const wordcloudImageContainer = document.getElementById('wordcloud-image-container');

    let selectedMongoDong = '';

    // MongoDB 필터 데이터 가져와서 UI 생성
    async function populateMongoFilters() {
        try {
            const response = await fetch('/api/mongo_filters');
            if (!response.ok) throw new Error('서버 오류');
            const data = await response.json();

            if (data.success) {
                // 동 버튼 생성
                dongButtonsContainer.innerHTML = '';
                data.dongs.forEach(dong => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'filter-btn';
                    button.dataset.dongName = dong;
                    button.textContent = dong;
                    dongButtonsContainer.appendChild(button);
                });

                // 업태 옵션 생성
                categorySelect.innerHTML = '';
                data.categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                });

                // 동 버튼에 이벤트 리스너 추가
                dongButtonsContainer.querySelectorAll('.filter-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        dongButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                        this.classList.add('active');
                        selectedMongoDong = this.dataset.dongName;
                    });
                });
            }
        } catch (error) {
            console.error("MongoDB 필터 로딩 실패:", error);
            dongButtonsContainer.innerHTML = '<p style="color:red;">동 목록 로딩 실패</p>';
        }
    }

    // 트렌드 분석 폼 제출 이벤트
    if (trendForm) {
        trendForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const selectedCategories = Array.from(categorySelect.selectedOptions).map(opt => opt.value);

            if (!selectedMongoDong || selectedCategories.length === 0) {
                alert('동과 하나 이상의 업태를 선택해주세요.');
                return;
            }
            
            // 초기 메시지 숨기고 결과 영역 보이기
            initialMessageDiv.style.display = 'none';
            resultContentDiv.style.display = 'block';
            
            wordcloudTitle.textContent = `'${selectedMongoDong}' 트렌드 분석 중...`;
            wordcloudImageContainer.innerHTML = '<p>워드클라우드를 생성하고 있습니다...</p>';

            try {
                const response = await fetch('/api/wordcloud', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dong_name: selectedMongoDong,
                        categories: selectedCategories
                    })
                });
                
                if (!response.ok) throw new Error((await response.json()).error || '서버 응답 오류');
                
                const data = await response.json();
                const categoryText = selectedCategories.length > 2 ? `${selectedCategories.slice(0, 2).join(', ')} 등` : selectedCategories.join(', ');
                wordcloudTitle.textContent = `'${selectedMongoDong}'의 '${categoryText}' 트렌드`;
                if (data.success) {
                    wordcloudImageContainer.innerHTML = `<img src="data:image/png;base64,${data.image}" alt="워드클라우드" style="max-width:100%;">`;
                } else {
                    wordcloudImageContainer.innerHTML = `<p style="color:grey;">${data.message}</p>`;
                }

            } catch (error) {
                wordcloudTitle.textContent = `분석 오류`;
                wordcloudImageContainer.innerHTML = `<p style="color:red;">${error.message}</p>`;
            }
        });
    }

    // 페이지가 처음 로드될 때 MongoDB 필터를 채움
    populateMongoFilters();
});