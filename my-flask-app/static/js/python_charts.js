// static/js/python_charts.js

document.addEventListener('DOMContentLoaded', function () {
    // 필요한 HTML 요소들을 가져옵니다.
    const chartModal = document.getElementById('chartAnalysisModal');
    const dongChartBtn = document.getElementById('show-dong-chart-btn');
    const categoryChartBtn = document.getElementById('show-category-chart-btn');
    const chartModalTitle = document.getElementById('chart-modal-title');
    const imageContainer = document.getElementById('image-container');
    
    // 모달 닫기 버튼 설정
    if (chartModal) {
        const closeBtn = chartModal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            chartModal.style.display = 'none';
        });
    }

    // "동별 분석" 버튼: Python 이미지 차트 (기존과 동일)
    if (dongChartBtn) {
        dongChartBtn.addEventListener('click', () => {
            chartModalTitle.textContent = '동별 식당 수 분석';
            fetchAndRenderImage('/api/charts/by_dong');
        });
    }

    // "업태별 분석" 버튼: 새로운 2단계 분석 로직
    if (categoryChartBtn) {
        categoryChartBtn.addEventListener('click', () => {
            // 1단계: 업태 선택 버튼들을 먼저 보여줍니다.
            showCategoryButtons();
        });
    }

    // Python이 생성한 단순 이미지를 표시하는 함수 (동별 분석용)
    async function fetchAndRenderImage(apiUrl) {
        if (!chartModal || !imageContainer) return;
        
        chartModal.style.display = 'flex';
        imageContainer.innerHTML = '<p>차트 이미지를 생성 중입니다...</p>';

        try {
            const response = await fetch(apiUrl);
            const result = await response.json();

            if (result.success) {
                imageContainer.innerHTML = `<img src="data:image/png;base64,${result.image}" alt="분석 차트" style="max-width: 100%; height: auto;">`;
            } else {
                throw new Error(result.error || result.message);
            }
        } catch (error) {
            console.error("이미지 로딩 오류:", error);
            imageContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    // 1단계: 상위 업태 목록을 가져와 버튼으로 표시하는 함수
    async function showCategoryButtons() {
        if (!chartModal || !imageContainer) return;

        chartModal.style.display = 'flex';
        chartModalTitle.textContent = '분석할 업태를 선택하세요 (상위 20개)';
        imageContainer.innerHTML = '<p>업태 목록을 불러오는 중...</p>';

        try {
            const response = await fetch('/api/categories/top');
            const result = await response.json();

            if (result.success && result.categories.length > 0) {
                imageContainer.innerHTML = ''; // 로딩 메시지 제거
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'category-button-grid'; // CSS 스타일링을 위한 클래스
                
                result.categories.forEach(categoryName => {
                    const button = document.createElement('button');
                    button.className = 'option-btn';
                    button.textContent = categoryName;
                    button.dataset.category = categoryName; // 데이터 속성에 카테고리 이름 저장
                    buttonContainer.appendChild(button);
                });
                imageContainer.appendChild(buttonContainer);

            } else {
                throw new Error(result.error || '표시할 업태가 없습니다.');
            }
        } catch (error) {
            console.error("업태 버튼 생성 오류:", error);
            imageContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }
    
    // 2단계: 업태 버튼 클릭 시 해당 업태의 키워드 파이 차트를 요청하는 이벤트 리스너
    if (imageContainer) {
        imageContainer.addEventListener('click', function(event) {
            // 클릭된 요소가 카테고리 버튼일 때만 작동
            if (event.target.classList.contains('option-btn') && event.target.dataset.category) {
                const categoryName = event.target.dataset.category;
                fetchKeywordPieChart(categoryName);
            }
        });
    }

    // 선택된 업태의 키워드 파이 차트 이미지를 서버에 요청하고 표시하는 함수
    async function fetchKeywordPieChart(categoryName) {
        chartModalTitle.textContent = `'${categoryName}' 업태 키워드 분석`;
        imageContainer.innerHTML = `<p>'${categoryName}' 리뷰를 분석하여 파이 차트를 생성하는 중...</p>`;

        try {
            const response = await fetch(`/api/charts/keywords_by_category?category_name=${encodeURIComponent(categoryName)}`);
            const result = await response.json();

            if (result.success) {
                imageContainer.innerHTML = `<img src="data:image/png;base64,${result.image}" alt="${categoryName} 키워드 파이 차트" style="max-width: 100%; height: auto;">`;
            } else {
                throw new Error(result.message || result.error);
            }
        } catch (error) {
            console.error("키워드 파이 차트 로딩 오류:", error);
            imageContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }
});