// OpenUp-style Business Analysis Platform
(function() {
    'use strict';

    let map;
    let businessMarkers = [];
    let currentIndustry = 'all';
    let selectedArea = null;
    let drawingMode = null;

    const businessData = [
        { name: '경복궁 카페', type: 'food', lat: 37.579617, lng: 126.977041, revenue: 15000000, employees: 3 },
        { name: '북촌 한옥마을 식당', type: 'food', lat: 37.582604, lng: 126.983998, revenue: 25000000, employees: 5 },
        { name: '광장시장 빈대떡집', type: 'food', lat: 37.570217, lng: 127.002399, revenue: 8000000, employees: 2 },
        { name: '청계천 카페거리', type: 'food', lat: 37.569102, lng: 126.989655, revenue: 12000000, employees: 4 },
        { name: '광화문광장 레스토랑', type: 'food', lat: 37.571565, lng: 126.977305, revenue: 30000000, employees: 8 },
        { name: '종로 전통시장', type: 'retail', lat: 37.570500, lng: 126.995000, revenue: 18000000, employees: 6 },
        { name: '북촌 기념품샵', type: 'retail', lat: 37.583000, lng: 126.984500, revenue: 6000000, employees: 2 },
        { name: '경복궁 기념품점', type: 'retail', lat: 37.580000, lng: 126.978000, revenue: 10000000, employees: 3 },
        { name: '종로구청', type: 'service', lat: 37.573500, lng: 126.978000, revenue: 0, employees: 50 },
        { name: '한국은행', type: 'service', lat: 37.563000, lng: 126.980000, revenue: 0, employees: 200 },
        { name: '종로구 보건소', type: 'service', lat: 37.575000, lng: 126.985000, revenue: 0, employees: 30 },
        { name: '종로구 문화센터', type: 'entertainment', lat: 37.572000, lng: 126.990000, revenue: 5000000, employees: 10 },
        { name: '청계천 공연장', type: 'entertainment', lat: 37.568000, lng: 126.988000, revenue: 15000000, employees: 15 },
        { name: '종로구 도서관', type: 'education', lat: 37.574000, lng: 126.992000, revenue: 0, employees: 20 },
        { name: '한국사학원', type: 'education', lat: 37.576000, lng: 126.986000, revenue: 12000000, employees: 8 },
        { name: '종로 호텔', type: 'accommodation', lat: 37.571000, lng: 126.995000, revenue: 50000000, employees: 25 },
        { name: '북촌 게스트하우스', type: 'accommodation', lat: 37.584000, lng: 126.985000, revenue: 20000000, employees: 12 }
    ];

    function init() {
        initMap();
        initEventListeners();
        loadBusinessMarkers();
        updateAnalysisPanel();
    }

    function initMap() {
        map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: true,
            touchZoom: true,
            doubleClickZoom: true
        });

        map.setView([37.5725, 126.9794], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        if (map.zoomControl) {
            map.zoomControl.setPosition('topright');
        }
    }

    function initEventListeners() {
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                currentIndustry = this.dataset.industry;
                filterBusinessMarkers();
            });
        });

        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                drawingMode = this.id.replace('-tool', '');
                enableDrawingMode();
            });
        });

        document.getElementById('geolocate-btn').addEventListener('click', geolocate);
        document.getElementById('reset-view-btn').addEventListener('click', resetView);

        document.querySelector('.search-btn').addEventListener('click', performSearch);
        document.querySelector('.search-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        document.querySelectorAll('.legend-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.legend-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterMarkersByLegend(this.textContent);
            });
        });
    }

    function loadBusinessMarkers() {
        businessData.forEach(business => {
            const marker = L.circleMarker([business.lat, business.lng], {
                radius: 8,
                fillColor: getColorByType(business.type),
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });

            marker.businessData = business;
            marker.bindPopup(createBusinessPopup(business));
            marker.addTo(map);
            businessMarkers.push(marker);
        });
    }

    function getColorByType(type) {
        const colors = {
            'food': '#28a745',
            'retail': '#ffc107',
            'service': '#17a2b8',
            'entertainment': '#dc3545',
            'education': '#6f42c1',
            'accommodation': '#fd7e14'
        };
        return colors[type] || '#007bff';
    }

    function createBusinessPopup(business) {
        const revenue = business.revenue > 0 ? 
            `월 예상 매출: ${(business.revenue / 10000).toLocaleString()}만원` : 
            '공공기관';
        
        return `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #333;">${business.name}</h4>
                <p style="margin: 4px 0; color: #666; font-size: 12px;">
                    업종: ${getIndustryName(business.type)}
                </p>
                <p style="margin: 4px 0; color: #666; font-size: 12px;">
                    ${revenue}
                </p>
                <p style="margin: 4px 0; color: #666; font-size: 12px;">
                    직원 수: ${business.employees}명
                </p>
                <button onclick="analyzeBusiness('${business.name}')" 
                        style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 8px;">
                    상세 분석
                </button>
            </div>
        `;
    }

    function getIndustryName(type) {
        const names = {
            'food': '음식',
            'retail': '소매',
            'service': '서비스',
            'entertainment': '오락',
            'education': '교육',
            'accommodation': '숙박'
        };
        return names[type] || '기타';
    }

    function filterBusinessMarkers() {
        businessMarkers.forEach(marker => {
            if (currentIndustry === 'all' || marker.businessData.type === currentIndustry) {
                marker.setOpacity(1);
                marker.setStyle({ fillOpacity: 0.8 });
            } else {
                marker.setOpacity(0.3);
                marker.setStyle({ fillOpacity: 0.3 });
            }
        });
    }

    function enableDrawingMode() {
        if (map.drawingLayer) {
            map.removeLayer(map.drawingLayer);
        }
        map.drawingLayer = L.layerGroup().addTo(map);

        if (drawingMode === 'circle') {
            enableCircleDrawing();
        } else if (drawingMode === 'rectangle') {
            enableRectangleDrawing();
        } else if (drawingMode === 'polygon') {
            enablePolygonDrawing();
        }
    }

    function enableCircleDrawing() {
        let circle;
        let startLatLng;

        map.on('mousedown', function(e) {
            startLatLng = e.latlng;
        });

        map.on('mousemove', function(e) {
            if (startLatLng) {
                if (circle) {
                    map.drawingLayer.removeLayer(circle);
                }
                const radius = startLatLng.distanceTo(e.latlng);
                circle = L.circle(startLatLng, { radius: radius, color: '#007bff', fillOpacity: 0.1 });
                circle.addTo(map.drawingLayer);
            }
        });

        map.on('mouseup', function(e) {
            if (startLatLng) {
                selectedArea = circle;
                analyzeArea();
                startLatLng = null;
            }
        });
    }

    function enableRectangleDrawing() {
        let rectangle;
        let startLatLng;

        map.on('mousedown', function(e) {
            startLatLng = e.latlng;
        });

        map.on('mousemove', function(e) {
            if (startLatLng) {
                if (rectangle) {
                    map.drawingLayer.removeLayer(rectangle);
                }
                const bounds = L.latLngBounds([startLatLng, e.latlng]);
                rectangle = L.rectangle(bounds, { color: '#007bff', fillOpacity: 0.1 });
                rectangle.addTo(map.drawingLayer);
            }
        });

        map.on('mouseup', function(e) {
            if (startLatLng) {
                selectedArea = rectangle;
                analyzeArea();
                startLatLng = null;
            }
        });
    }

    function enablePolygonDrawing() {
        let polygon;
        let points = [];

        map.on('click', function(e) {
            points.push(e.latlng);
            
            if (polygon) {
                map.drawingLayer.removeLayer(polygon);
            }
            
            if (points.length >= 3) {
                polygon = L.polygon(points, { color: '#007bff', fillOpacity: 0.1 });
                polygon.addTo(map.drawingLayer);
            }
        });

        map.on('dblclick', function() {
            if (points.length >= 3) {
                selectedArea = polygon;
                analyzeArea();
                points = [];
            }
        });
    }

    function analyzeArea() {
        if (!selectedArea) return;

        const bounds = selectedArea.getBounds();
        const businessesInArea = businessMarkers.filter(marker => {
            const latlng = marker.getLatLng();
            return bounds.contains(latlng);
        });

        updateAnalysisPanel(businessesInArea);
    }

    function updateAnalysisPanel(businesses = businessMarkers) {
        const panel = document.getElementById('analysis-panel');
        const totalBusinesses = businesses.length;
        const totalRevenue = businesses.reduce((sum, marker) => sum + marker.businessData.revenue, 0);
        const avgRevenue = totalBusinesses > 0 ? totalRevenue / totalBusinesses : 0;

        panel.innerHTML = `
            <h3>상권 분석</h3>
            <div class="analysis-content">
                <div class="analysis-item">
                    <h4>선택된 지역 정보</h4>
                    <p>총 ${totalBusinesses}개 업체</p>
                    <p>평균 월 매출: ${(avgRevenue / 10000).toLocaleString()}만원</p>
                </div>
                <div class="analysis-item">
                    <h4>업종별 분포</h4>
                    <p>${getIndustryDistribution(businesses)}</p>
                </div>
                <div class="analysis-item">
                    <h4>주거인구 (추정)</h4>
                    <p>반경 600m 내 약 2,500명</p>
                    <p>1인 가구 비율: 35%</p>
                </div>
            </div>
        `;
    }

    function getIndustryDistribution(businesses) {
        const distribution = {};
        businesses.forEach(marker => {
            const type = marker.businessData.type;
            distribution[type] = (distribution[type] || 0) + 1;
        });

        return Object.entries(distribution)
            .map(([type, count]) => `${getIndustryName(type)}: ${count}개`)
            .join(', ');
    }

    function filterMarkersByLegend(selection) {
        businessMarkers.forEach(marker => {
            marker.setOpacity(1);
            marker.setStyle({ fillOpacity: 0.8 });
        });
    }

    function geolocate() {
        if (!navigator.geolocation) {
            alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
            return;
        }

        const btn = document.getElementById('geolocate-btn');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                const userMarker = L.circleMarker([lat, lng], {
                    radius: 10,
                    fillColor: '#dc3545',
                    color: '#fff',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup('<strong>내 위치</strong>').addTo(map);

                map.setView([lat, lng], 16);
                
                btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
                btn.disabled = false;
            },
            function(error) {
                alert('위치를 가져올 수 없습니다: ' + error.message);
                btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
                btn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }

    function resetView() {
        map.setView([37.5725, 126.9794], 14);
        if (selectedArea) {
            map.drawingLayer.removeLayer(selectedArea);
            selectedArea = null;
        }
        updateAnalysisPanel();
    }

    function performSearch() {
        const query = document.querySelector('.search-input').value.trim();
        if (!query) return;

        const results = businessData.filter(business => 
            business.name.toLowerCase().includes(query.toLowerCase())
        );

        if (results.length > 0) {
            const firstResult = results[0];
            map.setView([firstResult.lat, firstResult.lng], 16);
            
            businessMarkers.forEach(marker => {
                if (marker.businessData.name === firstResult.name) {
                    marker.openPopup();
                }
            });
        } else {
            alert('검색 결과가 없습니다.');
        }
    }

    window.analyzeBusiness = function(businessName) {
        const business = businessData.find(b => b.name === businessName);
        if (business) {
            alert(`${businessName} 상세 분석:\n업종: ${getIndustryName(business.type)}\n월 매출: ${(business.revenue / 10000).toLocaleString()}만원\n직원 수: ${business.employees}명`);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
