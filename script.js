document.addEventListener('DOMContentLoaded', () => {
    // Initialize Map
    const map = L.map('map').setView([-12.04318, -77.02824], 10);

    // Add OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 20
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
            circle: {
                shapeOptions: {
                    color: '#6366f1',
                    fillOpacity: 0.2
                },
                showRadius: true,
                metric: true,
                feet: false,
                nautic: false
            },
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

    // Helper to create a polygon from a circle
    function createCirclePolygon(center, radiusInMeters, sides = 64) {
        const points = [];
        const earthRadius = 6378137; // Earth's radius in meters

        for (let i = 0; i < sides; i++) {
            const angle = (i * 360 / sides) * (Math.PI / 180);
            const dLat = (radiusInMeters / earthRadius) * (180 / Math.PI);
            const dLon = (radiusInMeters / earthRadius) * (180 / Math.PI) / Math.cos(center.lat * Math.PI / 180);

            const pointLat = center.lat + dLat * Math.cos(angle);
            const pointLon = center.lng + dLon * Math.sin(angle);

            points.push([pointLat, pointLon]);
        }
        return points;
    }

    // Event Handlers
    map.on(L.Draw.Event.CREATED, function (e) {
        let layer = e.layer;
        const type = e.layerType;

        // If it's a circle, convert to polygon
        if (type === 'circle') {
            const center = layer.getLatLng();
            const radius = layer.getRadius();
            const polygonPoints = createCirclePolygon(center, radius);

            // Create a new polygon layer
            layer = L.polygon(polygonPoints, {
                color: '#6366f1',
                fillOpacity: 0.2
            });
        }

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

    // --- Search Functionality ---
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const suggestionsList = document.getElementById('search-suggestions');
    let debounceTimer;

    // Debounce utility
    function debounce(func, delay) {
        return function (...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Search API (Nominatim)
    async function searchAddress(query) {
        if (!query || query.length < 3) {
            suggestionsList.classList.remove('visible');
            return;
        }

        // const params = new URLSearchParams({
        //     format: 'json',
        //     q: query,
        //     countrycodes: 'pe',
        //     addressdetails: '4'
        // });

        const params = new URLSearchParams({
            format: 'jsonv2',        // formato más completo
            q: query,
            countrycodes: 'pe',      // Perú
            addressdetails: '1',     // desglose de la dirección
            extratags: '1',          // tags extra si existen
            namedetails: '1',        // nombres alternativos
            polygon_geojson: '1',    // geometría en GeoJSON
            limit: '6',             // número máx. de resultados
            'accept-language': 'es'  // priorizar español
        });

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
            const results = await response.json();
            renderSuggestions(results);
        } catch (error) {
            console.error('Error searching address:', error);
        }
    }

    // Render suggestions
    function renderSuggestions(results) {
        suggestionsList.innerHTML = '';
        if (results.length === 0) {
            suggestionsList.classList.remove('visible');
            return;
        }

        results.forEach(result => {
            const li = document.createElement('li');
            li.className = 'suggestion-item';
            li.textContent = result.display_name;
            li.addEventListener('click', () => {
                selectLocation(result.lat, result.lon);
            });
            suggestionsList.appendChild(li);
        });

        suggestionsList.classList.add('visible');
    }

    // Select location
    function selectLocation(lat, lon) {
        const latLng = [parseFloat(lat), parseFloat(lon)];
        map.setView(latLng, 16);
        suggestionsList.classList.remove('visible');
        searchInput.value = ''; // Optional: clear input or keep it
    }

    // Input event listener
    searchInput.addEventListener('input', debounce((e) => {
        searchAddress(e.target.value);
    }, 300));

    // Button click listener (select first result)
    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value;
        if (!query) return;

        // If suggestions are already there, pick the first one
        if (suggestionsList.children.length > 0) {
            suggestionsList.children[0].click();
        } else {
            // Otherwise perform a search and pick first
            try {
                const params = new URLSearchParams({
                    format: 'json',
                    q: query,
                    countrycodes: 'pe'
                });
                const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
                const results = await response.json();
                if (results.length > 0) {
                    selectLocation(results[0].lat, results[0].lon);
                }
            } catch (error) {
                console.error('Error searching address:', error);
            }
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            suggestionsList.classList.remove('visible');
        }
    });

});
