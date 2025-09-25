document.addEventListener('DOMContentLoaded', function () {
    // --- 1. 상권 분석 모달 기능 (기존과 동일) ---
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
            const detailModal = document.getElementById('restaurantDetailModal');
    const detailContent = document.getElementById('restaurant-detail-content');
    const detailModalCloseBtn = detailModal.querySelector('.close');
        let analysisSelections = {};
detailModalCloseBtn.addEventListener('click', () => {
        detailModal.style.display = 'none';
    });
       const allRestaurantsList = document.getElementById('all-restaurants-list');
    if(allRestaurantsList) {
        allRestaurantsList.addEventListener('click', function(event) {
            const restaurantItem = event.target.closest('.restaurant-item');
            if (restaurantItem) {
                const restaurantId = restaurantItem.dataset.id;
                showRestaurantDetails(restaurantId);
            }
        });
    }
async function showRestaurantDetails(restaurantId) {
    const detailModal = document.getElementById('restaurantDetailModal');
    const detailContent = document.getElementById('restaurant-detail-content');
    if (!detailModal || !detailContent) return;

    detailModal.style.display = 'flex';
    detailContent.innerHTML = '<p>상세 정보를 불러오는 중...</p>';
    
    // [진단 로그 1] 함수가 올바른 ID로 호출되었는지 확인
    console.log(`[진단] 맛집 ID: ${restaurantId} 상세 정보 요청 시작`);

    try {
        const response = await fetch(`/api/restaurant/${restaurantId}`);
        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }
        
        const data = await response.json();
        // [진단 로그 2] 서버로부터 받은 실제 데이터 확인
        console.log("[진단] 서버로부터 받은 데이터:", data);

        if (data.success) {
            const { restaurant, blogs } = data;

            const blogsHTML = blogs.length > 0 ? blogs.map(blog => `
                <li>
                    <a href="${blog.blog_url}" target="_blank" rel="noopener noreferrer">${blog.title}</a>
                    <span>(${blog.post_date})</span>
                </li>
            `).join('') : '<li>관련 블로그 리뷰가 없습니다.</li>';

            detailContent.innerHTML = `
                <div class="detail-header">
                    <h2>${restaurant.name}</h2>
                    <p class="category">${restaurant.category}</p>
                    <p class="address">${restaurant.address}</p>
                </div>
                <div class="detail-stats">
                    <p><strong>⭐ 평점:</strong> ${restaurant.rating || 'N/A'}</p>
                    <p><strong>📝 방문자 리뷰:</strong> ${restaurant.visitor_reviews || 0}개</p>
                    <p><strong>📝 평균 가격:</strong> ${Math.round(restaurant.avg_price || 0).toLocaleString('ko-KR')}원</p>
                    <p><strong>📝 평점 요약:</strong> ${restaurant.review_summary || 0}</p>
                    </div>
                <div class="detail-blogs">
                    <h3>관련 블로그 리뷰</h3>
                    <ul>${blogsHTML}</ul>
                </div>
            `;
        } else {
            throw new Error(data.error || '알 수 없는 오류');
        }
    } catch (error) {
        // [진단 로그 3] 에러 발생 시 내용 확인
        console.error("❌ 상세 정보 로딩 실패:", error);
        detailContent.innerHTML = `<p style="color:red;">상세 정보를 불러오는 데 실패했습니다: ${error.message}</p>`;
    }
}
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
function renderTopRestaurants(restaurants, dongName) {
    const container = document.getElementById('top-restaurant-info');
    if (!container) return;

    // restaurants 데이터가 배열이고, 내용이 있는지 확인
    if (restaurants && Array.isArray(restaurants) && restaurants.length > 0) {
        // map 함수를 이용해 각 맛집에 대한 HTML 조각을 만듦
        const restaurantsHTML = restaurants.map((r, index) => `
            <div class="top-restaurant-item">
                <span class="rank">${index + 1}</span>
                <div class="info">
                    <p class="name">${r.name}</p>
                    <p class="category">${r.category}</p>
                </div>
            </div>
        `).join(''); // 배열을 하나의 긴 문자열로 합침

        container.innerHTML = `
            <h4>🏆 '${dongName}' Top 5 맛집</h4>
            <div class="top-restaurant-list">
                ${restaurantsHTML}
            </div>
        `;
        container.style.display = 'block';
    } else {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}
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
    }

    // --- 2. MongoDB 기반 트렌드 분석 기능 (수정됨) ---
    const trendForm = document.getElementById('trend-filter-form');
    const dongButtonsContainer = document.getElementById('dong-buttons-mongo');
    const categorySelect = document.getElementById('category-select-mongo');
    
    const initialMessageDiv = document.getElementById('initial-message');
    const resultContentDiv = document.getElementById('result-content');
    const wordcloudTitle = document.getElementById('wordcloud-title');
    const wordcloudImageContainer = document.getElementById('wordcloud-image-container');

    let selectedMongoDong = '';
async function fetchAllRestaurants(dongName) {
    const titleElem = document.getElementById('all-restaurants-title');
    const listElem = document.getElementById('all-restaurants-list');
    
    // 다른 결과 영역 숨기기
    document.getElementById('wordcloud-result-area').style.display = 'none';
    document.getElementById('all-restaurants-area').style.display = 'block';

    titleElem.textContent = `'${dongName}' 전체 맛집 목록 (리뷰 많은 순)`;
    listElem.innerHTML = '<p>맛집 목록을 불러오는 중...</p>';

    try {
        const response = await fetch(`/api/restaurants_by_dong?dong_name=${dongName}`);
        const data = await response.json();

        if (data.success && data.restaurants.length > 0) {
            listElem.innerHTML = ''; // 로딩 메시지 제거
            data.restaurants.forEach(r => {
                const item = document.createElement('div');
                item.className = 'restaurant-item';
                item.dataset.id = r._id; // ★★★★★ 이 줄을 추가하세요 ★★★★★

                item.innerHTML = `
                    <div class="restaurant-info">
                        <p class="name">${r.name}</p>
                        <p class="category">${r.category}</p>
                    </div>
                    <div class="restaurant-stats">
                        <p>⭐ ${r.rating || 'N/A'}</p>
                        <p>📝 ${r.visitor_reviews || 0}</p>
                    </div>
                `;
                                item.addEventListener('click', () => {
                    showRestaurantDetails(r._id);
                });
                listElem.appendChild(item);
            });
        } else {
            listElem.innerHTML = '<p>해당 동의 맛집 정보를 찾을 수 없습니다.</p>';
        }
    } catch (error) {
        console.error("전체 맛집 목록 로딩 실패:", error);
        listElem.innerHTML = '<p style="color:red;">목록을 불러오는 데 실패했습니다.</p>';
    }
}
    // ★★★ [수정] 동 선택 시 해당 동의 카테고리만 불러오는 함수 ★★★
    async function updateCategoryList(dongName) {
        categorySelect.innerHTML = '<option disabled>카테고리 로딩 중...</option>';
        categorySelect.disabled = true;

        try {
            const response = await fetch(`/api/categories_by_dong?dong_name=${dongName}`);
            if (!response.ok) throw new Error('서버 응답 오류');
            
            const data = await response.json();
            if (data.success) {
                categorySelect.innerHTML = ''; // 기존 목록 초기화
                if (data.categories.length > 0) {
                    data.categories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        categorySelect.appendChild(option);
                    });
                    categorySelect.disabled = false; // 카테고리 있으면 활성화
                } else {
                    categorySelect.innerHTML = '<option disabled>선택 가능한 카테고리 없음</option>';
                }
            } else {
                throw new Error(data.error || '카테고리 로딩 실패');
            }
        } catch (error) {
            console.error("카테고리 목록 업데이트 실패:", error);
            categorySelect.innerHTML = `<option disabled>오류: ${error.message}</option>`;
        }
    }

    // 초기 필터 데이터(동 목록만) 가져와서 UI 생성
    async function populateDongFilters() {
        // ★★★ [수정] 카테고리 선택기를 초기에 비활성화 ★★★
        categorySelect.innerHTML = '<option value="" disabled selected>동을 먼저 선택하세요</option>';
        categorySelect.disabled = true;

        try {
            // 이제 이 API는 동 목록만 가져오는 역할
            const response = await fetch('/api/mongo_filters');
            if (!response.ok) throw new Error('서버 오류');
            const data = await response.json();

            if (data.success) {
                dongButtonsContainer.innerHTML = '';
                data.dongs.forEach(dong => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'filter-btn';
                    button.dataset.dongName = dong;
                    button.textContent = dong;
                    dongButtonsContainer.appendChild(button);
                });

                // 동 버튼에 이벤트 리스너 추가
// app.js의 populateDongFilters 함수 내부를 찾으세요.

dongButtonsContainer.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
        dongButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        selectedMongoDong = this.dataset.dongName;

        // ▼▼▼ 이 부분을 수정하세요 ▼▼▼
        const showAllBtn = document.getElementById('show-all-restaurants-btn');
        showAllBtn.style.display = 'block'; // <-- 이 줄을 추가해야 합니다!

        // 기존 리스너 초기화 및 새 리스너 추가
        showAllBtn.replaceWith(showAllBtn.cloneNode(true)); 
        document.getElementById('show-all-restaurants-btn').addEventListener('click', () => {
            fetchAllRestaurants(selectedMongoDong);
        });
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        updateCategoryList(selectedMongoDong);
    });
});
            }
        } catch (error) {
            console.error("동 필터 로딩 실패:", error);
            dongButtonsContainer.innerHTML = '<p style="color:red;">동 목록 로딩 실패</p>';
        }
    }

    // 트렌드 분석 폼 제출 이벤트
    if (trendForm) {
        trendForm.addEventListener('submit', async function(event) {
            event.preventDefault();
                document.getElementById('all-restaurants-area').style.display = 'none';
        document.getElementById('wordcloud-result-area').style.display = 'block';
    
            const selectedCategories = Array.from(categorySelect.selectedOptions).map(opt => opt.value);

            if (!selectedMongoDong || selectedCategories.length === 0) {
                alert('로딩중....');
                return;
            }
            
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
            renderTopRestaurants(data.top_restaurants, selectedMongoDong);

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

    populateDongFilters();
});