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

    // 5. 초기 마커 생성
    const initialMarker = new naver.maps.Marker({
        position: TAPGOL_LAT_LNG,
        map: map
    });

    // 6. 지도 제어 버튼 이벤트 리스너 추가
    const resetBtn = document.getElementById('reset-view-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            map.setCenter(TAPGOL_LAT_LNG);
            map.setZoom(14);
        });
    }

    const geoBtn = document.getElementById('geolocate-btn');
    if (geoBtn) {
        geoBtn.addEventListener('click', function () {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const currentLocation = new naver.maps.LatLng(lat, lng);
                    
                    map.setCenter(currentLocation);
                    map.setZoom(16);

                    new naver.maps.Marker({
                        position: currentLocation,
                        map: map,
                    });

                }, function(error) {
                    console.error("Geolocation 오류:", error);
                    alert("현재 위치를 가져올 수 없습니다.");
                });
            } else {
                alert("이 브라우저는 위치 정보 기능을 지원하지 않습니다.");
            }
        });
    }
    const addressInput = document.getElementById('address-input');
    const searchBtn = document.getElementById('search-address-btn');

    // 검색 함수
    const searchAddress = async () => {
        const address = addressInput.value;
        if (!address) {
            alert('주소를 입력해주세요.');
            return;
        }
        
        // 1. 우리 Flask 서버의 API 엔드포인트 호출
        try {
            const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
            const data = await response.json();

            if (response.ok) {
                // 2. 성공 시, 받은 좌표로 지도 이동 및 마커 생성
                const newCenter = new naver.maps.LatLng(data.lat, data.lng);
                map.setCenter(newCenter);
                map.setZoom(17); // 상세 주소이므로 확대
                
                new naver.maps.Marker({
                    position: newCenter,
                    map: map,
                    title: address // 마커에 마우스를 올리면 주소 표시
                });
                
            } else {
                // 3. 실패 시, 서버가 보낸 오류 메시지 표시
                alert(`주소를 찾을 수 없습니다: ${data.error || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('검색 중 네트워크 오류:', error);
            alert('검색 중 오류가 발생했습니다. 서버 로그를 확인해주세요.');
        }
    };

    // 버튼 클릭 시 검색 함수 실행
    searchBtn.addEventListener('click', searchAddress);

    // Enter 키를 눌러도 검색 함수 실행
    addressInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchAddress();
        }
    });
});