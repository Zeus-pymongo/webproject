document.addEventListener('DOMContentLoaded', function () {
    // 1. 지도 컨테이너 확인
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('HTML에 id="map"인 요소를 찾을 수 없습니다.');
        return;
    }

    // 2. 네이버 지도 API 로드 확인
    if (typeof naver === 'undefined' || typeof naver.maps === 'undefined') {
        console.error('네이버 지도 API가 로드되지 않았습니다. Client ID를 확인하거나 네트워크 연결을 확인하세요.');
        mapElement.innerHTML = '<div style="padding:20px; text-align:center;">지도 로딩 실패<br>Client ID 또는 네트워크를 확인하세요.</div>';
        return;
    }

    // 3. 지도 초기화 옵션 설정
    const TAPGOL_LAT_LNG = new naver.maps.LatLng(37.5716, 126.9880);
    const mapOptions = {
        center: TAPGOL_LAT_LNG,
        zoom: 14,
        zoomControl: true,
        zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT
        }
    };

    // 4. 지도 생성
    const map = new naver.maps.Map(mapElement, mapOptions);

    // 5. 지도 제어 버튼 이벤트 리스너 추가
    const resetBtn = document.getElementById('reset-view-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            map.setCenter(TAPGOL_LAT_LNG);
            map.setZoom(14);
        });
    }

    // 6. 유동인구 시각화 모달 관련
    const modalBtn = document.getElementById('show-movement-modal');
    const analysisModal = document.getElementById('analysisModal');
    const modalClose = document.getElementById('modal-close');
    const modalForm = document.getElementById('analysis-form-modal');
    let drawnPolylines = []; // 지도에 그려진 모든 선을 저장할 배열

    // 지도에 그려진 모든 선을 지우는 함수
    function clearPolylines() {
        drawnPolylines.forEach(polyline => {
            polyline.setMap(null);
        });
        drawnPolylines = [];
    }

    // 유동인구 데이터를 가져와서 지도에 시각화하는 함수
    async function fetchAndDrawMovementData(payload) {
        clearPolylines(); // 새로운 데이터를 그리기 전에 기존 선들 모두 지우기

        try {
            const response = await fetch('/api/movement_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const movementData = await response.json();
            
            if (movementData.error) {
                alert(`오류: ${movementData.error}`);
                return;
            }

            // 
            movementData.forEach(item => {
                const startDong = item.start_region;
                const endDong = item.end_region;
                const movCount = item.total_count;

                if (DONG_COORDS[startDong] && DONG_COORDS[endDong]) {
                    const startPoint = new naver.maps.LatLng(DONG_COORDS[startDong].lat, DONG_COORDS[startDong].lng);
                    const endPoint = new naver.maps.LatLng(DONG_COORDS[endDong].lat, DONG_COORDS[endDong].lng);
                    
                    const strokeWeight = Math.min(Math.max(movCount / 50, 2), 10);
                    
                    const polyline = new naver.maps.Polyline({
                        path: [startPoint, endPoint],
                        strokeColor: '#0056b3',
                        strokeWeight: strokeWeight,
                        strokeOpacity: 0.7,
                        map: map
                    });
                    
                    // 새로 그린 선을 배열에 추가
                    drawnPolylines.push(polyline);
                }
            });
        } catch (error) {
            console.error('유동인구 데이터 로드 실패:', error);
            alert('유동인구 데이터를 가져오는 중 오류가 발생했습니다.');
        }
    }

    // 모달 폼 제출 시 이벤트 리스너 추가
    if (modalForm) {
        modalForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(this);
            const selectedDong = formData.get('start_dong');
            const selectedGender = formData.get('gender');
            const ageGroups = Array.from(document.querySelectorAll('input[name="age_group"]:checked')).map(cb => cb.value);

            const payload = {
                start_dong: selectedDong,
                gender: selectedGender,
                age_groups: ageGroups
            };

            if (!selectedDong) {
                alert('출발 동을 선택해야 합니다.');
                return;
            }

            fetchAndDrawMovementData(payload);
            
            analysisModal.style.display = 'none';
        });
    }

    if (modalBtn) modalBtn.addEventListener('click', () => analysisModal.style.display = 'flex');
    if (modalClose) modalClose.addEventListener('click', () => analysisModal.style.display = 'none');

  const filterTabs = document.querySelectorAll('.filter-tab');
    let currentMarkers = [];

    // 기존 핀(마커)을 모두 지우는 함수
    function clearMarkers() {
        currentMarkers.forEach(marker => {
            marker.setMap(null);
        });
        currentMarkers = [];
    }

    filterTabs.forEach(tab => {
        tab.addEventListener('click', async function() {
            // 현재 활성화된 탭 스타일 제거
            document.querySelector('.filter-tab.active')?.classList.remove('active');
            // 클릭한 탭에 활성화 스타일 추가
            this.classList.add('active');

            const industryType = this.textContent; // "한식", "중식" 등 탭의 텍스트를 가져옴

            clearMarkers(); // 새 데이터를 그리기 전에 기존 마커 모두 지우기

            try {
                const response = await fetch(`/api/restaurants_by_type/${industryType}`);
                const restaurants = await response.json();

                if (response.ok) {
                    // 예시: 받아온 데이터에 좌표가 있다고 가정
                    restaurants.forEach(rest => {
                        if (rest.lat && rest.lng) {
                            const position = new naver.maps.LatLng(rest.lat, rest.lng);
                            const marker = new naver.maps.Marker({
                                map: map,
                                position: position,
                                title: rest.name
                            });
                            currentMarkers.push(marker);
                        }
                    });
                } else {
                    alert(`오류: ${restaurants.error}`);
                }
            } catch (error) {
                console.error('데이터 로드 실패:', error);
                alert('음식점 정보를 가져오지 못했습니다.');
            }
        });
    });
});