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

    // --- 4. 상권 분석 모달 기능 ---
    const analysisModal = document.getElementById('analysisModal');
    const modalOpenBtn = document.getElementById('show-analysis-modal');
    const modalCloseBtn = document.getElementById('analysis-modal-close');
    
    // 각 단계의 화면과 버튼 요소들을 가져옴
    const modalSteps = document.querySelectorAll('.modal-step');
    const floorBtns = document.querySelectorAll('.floor-btn');
    const scaleBtns = document.querySelectorAll('.scale-btn');
    const typeBtns = document.querySelectorAll('.type-btn'); // 3단계 버튼 추가
    const restartBtn = document.getElementById('restart-analysis-btn'); // 다시하기 버튼 추가
    
    // 선택된 값들을 저장할 객체
    let analysisSelections = {
        floor: null,
        scale: null,
        type: null // type 속성 추가
    };

    // '상권분석' 버튼 클릭 -> 모달 열기 및 초기화
    if (modalOpenBtn) {
        modalOpenBtn.addEventListener('click', () => {
            analysisSelections = { floor: null, scale: null, type: null };
            analysisModal.style.display = 'flex';
            showStep(1); // 항상 1단계부터 시작
        });
    }

    // 닫기(X) 버튼 클릭 / 모달 바깥 영역 클릭 -> 모달 닫기
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => { analysisModal.style.display = 'none'; });
    }
    window.addEventListener('click', (event) => {
        if (event.target == analysisModal) {
            analysisModal.style.display = 'none';
        }
    });

    // 1단계: 층수 선택
    floorBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            analysisSelections.floor = this.dataset.value;
            console.log("현재 선택:", analysisSelections);
            showStep(2); // 2단계로 이동
        });
    });
    
    // 2단계: 규모 선택
    scaleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            analysisSelections.scale = this.dataset.value;
            console.log("현재 선택:", analysisSelections);
            showStep(3); // [수정] 3단계(업태 선택)로 이동
        });
    });

    // [★★★★★ 추가된 부분 ★★★★★]
    // 3단계: 업태 선택
     typeBtns.forEach(btn => {
        btn.addEventListener('click', async function() { // async 키워드 추가
            analysisSelections.type = this.dataset.value;
            console.log("최종 선택값:", analysisSelections);
            
            showStep(4); // 결과창 먼저 보여주기
            
            const resultDiv = document.getElementById('analysis-result');
            resultDiv.innerHTML = '<p>예상 창업 비용을 계산 중입니다...</p>';

            // 백엔드에 최종 비용 계산 요청
            try {
                const response = await fetch('/api/calculate_cost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(analysisSelections)
                });
                const data = await response.json();

                if (response.ok) {
                    // 성공적으로 비용 데이터를 받으면 화면에 표시
                    resultDiv.innerHTML = `
                        <ul style="list-style:none; padding:0; margin:10px 0; text-align:left;">
                            <li><strong>임대료:</strong> ${data.rent_cost.toLocaleString()} 원</li>
                            <li><strong>구매 비용(물품, 장비 등):</strong> ${data.purchase_cost.toLocaleString()} 원</li>
                            <li><strong>기타 비용(인테리어 등):</strong> ${data.etc_cost.toLocaleString()} 원</li>
                        </ul>
                        <hr>
                        <h3 style="margin-top:20px;">총 예상 비용: ${data.total_cost.toLocaleString()} 원</h3>
                    `;
                } else {
                    resultDiv.innerHTML = `<p style="color:red;">비용 계산 실패: ${data.error}</p>`;
                }
            } catch (error) {
                console.error("비용 계산 API 호출 오류:", error);
                resultDiv.innerHTML = `<p style="color:red;">서버와 통신 중 오류가 발생했습니다.</p>`;
            }
        });
    });
    // '처음부터 다시하기' 버튼 이벤트
    if(restartBtn) {
        restartBtn.addEventListener('click', () => {
            showStep(1);
        });
    }

    // 특정 단계의 모달을 보여주는 함수
    function showStep(stepNumber) {
        modalSteps.forEach(step => {
            step.style.display = 'none';
        });
        const nextStep = document.getElementById(`step${stepNumber}`);
        if(nextStep) {
            nextStep.style.display = 'block';
        }
    }
});