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
    const polygonListEl = document.getElementById('polygon-list');

    // State
    let polygons = [];

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

    // Delete Action (Context Menu)
    // Delete Action (Context Menu)
    deleteBtn.addEventListener('click', () => {
        if (!activeLayer) return;

        // 1. Quitar del mapa
        drawnItems.removeLayer(activeLayer);

        // 2. Quitar del array de estado
        polygons = polygons.filter(p => p.layer !== activeLayer);

        // 3. Limpiar referencia y cerrar menú
        activeLayer = null;
        contextMenu.style.display = 'none';

        // 4. Refrescar sidebar
        renderPolygonList();
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
        const id = Date.now().toString(); // Simple ID generation
        layer._leaflet_id = id; // Force ID for easier tracking

        const defaultColor = '#6366f1';
        const name = `Polígono ${polygons.length + 1}`;

        // Add to map
        drawnItems.addLayer(layer);

        // Add to state
        polygons.push({
            id: id,
            layer: layer,
            name: name,
            color: defaultColor
        });

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

        renderPolygonList();
        updateStats();
    });

    map.on(L.Draw.Event.DELETED, function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
            // Remove from state
            polygons = polygons.filter(p => p.layer !== layer);
        });
        renderPolygonList();
        updateStats();
    });

    map.on(L.Draw.Event.EDITED, function (e) {
        // No count change, but maybe update WKT if we were showing it live
    });

    function updateStats() {
        polygonCountEl.textContent = polygons.length;
    }

    function renderPolygonList() {
        polygonListEl.innerHTML = '';

        if (polygons.length === 0) {
            polygonListEl.innerHTML = '<li class="empty-state">No hay polígonos creados</li>';
            return;
        }

        polygons.forEach(poly => {
            const li = document.createElement('li');
            li.className = 'polygon-item';

            // Color Input
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.className = 'polygon-color';
            colorInput.value = poly.color;
            colorInput.addEventListener('input', (e) => {
                const newColor = e.target.value;
                poly.color = newColor;
                poly.layer.setStyle({ color: newColor });
            });

            // Name Input
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'polygon-name';
            nameInput.value = poly.name;
            nameInput.addEventListener('change', (e) => {
                poly.name = e.target.value;
            });

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'polygon-delete';
            deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            deleteBtn.addEventListener('click', () => {
                drawnItems.removeLayer(poly.layer);
                polygons = polygons.filter(p => p.id !== poly.id);
                renderPolygonList();
                updateStats();
            });

            li.appendChild(colorInput);
            li.appendChild(nameInput);
            li.appendChild(deleteBtn);
            polygonListEl.appendChild(li);
        });
    }

    // Clear All
    clearBtn.addEventListener('click', () => {
        drawnItems.clearLayers();
        polygons = [];
        renderPolygonList();
        updateStats();
    });

});
