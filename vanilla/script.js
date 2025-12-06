document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Initialize Map ---
    const map = L.map('map').setView([-12.04318, -77.02824], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 15
    }).addTo(map);

    // --- 2. Layer Groups ---
    const drawnItems = new L.FeatureGroup(); // Editable Active Layer
    map.addLayer(drawnItems);

    const passiveLayersGroup = new L.LayerGroup(); // Read-only Passive Layers
    map.addLayer(passiveLayersGroup);

    // --- 3. State ---
    const layers = [];
    let activeLayerId = null;
    let selectedLayers = new Set();
    let layerCount = 0;

    // Project State
    let currentProjectId = null;
    let projectsConfig = [];
    let currentUser = null; // Set by auth.js

    // --- 4. Draw Control ---
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: '#6366f1', fillOpacity: 0.2 } },
            rectangle: { shapeOptions: { color: '#6366f1', fillOpacity: 0.2 } },
            circle: false, circlemarker: false, marker: false, polyline: false
        },
        edit: { featureGroup: drawnItems, remove: true, edit: true }
    });
    map.addControl(drawControl);

    // --- 5. UI Elements ---
    const polygonCountEl = document.getElementById('polygon-count');
    const clearBtn = document.getElementById('clear-btn');
    const polygonListEl = document.getElementById('polygon-list');

    // Layers UI
    const layersListEl = document.getElementById('layers-list');
    const addLayerBtn = document.getElementById('add-layer-btn');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const csvFileInput = document.getElementById('csv-file-input');

    // Context Menu
    const contextMenu = document.getElementById('context-menu');
    const copyBtn = document.getElementById('copy-wkt');
    const deleteBtn = document.getElementById('delete-layer');
    const subtractBtn = document.getElementById('subtract-poly');
    const editBtn = document.getElementById('edit-layer');
    let activeLayer = null; // Layer interacting with context menu

    // WKT Modal
    const wktModal = document.getElementById('wkt-modal');
    const wktInput = document.getElementById('wkt-input');
    const importWktBtn = document.getElementById('import-wkt-btn');
    const confirmWktBtn = document.getElementById('confirm-wkt');
    const cancelWktBtn = document.getElementById('cancel-wkt');

    // Project UI
    const shareBtn = document.getElementById('share-project-btn');
    const newProjectBtn = document.getElementById('new-project-btn');
    const projectListContainer = document.getElementById('project-list-container');
    const currentProjectDisplay = document.getElementById('current-project-display');
    const currentProjectName = document.getElementById('current-project-name');

    // --- 6. Helper Functions ---

    function generateColor() {
        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function updateStats() {
        // Update feature count in active layer logic
        const activeL = layers.find(l => l.id === activeLayerId);
        if (activeL) {
            // Sync memory
            activeL.features = drawnItems.toGeoJSON();
            layerCount = drawnItems.getLayers().length;
        } else {
            layerCount = 0;
        }
        polygonCountEl.textContent = layerCount;
        renderPolygonList();
    }

    // --- 7. Layer Management ---

    function createLayer(name, features = null) {
        return {
            id: 'layer_' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: name || `Capa ${layers.length + 1}`,
            visible: true,
            features: features || { type: "FeatureCollection", features: [] }
        };
    }

    function setActiveLayer(id) {
        // Save state of current before switching
        if (activeLayerId) {
            const current = layers.find(l => l.id === activeLayerId);
            if (current) current.features = drawnItems.toGeoJSON();
        }

        activeLayerId = id;

        // Clear Map
        drawnItems.clearLayers();
        passiveLayersGroup.clearLayers();
        selectedLayers.clear();

        // Render Layers
        layers.forEach(layer => {
            if (!layer.visible) return;

            if (layer.id === activeLayerId) {
                // Active Layer -> Editable
                L.geoJSON(layer.features, {
                    onEachFeature: function (feature, l) {
                        l.setStyle({ color: '#6366f1', fillOpacity: 0.2 });
                        if (feature.properties) l.feature = feature;
                        drawnItems.addLayer(l);
                        setupLayerEvents(l);
                    }
                });
            } else {
                // Passive Layer -> Read-only
                L.geoJSON(layer.features, {
                    style: { color: '#94a3b8', fillOpacity: 0.1, weight: 2, dashArray: '5,5' },
                    onEachFeature: function (feature, l) {
                        l.bindPopup(`<b>${layer.name}</b><br>${feature.properties?.name || 'Polígono'}`);
                    }
                }).addTo(passiveLayersGroup);
            }
        });

        renderLayersList();
        updateStats();
    }

    function toggleLayerVisibility(id) {
        const layer = layers.find(l => l.id === id);
        if (layer) {
            layer.visible = !layer.visible;
            setActiveLayer(activeLayerId); // Re-render all
            saveChanges();
        }
    }

    function renderLayersList() {
        layersListEl.innerHTML = '';
        layers.forEach(layer => {
            const li = document.createElement('li');
            li.className = `layer-item ${layer.id === activeLayerId ? 'active' : ''}`;

            const iconEye = layer.visible ? '<circle cx="12" cy="12" r="3"></circle>' : '<line x1="1" y1="1" x2="23" y2="23"></line>';
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconEye}</svg>`;

            li.innerHTML = `<div class="layer-visibility ${layer.visible ? '' : 'hidden'}">${svg}</div><span class="layer-name">${layer.name}</span>`;

            li.querySelector('.layer-visibility').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLayerVisibility(layer.id);
            });

            li.addEventListener('click', () => {
                if (layer.id !== activeLayerId) setActiveLayer(layer.id);
            });
            layersListEl.appendChild(li);
        });
    }

    addLayerBtn.addEventListener('click', () => {
        const name = prompt("Nombre de nueva capa:", `Capa ${layers.length + 1}`);
        if (name) {
            const newL = createLayer(name);
            layers.push(newL);
            setActiveLayer(newL.id);
            saveChanges();
        }
    });

    // --- 8. CSV Import ---

    importCsvBtn.addEventListener('click', () => csvFileInput.click());

    csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            processCSV(evt.target.result, file.name.replace('.csv', ''));
            csvFileInput.value = '';
        };
        reader.readAsText(file);
    });

    function processCSV(text, filename) {
        // console.log("Raw CSV:", text);
        const lines = text.split(/\r\n|\n/);
        if (lines.length < 2) {
            alert("El archivo CSV parece vacío o no tiene datos.");
            return;
        }

        const headers = lines[0].split(','); // Naive header split
        // console.log("Headers:", headers);

        const wktIndex = headers.findIndex(h => h.toLowerCase().includes('wkt'));
        const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('nombre'));

        if (wktIndex === -1) {
            alert("Error: No se encontró la columna 'WKT' en la primera fila. Cabeceras encontradas: " + headers.join(', '));
            return;
        }

        const newFeatures = { type: "FeatureCollection", features: [] };
        let count = 0;
        let errors = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            // Regex for CSV split handling quotes
            const matches = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
            if (!matches) {
                console.warn("Skipping line " + i + ": No match");
                continue;
            }

            const cols = matches.map(m => m.replace(/^,/, '').replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"'));

            const wkt = cols[wktIndex];
            const name = (nameIndex !== -1 && cols[nameIndex]) ? cols[nameIndex] : `Item ${i}`;

            if (!wkt) {
                console.warn("Line " + i + ": Empty WKT column");
                errors++;
                continue;
            }

            try {
                const geometry = wktToGeoJSON(wkt);
                if (geometry) {
                    newFeatures.features.push({
                        type: "Feature",
                        properties: { name: name },
                        geometry: geometry
                    });
                    count++;
                } else {
                    console.warn("Line " + i + ": Failed to convert WKT", wkt);
                    errors++;
                }
            } catch (e) {
                console.warn("Line " + i + " Error: " + e.message);
                errors++;
            }
        }

        if (count > 0) {
            const newLayer = createLayer(filename, newFeatures);
            layers.push(newLayer);
            setActiveLayer(newLayer.id);
            saveChanges();
            alert(`Éxito: Se importaron ${count} polígonos a la capa "${filename}".\n(Errores/Omitidos: ${errors})`);
        } else {
            alert(`No se importó ningún polígono válido.\nErrores encontrados: ${errors}\nVerifica la consola para más detalles.`);
        }
    }

    function wktToGeoJSON(wkt) {
        if (!wkt) return null;
        wkt = wkt.trim();
        const type = wkt.split('(')[0].trim().toUpperCase();
        const content = wkt.substring(wkt.indexOf('(') + 1, wkt.lastIndexOf(')'));
        // Flatten
        const clean = content.replace(/\(/g, '').replace(/\)/g, '');
        const tasks = clean.split(',');
        const coords = tasks.map(t => {
            const [lng, lat] = t.trim().split(/\s+/).map(Number);
            return [lng, lat];
        });

        if (type.includes('POINT')) return { type: 'Point', coordinates: coords[0] };
        if (type.includes('LINESTRING')) return { type: 'LineString', coordinates: coords };
        if (type.includes('POLYGON')) return { type: 'Polygon', coordinates: [coords] };
        return null;
    }

    // --- 9. List & Selection Logic ---

    function renderPolygonList() {
        polygonListEl.innerHTML = '';
        if (drawnItems.getLayers().length === 0) {
            polygonListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b; font-style: italic;">Sin objetos</li>';
            return;
        }

        drawnItems.eachLayer(layer => {
            const id = L.Util.stamp(layer);
            const color = layer.options.color || '#6366f1';
            const name = layer.feature?.properties?.name || `Polígono ${id}`;

            const li = document.createElement('li');
            li.className = `poly-item ${selectedLayers.has(id) ? 'selected' : ''}`;
            li.innerHTML = `
                <div class="color-swatch" style="background-color: ${color}">
                    <input type="color" value="${color}" data-id="${id}" style="opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                </div>
                <span class="poly-name" title="${name}">${name}</span>
                <button class="btn-sm delete-item" data-id="${id}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            `;

            li.querySelector('input[type="color"]').addEventListener('input', (e) => {
                layer.setStyle({ color: e.target.value, fillColor: e.target.value });
                li.querySelector('.color-swatch').style.backgroundColor = e.target.value;
                saveChanges();
            });
            li.querySelector('.delete-item').addEventListener('click', (e) => {
                e.stopPropagation();
                drawnItems.removeLayer(layer);
                updateStats(); saveChanges();
            });
            li.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT' && !e.target.closest('button')) toggleSelection(layer, e.ctrlKey || e.metaKey);
            });
            polygonListEl.appendChild(li);
        });
    }

    function toggleSelection(layer, multi) {
        const id = L.Util.stamp(layer);
        if (!multi) {
            selectedLayers.forEach(sid => {
                if (sid !== id) {
                    const l = drawnItems.getLayer(sid);
                    if (l) l.setStyle({ dashArray: null, weight: 4 });
                    selectedLayers.delete(sid);
                }
            });
        }
        if (selectedLayers.has(id)) {
            selectedLayers.delete(id);
            layer.setStyle({ dashArray: null, weight: 4 });
        } else {
            selectedLayers.add(id);
            layer.setStyle({ dashArray: '10, 10', weight: 4 });
        }
        renderPolygonList();
    }

    // --- 10. Operations & WKT ---

    function parseWKT(wkt) {
        try {
            const geometry = wktToGeoJSON(wkt);
            if (!geometry) throw new Error("Invalid WKT");

            L.geoJSON(geometry, {
                onEachFeature: function (f, l) {
                    l.setStyle({ color: generateColor(), fillOpacity: 0.2 });
                    drawnItems.addLayer(l);
                    setupLayerEvents(l);
                }
            });
            updateStats(); saveChanges();
            map.fitBounds(drawnItems.getBounds());

        } catch (e) { alert("Error WKT: " + e.message); }
    }

    importWktBtn.addEventListener('click', () => { wktModal.style.display = 'flex'; wktInput.focus(); });
    cancelWktBtn.addEventListener('click', () => { wktModal.style.display = 'none'; wktInput.value = ''; });
    confirmWktBtn.addEventListener('click', () => {
        if (wktInput.value.trim()) { parseWKT(wktInput.value.trim()); wktModal.style.display = 'none'; wktInput.value = ''; }
    });

    function subtractPolygons(subj, clip) {
        try {
            const sG = subj.toGeoJSON();
            const cG = clip.toGeoJSON();
            const diff = turf.difference(sG, cG);
            if (!diff) { alert("Sin resultado"); return; }

            const newL = L.geoJSON(diff, { style: { color: subj.options.color, fillOpacity: 0.2 } }).getLayers()[0];
            drawnItems.removeLayer(subj);
            drawnItems.addLayer(newL);
            setupLayerEvents(newL);
            updateStats(); saveChanges(); contextMenu.style.display = 'none';
        } catch (e) { console.error(e); alert("Error en resta"); }
    }

    function setupLayerEvents(layer) {
        layer.on('contextmenu', (e) => {
            L.DomEvent.stopPropagation(e); e.originalEvent.preventDefault();
            activeLayer = layer;
            const id = L.Util.stamp(layer);

            // Logic for showing subtract
            subtractBtn.style.display = (selectedLayers.size === 2 && selectedLayers.has(id)) ? 'flex' : 'none';

            contextMenu.style.display = 'block';
            contextMenu.style.left = e.originalEvent.pageX + 'px';
            contextMenu.style.top = e.originalEvent.pageY + 'px';
            copyBtn.classList.remove('copied');
        });
        layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            toggleSelection(layer, e.originalEvent.ctrlKey || e.originalEvent.metaKey);
        });
    }

    // --- 11. Project Logic ---

    window.loadUserProjects = async function (uid) {
        if (!uid) return;
        currentUser = { uid };
        projectListContainer.innerHTML = '<div>Cargando...</div>';
        const pros = await getUserProjects(uid);
        projectsConfig = pros;
        renderProjectList(pros);
        if (!currentProjectId && pros.length > 0) loadProject(pros[0].id, pros[0]);
    };

    function renderProjectList(projects) {
        projectListContainer.innerHTML = '';
        if (projects.length === 0) {
            projectListContainer.innerHTML = '<div>No hay proyectos</div>';
            return;
        }
        projects.forEach(p => {
            const d = document.createElement('div');
            d.className = 'project-item';
            d.innerText = p.name;
            d.style.cssText = 'padding:8px; cursor:pointer; border-bottom:1px solid #eee;';
            d.onclick = () => { loadProject(p.id, p); projectListContainer.style.display = 'none'; };
            projectListContainer.appendChild(d);
        });
    }

    async function loadProject(id, data) {
        currentProjectId = id;
        currentProjectName.innerText = data.name;
        currentProjectData = data;

        // Migrate legacy
        if (data.polygons && !data.layers) {
            layers.length = 0;
            const feats = Array.isArray(data.polygons) ? data.polygons : data.polygons.features || [];
            layers.push({ id: 'def', name: 'Base', visible: true, features: { type: "FeatureCollection", features: feats } });
        } else if (data.layers) {
            layers.length = 0;
            data.layers.forEach(l => layers.push(JSON.parse(JSON.stringify(l))));
        } else {
            layers.length = 0;
            layers.push(createLayer("Capa 1"));
        }

        setActiveLayer(layers[0].id);

        // Permissions
        const isOwner = currentUser && (data.ownerId === currentUser.uid);
        shareBtn.style.display = isOwner ? 'flex' : 'none';
        addLayerBtn.style.display = isOwner ? 'block' : 'none';
        importCsvBtn.style.display = isOwner ? 'block' : 'none';

        const toolbar = document.querySelector('.leaflet-draw-toolbar-top');
        if (toolbar) toolbar.style.display = isOwner ? 'block' : 'none';
        const toolbar2 = document.querySelector('.leaflet-draw-toolbar-bottom');
        if (toolbar2) toolbar2.style.display = isOwner ? 'block' : 'none';
    }

    async function saveChanges() {
        if (!currentProjectId || !currentUser) return;
        const active = layers.find(l => l.id === activeLayerId);
        if (active) active.features = drawnItems.toGeoJSON();
        try { await saveProjectLayers(currentProjectId, layers); } catch (e) { console.error(e); }
    }

    newProjectBtn.addEventListener('click', async () => {
        const n = prompt("Nombre:", "Nuevo " + new Date().toLocaleDateString());
        if (n && currentUser) {
            try {
                const p = await createProject(n, currentUser.uid);
                loadProject(p.id, { name: n, layers: [] });
                loadUserProjects(currentUser.uid);
            } catch (e) { alert(e.message); }
        }
    });

    currentProjectDisplay.addEventListener('click', () => {
        const now = projectListContainer.style.display;
        projectListContainer.style.display = (now === 'block') ? 'none' : 'block';
    });

    shareBtn.addEventListener('click', async () => {
        if (!currentProjectId) return;
        const pub = currentProjectData?.isPublic || false;
        if (confirm(`Actualmente: ${pub ? 'PÚBLICO' : 'PRIVADO'}. ¿Cambiar?`)) {
            await updateProjectSharing(currentProjectId, !pub);
            currentProjectData.isPublic = !pub;
            if (!pub) prompt("Link:", location.href + "?project=" + currentProjectId);
        }
    });

    // --- 12. Global Listeners ---

    map.on(L.Draw.Event.CREATED, (e) => {
        drawnItems.addLayer(e.layer);
        setupLayerEvents(e.layer);
        updateStats(); saveChanges();
    });
    map.on(L.Draw.Event.DELETED, () => { selectedLayers.clear(); updateStats(); saveChanges(); });
    map.on(L.Draw.Event.EDITED, () => saveChanges());

    contextMenu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => { contextMenu.style.display = 'none'; projectListContainer.style.display = 'none'; });

    deleteBtn.addEventListener('click', () => {
        if (activeLayer) { drawnItems.removeLayer(activeLayer); contextMenu.style.display = 'none'; updateStats(); saveChanges(); }
    });

    copyBtn.addEventListener('click', () => {
        if (!activeLayer) return;
        const gj = activeLayer.toGeoJSON();
        let co = (gj.geometry.type === 'Polygon') ? gj.geometry.coordinates[0] : gj.geometry.coordinates[0][0];
        const wkt = `POLYGON((${co.map(c => `${c[0]} ${c[1]}`).join(', ')}))`;
        navigator.clipboard.writeText(wkt);
        contextMenu.style.display = 'none';
    });

    subtractBtn.addEventListener('click', () => {
        if (!activeLayer || selectedLayers.size !== 2) return;
        const activeId = L.Util.stamp(activeLayer);
        let otherId = [...selectedLayers].find(id => id !== activeId);
        if (otherId) subtractPolygons(activeLayer, drawnItems.getLayer(otherId));
    });

    editBtn.addEventListener('click', () => {
        if (!activeLayer) return;
        if (activeLayer.editing.enabled()) {
            activeLayer.editing.disable();
            editBtn.innerText = 'Editar';
            saveChanges();
        } else {
            activeLayer.editing.enable();
            editBtn.innerText = 'Terminar';
            contextMenu.style.display = 'none';
        }
    });

    clearBtn.addEventListener('click', () => {
        if (confirm("¿Limpiar todo?")) { drawnItems.clearLayers(); saveChanges(); updateStats(); }
    });

});
