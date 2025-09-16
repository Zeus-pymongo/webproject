// Leaflet map initialization for 오픈업.index.html
(function initMap() {
    if (typeof L === 'undefined') {
        console.error('Leaflet is not loaded.');
        return;
    }

    var mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.warn('No #map element found.');
        return;
    }

    var TAPGOL = [37.5716, 126.9880]; // 종로구 탑골공원
    var map = L.map('map', {
        center: TAPGOL,
        zoom: 13,
        zoomControl: true
    });
    window.appMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var tapgolMarker = L.marker(TAPGOL).addTo(map);
    tapgolMarker.bindPopup('탑골공원').openPopup();

    // Reset view button
    var resetBtn = document.getElementById('reset-view-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            map.setView(TAPGOL, 13, { animate: true });
        });
    }

    // Geolocate button
    var geoBtn = document.getElementById('geolocate-btn');
    if (geoBtn) {
        geoBtn.addEventListener('click', function () {
            if (!navigator.geolocation) {
                alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
                return;
            }
            map.locate({ setView: true, maxZoom: 15 });
        });
    }

    map.on('locationfound', function (e) {
        L.circleMarker(e.latlng, { radius: 8, color: '#2f66ff' }).addTo(map)
            .bindPopup('현재 위치');
    });

    map.on('locationerror', function () {
        alert('현재 위치를 가져올 수 없습니다.');
    });

    // Dong selection -> recenter map
    var dongCenters = {
        '사직동': [37.5756, 126.9730],
        '삼청동': [37.5870, 126.9830],
        '부암동': [37.5926, 126.9669],
        '평창동': [37.6064, 126.9748],
        '무악동': [37.5750, 126.9580],
        '교남동': [37.5711, 126.9660],
        '가회동': [37.5824, 126.9861],
        '종로1·2·3·4가동': [37.5700, 126.9900],
        '종로5·6가동': [37.5717, 127.0033],
        '이화동': [37.5790, 127.0060],
        '창신동': [37.5740, 127.0150],
        '숭인동': [37.5766, 127.0195],
        '청운효자동': [37.5860, 126.9690],
        '혜화동': [37.5828, 127.0019]
    };
    var currentDongLayer = null;
    var dongSelectSub = document.getElementById('dongSelectSub');
    if (dongSelectSub) {
        dongSelectSub.addEventListener('change', function () {
            var selectedText = dongSelectSub.options[dongSelectSub.selectedIndex].text;
            if (!selectedText) {
                if (currentDongLayer) { map.removeLayer(currentDongLayer); currentDongLayer = null; }
                map.setView(TAPGOL, 13, { animate: true });
                return;
            }
            // If polygon exists, fit to bounds; otherwise fallback
            try {
                var feature = (window.JONGNO_DONGS && window.JONGNO_DONGS.features || []).find(function(f){return f.properties && f.properties.name === selectedText;});
                if (feature) {
                    if (currentDongLayer) { map.removeLayer(currentDongLayer); }
                    currentDongLayer = L.geoJSON(feature, { style: { stroke: false, fillColor: '#2f66ff', fillOpacity: 0.08 } }).addTo(map);
                    var bounds = currentDongLayer.getBounds();
                    map.fitBounds(bounds, { animate: true, padding: [30,30], maxZoom: 15 });
                    return;
                }
            } catch (e) {}
            var center = dongCenters[selectedText] || TAPGOL;
            if (currentDongLayer) { map.removeLayer(currentDongLayer); currentDongLayer = null; }
            map.setView(center, 12, { animate: true });
        });
    }
})();


