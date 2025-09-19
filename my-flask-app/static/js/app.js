document.addEventListener('DOMContentLoaded', function () {
    // --- 1. 기본 요소 및 지도 초기화 ---
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('HTML에 id="map"인 요소를 찾을 수 없습니다.');
        return;
    }

    if (typeof naver === 'undefined' || typeof naver.maps === 'undefined') {
        mapElement.innerHTML = '<div style="padding:20px; text-align:center;">지도 로딩 실패<br>Client ID 또는 네트워크를 확인하세요.</div>';
        return;
    }

    const TAPGOL_LAT_LNG = new naver.maps.LatLng(37.5716, 126.9880);
    const mapOptions = {
        center: TAPGOL_LAT_LNG,
        zoom: 14,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT }
    };

    const map = new naver.maps.Map(mapElement, mapOptions);
    let currentMarkers = [];

    function clearMarkers() {
        currentMarkers.forEach(marker => marker.setMap(null));
        currentMarkers = [];
    }

    // --- 2. 사이드바 필터링 기능 ---
    const restaurantFilterForm = document.getElementById('restaurant-filter-form');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const dongSelect = document.getElementById('dong-select');

    // 업태 버튼 클릭 시 'active' 클래스 관리
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // '음식점 핀으로 표시' 버튼 제출 시 서버에 데이터 요청
    if (restaurantFilterForm) {
        restaurantFilterForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const selectedRegionId = dongSelect.value;
            const activeButton = document.querySelector('.filter-tab.active');
            
            if (!selectedRegionId) {
                alert("동을 선택해주세요.");
                return;
            }
            if (!activeButton) {
                alert("업태를 선택해주세요.");
                return;
            }

            const selectedTypeName = activeButton.dataset.typeName;

            clearMarkers();

            try {
                const response = await fetch('/api/restaurants_by_filter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        region_id: selectedRegionId,
                        type_name: selectedTypeName
                    })
                });
                const restaurants = await response.json();

                if (response.ok) {
                    if (restaurants.length === 0) {
                        alert("해당 조건의 음식점을 찾을 수 없습니다.");
                        return;
                    }

                    const bounds = new naver.maps.LatLngBounds();

                    restaurants.forEach(rest => {
                        if (rest.lat && rest.lng) {
                            const position = new naver.maps.LatLng(rest.lat, rest.lng);
                            const marker = new naver.maps.Marker({
                                map: map,
                                position: position,
                                title: rest.name
                            });
                            currentMarkers.push(marker);
                            bounds.extend(position);
                        }
                    });
                    
                    if (currentMarkers.length > 0) {
                        map.fitBounds(bounds);
                    }

                } else {
                    alert(`오류: ${restaurants.error || '데이터를 불러오지 못했습니다.'}`);
                }
            } catch (error) {
                console.error('데이터 로드 실패:', error);
                alert('음식점 정보를 가져오는 중 오류가 발생했습니다.');
            }
        });
    }

    // --- 3. 지도 제어 버튼 (초기화, 현재위치) ---
    const resetBtn = document.getElementById('reset-view-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            map.setCenter(TAPGOL_LAT_LNG);
            map.setZoom(14);
        });
    }

    const geolocateBtn = document.getElementById('geolocate-btn');
    if (geolocateBtn) {
        geolocateBtn.addEventListener('click', function () {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    const currentLocation = new naver.maps.LatLng(position.coords.latitude, position.coords.longitude);
                    map.setCenter(currentLocation);
                    map.setZoom(16);
                }, function(error) {
                    console.error("Geolocation 오류:", error);
                    alert("현재 위치를 가져올 수 없습니다.");
                });
            } else {
                alert("이 브라우저는 위치 정보 기능을 지원하지 않습니다.");
            }
        });
    }

// app.js의 상권 분석 모달 기능 부분을 아래 코드로 교체

