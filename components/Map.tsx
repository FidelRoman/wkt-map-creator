"use client";

import { useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMap, GeoJSON } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { generateColor, stringifyWKT } from '@/lib/map-utils';
import { Layer } from '@/lib/firebase';

// Fix Leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
    layers: Layer[];
    activeLayerId: string | null;
    onUpdateLayer: (layerId: string, features: any) => void;
    requestDraw?: { type: 'polygon' | 'point', id: number } | null;
    requestFlyTo?: any | null;
    onShowToast?: (message: string) => void;
    selectedIndices?: Set<number>;
    onToggleSelection?: (index: number, multi: boolean) => void;
    onClearSelection?: () => void;
}

function FeatureHandler({ layers, activeLayerId, onUpdateLayer }: MapProps) {
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const map = useMap();

    // Effect to render non-active layers as static GeoJSON/features
    // For simplicity in this migration, passing all layers to FeatureGroup might be tricky if we want to separate them.
    // The original code had one 'drawnItems' for editing and others were just layers.
    // Here we might want to put ONLY the active layer in the EditControl FeatureGroup,
    // and other layers as read-only GeoJSON layers.

    // However, react-leaflet-draw works on a FeatureGroup.
    // Strategy:
    // 1. We render "Other Layers" as standard <GeoJSON> or <Polygon> list (read-only or context menu driven).
    // 2. We render "Active Layer" inside the <FeatureGroup> that has <EditControl>.
    // This allows drawing/editing ONLY on the active layer.

    // BUT `script.js` loaded everything into `drawnItems` but filtered editing?
    // "activeLayer" in script.js meant the single polygon selected? No, "setActiveLayer" set the *current layer container*.
    // "activeLayer" variable in script.js was the clicked polygon.
    // "activeLayerId" in Sidebar is the *Layer Collection* we are editing (e.g. "Capa 1").

    return (
        <>
            {layers.map(layer => {
                if (layer.id === activeLayerId) return null; // Render active layer inside FeatureGroup
                if (!layer.visible) return null;
                // Render other layers read-only
                return (
                    <GeoJSON
                        key={layer.id}
                        data={layer.features}
                        pathOptions={{ color: '#3388ff', fillOpacity: 0.2 }} // Default style, maybe add color to layer model
                    />
                );
            })}
        </>
    );
}

