document.addEventListener('DOMContentLoaded', () => {
    // Initialize Map
    const map = L.map('map').setView([-12.04318, -77.02824], 10);

    // Add OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 15
    }).addTo(map);

    // FeatureGroup to store editable layers
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize Draw Control
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                    color: '#6366f1',
                    fillOpacity: 0.2
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#6366f1',
                    fillOpacity: 0.2
                }
            },
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    map.addControl(drawControl);

    // UI Elements
    const polygonCountEl = document.getElementById('polygon-count');
    const clearBtn = document.getElementById('clear-btn');

    // State
    let layerCount = 0;

    // Context Menu Logic
    let activeLayer = null;
    const contextMenu = document.getElementById('context-menu');
    const copyBtn = document.getElementById('copy-wkt');
    const deleteBtn = document.getElementById('delete-layer');

    // Close menu on global click
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    // Prevent menu closing when clicking inside
    contextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Delete Action
    deleteBtn.addEventListener('click', () => {
        if (!activeLayer) return;
        drawnItems.removeLayer(activeLayer);
        contextMenu.style.display = 'none';
        updateStats();
    });

    // Copy Action
    copyBtn.addEventListener('click', () => {
        if (!activeLayer) return;

        const latlngs = activeLayer.getLatLngs()[0];
        if (!latlngs) return;

        const coords = [...latlngs, latlngs[0]];
        const coordString = coords.map(ll => `${ll.lng} ${ll.lat}`).join(', ');
        const wkt = `POLYGON((${coordString}))`;

        navigator.clipboard.writeText(wkt).then(() => {
            // Show checkmark
            copyBtn.classList.add('copied');

            // Close after delay
            setTimeout(() => {
                contextMenu.style.display = 'none';
                copyBtn.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Error al copiar', err);
        });
    });

    // Event Handlers
    map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);

        // Add right-click event to show custom menu
        layer.on('contextmenu', function (e) {
            L.DomEvent.stopPropagation(e); // Prevent map click
            e.originalEvent.preventDefault(); // Prevent browser menu

            activeLayer = layer; // Store reference

            // Position menu
            const menu = document.getElementById('context-menu');
            menu.style.display = 'block';
            menu.style.left = e.originalEvent.pageX + 'px';
            menu.style.top = e.originalEvent.pageY + 'px';

            // Reset state
            const menuItem = document.getElementById('copy-wkt');
            menuItem.classList.remove('copied');
        });

        updateStats();
    });

    map.on(L.Draw.Event.DELETED, function (e) {
        updateStats();
    });

    map.on(L.Draw.Event.EDITED, function (e) {
        // No count change
    });

    function updateStats() {
        layerCount = drawnItems.getLayers().length;
        polygonCountEl.textContent = layerCount;
    }

    // Clear All
    clearBtn.addEventListener('click', () => {
        drawnItems.clearLayers();
        updateStats();
    });


});