// --- 4. 상권 분석 모달 기능 ---
const analysisModal = document.getElementById('analysisModal');
const modalOpenBtn = document.getElementById('show-analysis-modal');
const modalCloseBtn = document.getElementById('analysis-modal-close');

const modalSteps = document.querySelectorAll('.modal-step');
const regionBtns = document.querySelectorAll('.region-btn');
const floorBtns = document.querySelectorAll('.floor-btn');
const pyeongSlider = document.getElementById('pyeong-slider');
const sliderValue = document.getElementById('slider-value');
const pyeongNextBtn = document.getElementById('pyeong-next-btn');
const typeBtns = document.querySelectorAll('.type-btn');
const restartBtn = document.getElementById('restart-analysis-btn');

let analysisSelections = { region_id: null, floor: null, pyeong: 30, type: null };

if (modalOpenBtn) {
    modalOpenBtn.addEventListener('click', () => {
        analysisSelections = { region_id: null, floor: null, pyeong: 30, type: null };
        pyeongSlider.value = 30;
        sliderValue.textContent = 30;
        analysisModal.style.display = 'flex';
        showStep(1);
    });
}
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => { analysisModal.style.display = 'none'; });
}
window.addEventListener('click', (e) => {
    if (e.target == analysisModal) analysisModal.style.display = 'none';
});

// 1단계: 지역 선택
regionBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        analysisSelections.region_id = this.dataset.value;
        showStep(2);
    });
});
// 2단계: 층수 선택
floorBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        analysisSelections.floor = this.dataset.value;
        showStep(3);
    });
});
// 3단계: 평수 선택 (슬라이더)
pyeongSlider.addEventListener('input', function() {
    sliderValue.textContent = this.value;
    analysisSelections.pyeong = this.value;
});
pyeongNextBtn.addEventListener('click', () => {
    showStep(4);
});
// 4단계: 업태 선택 및 최종 계산
typeBtns.forEach(btn => {
    btn.addEventListener('click', async function() {
        analysisSelections.type = this.dataset.value;
        showStep(5);
        
        const resultDiv = document.getElementById('analysis-result');
        resultDiv.innerHTML = '<p>상권 분석 및 비용 계산 중입니다...</p>';

        try {
            const response = await fetch('/api/calculate_cost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(analysisSelections)
            });
            const data = await response.json();

            if (response.ok) {
                const formatKRW = (num) => Math.round(num).toLocaleString('ko-KR');
                resultDiv.innerHTML = `
                    <div style="text-align: left;">
                        <h4>비용 분석 (월 기준)</h4>
                        <ul style="list-style:none; padding:0; margin:10px 0; font-size: 14px;">
                            <li><strong>- 임차료:</strong> ${formatKRW(data.costs.rent.total)} 원
                                <small style="display:block; color:#666; padding-left:15px;">
                                (평균 ${data.costs.rent.pyeong.toFixed(1)}평 × 평당 ${formatKRW(data.costs.rent.per_pyeong)}원)
                                </small>
                            </li>
                            <li><strong>- 시설/구매 비용:</strong> ${formatKRW(data.costs.purchase)} 원</li>
                            <li><strong>- 업태별 초기 투자금:</strong> ${formatKRW(data.costs.invest)} 원</li>
                        </ul>
                    </div>
                    <hr style="margin: 15px 0;">
                    <h3 style="text-align:center; margin-top:15px;">
                        초기 총 예상 비용:
                        <span style="color: #007bff;">${formatKRW(data.costs.total)} 원</span>
                    </h3>
                `;
            } else {
                resultDiv.innerHTML = `<p style="color:red;">분석 실패: ${data.error}</p>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<p style="color:red;">서버와 통신 중 오류가 발생했습니다.</p>`;
        }
    });
});
// 5단계: 다시하기
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        showStep(1);
    });
}
function showStep(stepNumber) {
    modalSteps.forEach(step => { step.style.display = 'none'; });
    const nextStep = document.getElementById(`step${stepNumber}`);
    if(nextStep) { nextStep.style.display = 'block'; }
}
});