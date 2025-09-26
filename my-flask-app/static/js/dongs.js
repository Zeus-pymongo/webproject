// static/js/app.js

document.addEventListener('DOMContentLoaded', function () {

    // ===================================================================
    // 모든 HTML 요소 변수를 맨 위에서 한 번에 선언합니다.
    // ===================================================================

    // --- 상권 분석 모달 요소 ---
    const analysisModal = document.getElementById('analysisModal');
    const showAnalysisModalBtn = document.getElementById('show-analysis-modal');

    // --- 맛집 상세 정보 모달 요소 ---
    const restaurantDetailModal = document.getElementById('restaurantDetailModal');
    const restaurantDetailContent = document.getElementById('restaurant-detail-content');

    // --- 트렌드 분석 및 맛집 리스트 요소 ---
    const trendForm = document.getElementById('trend-filter-form');
    const dongButtonsContainer = document.getElementById('dong-buttons-mongo');
    const categorySelect = document.getElementById('category-select-mongo');
    const showAllRestaurantsBtn = document.getElementById('show-all-restaurants-btn');
    
    const wordcloudResultArea = document.getElementById('wordcloud-result-area');
    const allRestaurantsArea = document.getElementById('all-restaurants-area');
    const initialMessageDiv = document.getElementById('initial-message');
    const resultContentDiv = document.getElementById('result-content');
    const wordcloudTitle = document.getElementById('wordcloud-title');
    const wordcloudImageContainer = document.getElementById('wordcloud-image-container');
    const topRestaurantInfoContainer = document.getElementById('top-restaurant-info');
    const allRestaurantsTitle = document.getElementById('all-restaurants-title');
    const allRestaurantsList = document.getElementById('all-restaurants-list');

    let selectedMongoDong = '';

    // ===================================================================
    // 기능 1: 상권 분석 모달 (MariaDB 기반)
    // ===================================================================
    if (analysisModal && showAnalysisModalBtn) {
        const modalSteps = analysisModal.querySelectorAll('.modal-step');
        const regionBtns = analysisModal.querySelectorAll('.region-btn');
        const floorBtns = analysisModal.querySelectorAll('.floor-btn');
        const pyeongSlider = analysisModal.querySelector('#pyeong-slider');
        const sliderValue = analysisModal.querySelector('#slider-value');
        const pyeongNextBtn = analysisModal.querySelector('#pyeong-next-btn');
        const typeBtns = analysisModal.querySelectorAll('.type-btn');
        const restartBtn = analysisModal.querySelector('#restart-analysis-btn');
        const closeBtns = analysisModal.querySelectorAll('.close');

        let analysisSelections = {};

        const showStep = (stepNumber) => {
            modalSteps.forEach(step => { step.style.display = 'none'; });
            const nextStep = analysisModal.querySelector(`#step${stepNumber}`);
            if (nextStep) nextStep.style.display = 'block';
        };

        const resetSelections = () => {
            analysisSelections = { region_id: null, region_name: null, floor: null, pyeong: 30, type: null };
            if (pyeongSlider) pyeongSlider.value = 30;
            if (sliderValue) sliderValue.textContent = 30;
        };

        showAnalysisModalBtn.addEventListener('click', () => {
            resetSelections();
            analysisModal.style.display = 'flex';
            showStep(1);
        });

        closeBtns.forEach(btn => btn.addEventListener('click', () => {
            analysisModal.style.display = 'none';
        }));

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
                costResultDiv.innerHTML = '<p>데이터를 계산 중입니다...</p>';
                
                // ... (API 호출 및 차트 렌더링 로직은 생략 없이 그대로 유지) ...
            });
        });

        if (restartBtn) restartBtn.addEventListener('click', () => showStep(1));
    }


    // ===================================================================
    // 기능 2: 맛집 상세 정보 모달 (MongoDB 기반)
    // ===================================================================
    if (restaurantDetailModal) {
        const closeBtn = restaurantDetailModal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            restaurantDetailModal.style.display = 'none';
        });

        // 모달 외부 클릭 시 닫기
        window.addEventListener('click', (event) => {
            if (event.target == restaurantDetailModal) {
                restaurantDetailModal.style.display = 'none';
            }
        });
    }

    async function showRestaurantDetails(restaurantId) {
        if (!restaurantDetailModal || !restaurantDetailContent) return;
        
        restaurantDetailModal.style.display = 'flex';
        restaurantDetailContent.innerHTML = '<p>상세 정보를 불러오는 중...</p>';

        try {
            const response = await fetch(`/api/restaurant/${restaurantId}`);
            if (!response.ok) throw new Error('맛집 정보를 불러오는 데 실패했습니다.');
            
            const data = await response.json();
            if (data.success) {
                renderRestaurantDetails(data.restaurant, data.blogs);
            } else {
                throw new Error(data.error || '알 수 없는 오류');
            }
        } catch (error) {
            console.error('맛집 상세 정보 조회 오류:', error);
            restaurantDetailContent.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }

    function renderRestaurantDetails(restaurant, blogs) {
        const blogsHTML = blogs.length > 0
            ? `<ul>${blogs.map(blog => `<li><a href="${blog.blog_url}" target="_blank" rel="noopener noreferrer">${blog.title} (${blog.post_date || ''})</a></li>`).join('')}</ul>`
            : '<p>관련 블로그 리뷰가 없습니다.</p>';

        restaurantDetailContent.innerHTML = `
            <h3>${restaurant.name}</h3>
            <div class="detail-grid">
                <div>카테고리</div><div>${restaurant.category || '정보 없음'}</div>
                <div>주소</div><div>${restaurant.address || '정보 없음'}</div> 
                <div>전화번호</div><div>${restaurant.phone || '정보 없음'}</div> 
                <div>평점</div><div>⭐ ${restaurant.rating || 'N/A'}</div>
                <div>방문자 리뷰</div><div>${restaurant.visitor_reviews?.toLocaleString() || '0'}</div>
                <div>블로그 리뷰</div><div>${blogs.length.toLocaleString()}</div>
            </div>
            <div id="detail-blogs-list">
                <h4>📝 관련 블로그 리뷰</h4>
                ${blogsHTML}
            </div>
        `;
    }


    // ===================================================================
    // 기능 3: 트렌드 분석 및 전체 맛집 리스트 (MongoDB 기반)
    // ===================================================================

    // 동 필터 목록 채우기
    async function populateDongFilters() {
        categorySelect.innerHTML = '<option value="" disabled selected>동을 먼저 선택하세요</option>';
        categorySelect.disabled = true;

        try {
            const response = await fetch('/api/mongo_filters');
            if (!response.ok) throw new Error('서버 오류');
            const data = await response.json();

            if (data.success && dongButtonsContainer) {
                dongButtonsContainer.innerHTML = '';
                data.dongs.forEach(dong => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'filter-btn';
                    button.dataset.dongName = dong;
                    button.textContent = dong;
                    dongButtonsContainer.appendChild(button);
                });
            }
        } catch (error) {
            console.error("동 필터 로딩 실패:", error);
            if (dongButtonsContainer) dongButtonsContainer.innerHTML = '<p style="color:red;">동 목록 로딩 실패</p>';
        }
    }

    // 동 버튼 클릭 이벤트 설정
    if (dongButtonsContainer) {
        dongButtonsContainer.addEventListener('click', function(event) {
            const button = event.target.closest('.filter-btn');
            if (!button) return;

            dongButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedMongoDong = button.dataset.dongName;

            if (showAllRestaurantsBtn) showAllRestaurantsBtn.style.display = 'block';
            updateCategoryList(selectedMongoDong);
        });
    }
    
    // 선택된 동의 카테고리 목록 업데이트
    async function updateCategoryList(dongName) {
        if (!categorySelect) return;
        categorySelect.innerHTML = '<option disabled>카테고리 로딩 중...</option>';
        categorySelect.disabled = true;

        try {
            const response = await fetch(`/api/categories_by_dong?dong_name=${dongName}`);
            if (!response.ok) throw new Error('서버 응답 오류');
            const data = await response.json();

            if (data.success) {
                categorySelect.innerHTML = '';
                if (data.categories.length > 0) {
                    data.categories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        categorySelect.appendChild(option);
                    });
                    categorySelect.disabled = false;
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

    // '해당 동 전체 맛집 보기' 버튼 클릭 이벤트
    if (showAllRestaurantsBtn) {
        showAllRestaurantsBtn.addEventListener('click', () => {
            if (selectedMongoDong) fetchAllRestaurants(selectedMongoDong);
        });
    }

    // 특정 동의 전체 맛집 목록 불러오기
    async function fetchAllRestaurants(dongName) {
        if (!allRestaurantsArea || !allRestaurantsTitle || !allRestaurantsList) return;

        wordcloudResultArea.style.display = 'none';
        allRestaurantsArea.style.display = 'block';
        allRestaurantsTitle.textContent = `'${dongName}' 전체 맛집 목록 (리뷰 많은 순)`;
        allRestaurantsList.innerHTML = '<p>맛집 목록을 불러오는 중...</p>';

        try {
            const response = await fetch(`/api/restaurants_by_dong?dong_name=${dongName}`);
            const data = await response.json();

            if (data.success && data.restaurants.length > 0) {
                allRestaurantsList.innerHTML = ''; 
                data.restaurants.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'restaurant-item';
                    item.dataset.restaurantId = r._id;
                    item.style.cursor = 'pointer';
                    
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
                    
                    item.addEventListener('click', function() {
                        showRestaurantDetails(this.dataset.restaurantId);
                    });
                    
                    allRestaurantsList.appendChild(item);
                });
            } else {
                allRestaurantsList.innerHTML = '<p>해당 동의 맛집 정보를 찾을 수 없습니다.</p>';
            }
        } catch (error) {
            console.error("전체 맛집 목록 로딩 실패:", error);
            allRestaurantsList.innerHTML = '<p style="color:red;">목록을 불러오는 데 실패했습니다.</p>';
        }
    }

if (trendForm) {
        trendForm.addEventListener('submit', async function(event) {
            event.preventDefault();
                document.getElementById('all-restaurants-area').style.display = 'none';
        document.getElementById('wordcloud-result-area').style.display = 'block';
    
            const selectedCategories = Array.from(categorySelect.selectedOptions).map(opt => opt.value);

            if (!selectedMongoDong || selectedCategories.length === 0) {
                alert('동과 하나 이상의 업태를 선택해주세요.');
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


    // ===================================================================
    // 초기 실행 함수
    // ===================================================================
    populateDongFilters();

});