// Wrapper for the Active Layer to enable Drawing
function ActiveLayerEditor({ layers, activeLayerId, onUpdateLayer, requestDraw, requestFlyTo, onShowToast, selectedIndices = new Set(), onToggleSelection, onClearSelection }: MapProps) {
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const [menu, setMenu] = useState<{ x: number, y: number, layer: L.Layer | null, index: number } | null>(null);
    const [editingLayer, setEditingLayer] = useState<L.Layer | null>(null);
    const map = useMap();

    // --- Selection Logic ---
    const toggleSelection = (layer: L.Layer, multi: boolean) => {
        if (!featureGroupRef.current || !onToggleSelection) return;

        const allLayers = featureGroupRef.current.getLayers();
        const index = allLayers.indexOf(layer);

        if (index !== -1) {
            onToggleSelection(index, multi);
        }
    };

    const updateSelectionStyles = () => {
        if (!featureGroupRef.current) return;
        const allLayers = featureGroupRef.current.getLayers();

        allLayers.forEach((l: any, index: number) => {
            if (selectedIndices.has(index)) {
                if (typeof l.setStyle === 'function') {
                    l.setStyle({ dashArray: '10, 10', weight: 4, color: '#f59e0b' });
                }
            } else {
                if (typeof l.setStyle === 'function') {
                    l.setStyle({ dashArray: null, weight: 2, color: l.feature?.properties?.color || '#3388ff' });
                }
            }
        });
    };

    // Re-apply styles when selection changes
    useEffect(() => {
        updateSelectionStyles();
    }, [selectedIndices]); // Re-run when set changes

    // Clear selection on map click
    // Clear selection on map click - DISABLED per user request
    // useEffect(() => { ... }, [map, onClearSelection]);


    // --- Context Menu & Operations ---

    const handleContextMenu = (e: any, layer: L.Layer) => {
        L.DomEvent.stopPropagation(e);
        e.originalEvent.preventDefault();

        let index = -1;
        if (featureGroupRef.current) {
            index = featureGroupRef.current.getLayers().indexOf(layer);
        }

        setMenu({ x: e.originalEvent.clientX, y: e.originalEvent.clientY, layer: layer, index });

        // Auto-select on right click if not already selected?
        // Vanilla behavior: sets it as activeLayer.
        // We should probably ensure it's selected or at least tracked.
        // Let's just set the menu.
    };

    const handleSubtract = () => {
        // Debug Phase: Trace execution
        // alert("Debug: Start handleSubtract"); 

        if (!menu?.layer) {
            alert("Debug: No menu layer");
            return;
        }
        if (selectedIndices.size !== 2) {
            alert(`Debug: Selected count is ${selectedIndices.size}, need 2`);
            return;
        }
        if (menu.index === -1) {
            alert("Debug: Menu index is -1");
            return;
        }

        const subjectIndex = menu.index;
        const otherIndex = Array.from(selectedIndices).find(i => i !== subjectIndex);

        if (otherIndex === undefined) {
            alert("Debug: Other index not found");
            return;
        }

        if (!featureGroupRef.current) {
            alert("Debug: No FeatureGroup ref");
            return;
        }

        const allLayers = featureGroupRef.current.getLayers();
        const subjectLayer = allLayers[subjectIndex];
        const clipLayer = allLayers[otherIndex];

        if (!subjectLayer || !clipLayer) {
            alert("Debug: Layers not found in FeatureGroup");
            return;
        }

        try {
            // @ts-ignore
            const sG = subjectLayer.toGeoJSON();
            // @ts-ignore
            const cG = clipLayer.toGeoJSON();

            // Simplify geometry prep: just rewind to fix winding order
            // @ts-ignore
            const sGTyped = turf.rewind(sG, { reverse: true });
            // @ts-ignore
            const cGTyped = turf.rewind(cG, { reverse: true });

            const validTypes = ['Polygon', 'MultiPolygon'];
            // @ts-ignore
            if (!validTypes.includes(sGTyped.geometry.type) || !validTypes.includes(cGTyped.geometry.type)) {
                if (onShowToast) onShowToast("Error: Solo se pueden restar Polígonos");
                else alert("Error: Tipos inválidos");
                return;
            }

            // Perform Difference directly
            // Turf v7: difference(featureCollection)
            // @ts-ignore
            const collection = turf.featureCollection([sGTyped, cGTyped]);
            const difference = turf.difference(collection as any);

            if (!difference) {
                // This creates ambiguity: did it fail, or was it fully removed?
                // We'll treat it as "result is empty geometry" -> remove subject.
                if (onShowToast) onShowToast("Aviso: El polígono fue eliminado completamente");

                // Remove subject layer
                const currentGeoJSON = featureGroupRef.current.toGeoJSON() as any;
                const features = currentGeoJSON.features.filter((_: any, i: number) => i !== subjectIndex);
                const newCollection = { ...currentGeoJSON, features };

                if (activeLayerId) onUpdateLayer(activeLayerId, newCollection);
                else alert("Debug: No activeLayerId to update");

                setMenu(null);
                if (onClearSelection) onClearSelection();
                return;
            }

            // Normal Success Case
            const currentGeoJSON = featureGroupRef.current.toGeoJSON() as any;
            const features = currentGeoJSON.features;
            const newFeatures = features.filter((_: any, i: number) => i !== subjectIndex);
            newFeatures.push(difference);

            if (activeLayerId) {
                onUpdateLayer(activeLayerId, { ...currentGeoJSON, features: newFeatures });
                if (onShowToast) onShowToast("Resta completada exitosamente");
            } else {
                alert("Debug: No activeLayerId (Main branch)");
            }

            setMenu(null);
            if (onClearSelection) onClearSelection();

        } catch (err: any) {
            console.error("Subtract error:", err);
            if (onShowToast) onShowToast(`Error: ${err.message || "Fallo en resta"}`);
            else alert(`Error: ${err.message}`);
        }
    };


    // --- Event Binding Helper ---
    const setupLayerEvents = (layer: any) => {
        layer.off('click');
        layer.off('contextmenu');

        layer.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            toggleSelection(layer, e.originalEvent.ctrlKey || e.originalEvent.metaKey);
        });

        layer.on('contextmenu', (e: any) => {
            handleContextMenu(e, layer);
        });
    }

    const _onCreated = (e: any) => {
        const layer = e.layer;
        if (activeLayerId && featureGroupRef.current) {
            // Setup events
            setupLayerEvents(layer);

            // To update parent, we take current group state.
            // Note: EditControl adds the layer to featureGroup BEFORE this fires? Yes.
            // So getLayers() includes it.

            const geojson = featureGroupRef.current.toGeoJSON();
            onUpdateLayer(activeLayerId, geojson);

            // Should we select the new layer?
            // Maybe.
        }
    };

    const _onEdited = () => {
        if (activeLayerId && featureGroupRef.current) {
            onUpdateLayer(activeLayerId, featureGroupRef.current.toGeoJSON());
        }
    };

    const _onDeleted = () => {
        if (activeLayerId && featureGroupRef.current) {
            if (onClearSelection) onClearSelection(); // Clear selection on delete to avoid phantom indices
            onUpdateLayer(activeLayerId, featureGroupRef.current.toGeoJSON());
        }
    };

    // Handle manual draw events
    useEffect(() => {
        if (!map) return;
        const handleManual = (e: any) => {
            if (e.layerType === 'polygon' || e.layerType === 'marker') {
                if (featureGroupRef.current && !featureGroupRef.current.hasLayer(e.layer)) {
                    featureGroupRef.current.addLayer(e.layer);
                    setupLayerEvents(e.layer);
                    if (activeLayerId) {
                        onUpdateLayer(activeLayerId, featureGroupRef.current.toGeoJSON());
                    }
                }
            }
        };
        map.on('draw:created', handleManual);
        return () => { map.off('draw:created', handleManual); };
    }, [map, activeLayerId]);


    // FlyTo & Draw Requests
    useEffect(() => {
        if (requestFlyTo && map) {
            try {
                const bounds = L.geoJSON(requestFlyTo).getBounds();
                if (bounds.isValid()) map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
            } catch (e) { console.error(e); }
        }
    }, [requestFlyTo, map]);

    useEffect(() => {
        if (!requestDraw || !map) return;
        // @ts-ignore
        if (requestDraw.type === 'polygon' && L.Draw && L.Draw.Polygon) new L.Draw.Polygon(map).enable();
        // @ts-ignore
        else if (requestDraw.type === 'point' && L.Draw && L.Draw.Marker) new L.Draw.Marker(map).enable();
    }, [requestDraw, map]);


    // Keyboard (Escape)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (editingLayer) handleStopEdit();
                else if (onClearSelection) onClearSelection();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingLayer, onClearSelection]);

    // Close menu
    useEffect(() => {
        const handleClick = () => setMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);


    // Menu Actions
    const handleStopEdit = () => {
        if (editingLayer) {
            // @ts-ignore
            if (editingLayer.editing) editingLayer.editing.disable();
            if (activeLayerId && featureGroupRef.current) {
                onUpdateLayer(activeLayerId, featureGroupRef.current.toGeoJSON());
            }
            setEditingLayer(null);
            setMenu(null);
        }
    };
    const handleEdit = () => {
        if (menu?.layer) {
            // @ts-ignore
            if (menu.layer.editing) {
                // @ts-ignore
                menu.layer.editing.enable();
                setEditingLayer(menu.layer);
                setMenu(null);
            }
        }
    };
    const handleDelete = () => {
        if (menu?.layer && featureGroupRef.current) {
            featureGroupRef.current.removeLayer(menu.layer);
            _onDeleted();
        }
        setMenu(null);
    };
    const handleCopyWKT = () => {
        if (menu?.layer) {
            // @ts-ignore
            const wkt = stringifyWKT(menu.layer.toGeoJSON());
            navigator.clipboard.writeText(wkt);
            if (onShowToast) onShowToast("WKT Copiado"); else alert("WKT Copiado");
        }
        setMenu(null);
    };


    if (!layers.find(l => l.id === activeLayerId)?.visible) return null;
    const activeLayerData = layers.find(l => l.id === activeLayerId)?.features;

    // Derived state for Subtract Button
    const showSubtract = menu && selectedIndices.has(menu.index) && selectedIndices.size === 2;

    return (
        <>
            <FeatureGroup ref={featureGroupRef} key={activeLayerId}>
                <EditControl
                    position="topleft"
                    onCreated={_onCreated}
                    onEdited={_onEdited}
                    onDeleted={_onDeleted}
                    draw={{
                        rectangle: true, polygon: true, circle: false, circlemarker: false, marker: true, polyline: true
                    }}
                />
                <InitialDataLoader
                    data={activeLayerData}
                    groupRef={featureGroupRef}
                    setupLayerEvents={setupLayerEvents}
                />
            </FeatureGroup>

            {menu && (
                <div
                    className="context-menu"
                    style={{ position: 'fixed', top: menu.y, left: menu.x, display: 'block', zIndex: 9999, background: 'white', padding: '6px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div onClick={handleCopyWKT} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        <span>Copiar WKT</span>
                    </div>

                    {showSubtract ? (
                        <div onClick={handleSubtract} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14" /></svg>
                            <span>Restar selección</span>
                        </div>
                    ) : null}

                    {editingLayer === menu.layer ? (
                        <div onClick={handleStopEdit} className="menu-item" style={{ color: '#f59e0b', display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                            <span>Terminar edición</span>
                        </div>
                    ) : (
                        <div onClick={handleEdit} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z" /></svg>
                            <span>Editar</span>
                        </div>
                    )}

                    <div onClick={handleDelete} className="menu-item" style={{ color: '#ef4444', display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        <span>Eliminar</span>
                    </div>
                </div>
            )}
        </>
    );
}

// Helper to hydrate the FeatureGroup with existing GeoJSON and bind events
function InitialDataLoader({ data, groupRef, setupLayerEvents }: { data: any, groupRef: any, setupLayerEvents: (l: any) => void }) {
    useEffect(() => {
        if (!groupRef.current || !data) return;
        groupRef.current.clearLayers();
        if (data.type === 'FeatureCollection') {
            L.geoJSON(data, {
                style: (feature: any) => ({
                    color: feature?.properties?.color || '#3388ff',
                    fillColor: feature?.properties?.color || '#3388ff',
                    weight: 2
                }),
                onEachFeature: (feature: any, layer: L.Layer) => {
                    setupLayerEvents(layer);
                    groupRef.current?.addLayer(layer);
                }
            });
        }
    }, [data, groupRef]); // Dependency on setupLayerEvents OK if stable
    return null;
}


export default function MapComponent(props: MapProps) {
    return (
        <MapContainer center={[-12.0464, -77.0428]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Non-active layers (Visual only) */}
            {props.layers.map(layer => {
                if (layer.id === props.activeLayerId || !layer.visible) return null;
                return <GeoJSON key={layer.id} data={layer.features} pathOptions={{ color: '#64748b' }} />;
            })}

            {/* Active editing layer */}
            <ActiveLayerEditor {...props} />
        </MapContainer>
    );
}
