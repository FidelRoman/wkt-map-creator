import { useRef, useState, useEffect } from 'react';
import { FeatureGroup, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { stringifyWKT } from '@/lib/map-utils';
import InitialDataLoader from './InitialDataLoader';
import { Layer } from '@/lib/firebase';

interface ActiveLayerEditorProps {
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

export default function ActiveLayerEditor({
    layers,
    activeLayerId,
    onUpdateLayer,
    requestDraw,
    requestFlyTo,
    onShowToast,
    selectedIndices = new Set(),
    onToggleSelection,
    onClearSelection
}: ActiveLayerEditorProps) {
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
    }, [selectedIndices]);

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

    // --- Context Menu & Operations ---
    const handleContextMenu = (e: any, layer: L.Layer) => {
        L.DomEvent.stopPropagation(e);
        e.originalEvent.preventDefault();

        let index = -1;
        if (featureGroupRef.current) {
            index = featureGroupRef.current.getLayers().indexOf(layer);
        }

        setMenu({ x: e.originalEvent.clientX, y: e.originalEvent.clientY, layer: layer, index });
    };

    const handleSubtract = () => {
        if (!menu?.layer || selectedIndices.size !== 2 || menu.index === -1) {
            return;
        }

        const subjectIndex = menu.index;
        const otherIndex = Array.from(selectedIndices).find(i => i !== subjectIndex);

        if (otherIndex === undefined || !featureGroupRef.current) {
            return;
        }

        const allLayers = featureGroupRef.current.getLayers();
        const subjectLayer = allLayers[subjectIndex];
        const clipLayer = allLayers[otherIndex];

        if (!subjectLayer || !clipLayer) return;

        try {
            // @ts-ignore
            const sG = subjectLayer.toGeoJSON();
            // @ts-ignore
            const cG = clipLayer.toGeoJSON();

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

            // @ts-ignore
            const collection = turf.featureCollection([sGTyped, cGTyped]);
            const difference = turf.difference(collection as any);

            if (!difference) {
                if (onShowToast) onShowToast("Aviso: El polígono fue eliminado completamente");

                const currentGeoJSON = featureGroupRef.current.toGeoJSON() as any;
                const features = currentGeoJSON.features.filter((_: any, i: number) => i !== subjectIndex);
                const newCollection = { ...currentGeoJSON, features };

                if (activeLayerId) onUpdateLayer(activeLayerId, newCollection);
                setMenu(null);
                if (onClearSelection) onClearSelection();
                return;
            }

            const currentGeoJSON = featureGroupRef.current.toGeoJSON() as any;
            const features = currentGeoJSON.features;
            const newFeatures = features.filter((_: any, i: number) => i !== subjectIndex);
            newFeatures.push(difference);

            if (activeLayerId) {
                onUpdateLayer(activeLayerId, { ...currentGeoJSON, features: newFeatures });
                if (onShowToast) onShowToast("Resta completada exitosamente");
            }

            setMenu(null);
            if (onClearSelection) onClearSelection();

        } catch (err: any) {
            console.error("Subtract error:", err);
            if (onShowToast) onShowToast(`Error: ${err.message || "Fallo en resta"}`);
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
            setupLayerEvents(layer);
            const geojson = featureGroupRef.current.toGeoJSON();
            onUpdateLayer(activeLayerId, geojson);
        }
    };

    const _onEdited = () => {
        if (activeLayerId && featureGroupRef.current) {
            onUpdateLayer(activeLayerId, featureGroupRef.current.toGeoJSON());
        }
    };

    const _onDeleted = () => {
        if (activeLayerId && featureGroupRef.current) {
            if (onClearSelection) onClearSelection();
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

    // FlyTo Requests
    useEffect(() => {
        if (requestFlyTo && map) {
            try {
                const bounds = L.geoJSON(requestFlyTo).getBounds();
                if (bounds.isValid()) map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
            } catch (e) { console.error(e); }
        }
    }, [requestFlyTo, map]);

    // Draw Requests
    useEffect(() => {
        if (!requestDraw || !map) return;
        // @ts-ignore
        if (requestDraw.type === 'polygon' && L.Draw && L.Draw.Polygon) new L.Draw.Polygon(map).enable();
        // @ts-ignore
        else if (requestDraw.type === 'point' && L.Draw && L.Draw.Marker) new L.Draw.Marker(map).enable();
    }, [requestDraw, map]);

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
