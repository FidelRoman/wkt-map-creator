import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { FeatureGroup, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';

// Lazy-loaded once and cached — avoids including 150KB turf in the initial bundle
let turfCache: typeof import('@turf/turf') | null = null;
async function getTurf() {
    if (!turfCache) turfCache = await import('@turf/turf');
    return turfCache;
}
import { stringifyWKT } from '@/lib/map-utils';
import InitialDataLoader from './InitialDataLoader';
import { Layer } from '@/lib/firebase';
import { checkLimit, hasFeature, type PlanId } from '@/lib/plans';
import type { ToastType } from '@/components/Toast';
import FeatureComments from './FeatureComments';

interface ActiveLayerEditorProps {
    layers: Layer[];
    activeLayerId: string | null;
    onUpdateLayer: (layerId: string, features: any) => void;
    requestDraw?: { type: 'polygon' | 'point', id: number } | null;
    requestFlyTo?: any | null;
    onShowToast?: (message: string, type?: ToastType) => void;
    selectedIndices?: Set<number>;
    onToggleSelection?: (index: number, multi: boolean) => void;
    onClearSelection?: () => void;
    plan?: PlanId;
    onUpgradeRequired?: (reason:
        | { type: 'limit'; limitKey: 'maxFeaturesPerLayer'; current: number; limit: number; requiredPlan: PlanId }
        | { type: 'feature'; featureKey: 'hasSpatialAnalysis'; requiredPlan: PlanId }
    ) => void;
    projectId?: string;
    isReadOnly?: boolean;
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
    onClearSelection,
    plan = 'free',
    onUpgradeRequired,
    projectId,
    isReadOnly = false,
}: ActiveLayerEditorProps) {
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const prevSelectedRef = useRef<Set<number>>(new Set());
    const [menu, setMenu] = useState<{ x: number, y: number, layer: L.Layer | null, index: number } | null>(null);
    const [editingLayer, setEditingLayer] = useState<L.Layer | null>(null);
    const [bufferInputOpen, setBufferInputOpen] = useState(false);
    const [bufferDistance, setBufferDistance] = useState('500');
    const [commentsFeature, setCommentsFeature] = useState<{ index: number; name: string; note: string } | null>(null);
    const [isSpatialProcessing, setIsSpatialProcessing] = useState(false);
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

    const updateSelectionStyles = useCallback(() => {
        if (!featureGroupRef.current) return;
        const allLayers = featureGroupRef.current.getLayers();
        const prev = prevSelectedRef.current;

        // Only update layers whose selection state actually changed
        const toSelect = [...selectedIndices].filter(i => !prev.has(i));
        const toDeselect = [...prev].filter(i => !selectedIndices.has(i));

        toSelect.forEach(index => {
            const l = allLayers[index] as any;
            if (l && typeof l.setStyle === 'function') {
                l.setStyle({ dashArray: '10, 10', weight: 4, color: l.feature?.properties?.color || '#3388ff' });
            }
        });
        toDeselect.forEach(index => {
            const l = allLayers[index] as any;
            if (l && typeof l.setStyle === 'function') {
                l.setStyle({ dashArray: null, weight: 2, color: l.feature?.properties?.color || '#3388ff' });
            }
        });

        prevSelectedRef.current = new Set(selectedIndices);
    }, [selectedIndices]);

    // Re-apply styles when selection changes
    useEffect(() => {
        updateSelectionStyles();
    }, [updateSelectionStyles]);

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
        const handleClick = () => { setMenu(null); setBufferInputOpen(false); setBufferDistance('500'); };
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

    const handleSubtract = async () => {
        if (!menu?.layer || selectedIndices.size !== 2 || menu.index === -1) {
            return;
        }

        const subjectIndex = menu.index;
        const otherIndex = Array.from(selectedIndices).find(i => i !== subjectIndex);

        if (otherIndex === undefined || !featureGroupRef.current) {
            return;
        }

        setIsSpatialProcessing(true);
        try {
            const turf = await getTurf();
            // Single toGeoJSON() call — extract both features from it
            const currentGeoJSON = featureGroupRef.current.toGeoJSON() as any;
            const sG = currentGeoJSON.features[subjectIndex];
            const cG = currentGeoJSON.features[otherIndex];

            // @ts-ignore
            const sGTyped = turf.rewind(sG, { reverse: true });
            // @ts-ignore
            const cGTyped = turf.rewind(cG, { reverse: true });

            const validTypes = ['Polygon', 'MultiPolygon'];
            // @ts-ignore
            if (!validTypes.includes(sGTyped.geometry.type) || !validTypes.includes(cGTyped.geometry.type)) {
                onShowToast?.("Subtract only works on Polygon or MultiPolygon geometries", 'error');
                return;
            }

            // @ts-ignore
            const collection = turf.featureCollection([sGTyped, cGTyped]);
            const difference = turf.difference(collection as any);

            if (!difference) {
                onShowToast?.("Warning: The polygon was completely subtracted and removed", 'warning');
                const newCollection = { ...currentGeoJSON, features: currentGeoJSON.features.filter((_: any, i: number) => i !== subjectIndex) };
                if (activeLayerId) onUpdateLayer(activeLayerId, newCollection);
                setMenu(null);
                if (onClearSelection) onClearSelection();
                return;
            }

            const newFeatures = currentGeoJSON.features.filter((_: any, i: number) => i !== subjectIndex);
            newFeatures.push(difference);

            if (activeLayerId) {
                onUpdateLayer(activeLayerId, { ...currentGeoJSON, features: newFeatures });
                onShowToast?.("Subtract completed", 'success');
            }

            setMenu(null);
            if (onClearSelection) onClearSelection();

        } catch (err: any) {
            console.error("Subtract error:", err);
            onShowToast?.(`Subtract failed: ${err.message || "invalid geometry"}`, 'error');
        } finally {
            setIsSpatialProcessing(false);
        }
    };

    const handleAdd = async () => {
        if (!menu?.layer || selectedIndices.size !== 2 || menu.index === -1) {
            return;
        }

        const subjectIndex = menu.index;
        const otherIndex = Array.from(selectedIndices).find(i => i !== subjectIndex);

        if (otherIndex === undefined || !featureGroupRef.current) {
            return;
        }

        setIsSpatialProcessing(true);
        try {
            const turf = await getTurf();
            // Single toGeoJSON() call — extract both features from it
            const currentGeoJSON = featureGroupRef.current.toGeoJSON() as any;
            const sG = currentGeoJSON.features[subjectIndex];
            const cG = currentGeoJSON.features[otherIndex];

            // @ts-ignore
            const sGTyped = turf.rewind(sG, { reverse: true });
            // @ts-ignore
            const cGTyped = turf.rewind(cG, { reverse: true });

            const validTypes = ['Polygon', 'MultiPolygon'];
            // @ts-ignore
            if (!validTypes.includes(sGTyped.geometry.type) || !validTypes.includes(cGTyped.geometry.type)) {
                onShowToast?.("Union only works on Polygon or MultiPolygon geometries", 'error');
                return;
            }

            // @ts-ignore
            const collection = turf.featureCollection([sGTyped, cGTyped]);
            const unionFeature = turf.union(collection as any);

            if (!unionFeature) {
                onShowToast?.("Union failed: could not merge the geometries.", 'error');
                return;
            }

            if (unionFeature.geometry.type === 'MultiPolygon') {
                onShowToast?.("Warning: Polygons don't overlap (result is MultiPolygon). Move them closer to merge into one.", 'warning');
                return;
            }

            const newFeatures = currentGeoJSON.features.filter((_: any, i: number) => i !== subjectIndex && i !== otherIndex);
            newFeatures.push(unionFeature);

            if (activeLayerId) {
                onUpdateLayer(activeLayerId, { ...currentGeoJSON, features: newFeatures });
                onShowToast?.("Union completed", 'success');
            }

            setMenu(null);
            if (onClearSelection) onClearSelection();

        } catch (err: any) {
            console.error("Union error:", err);
            onShowToast?.(`Union failed: ${err.message || "invalid geometry"}`, 'error');
        } finally {
            setIsSpatialProcessing(false);
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
    };

    const _onCreated = (e: any) => {
        const layer = e.layer;
        if (activeLayerId && featureGroupRef.current) {
            const featureCount = activeLayer?.features?.features?.length ?? 0;
            const check = checkLimit(plan, 'maxFeaturesPerLayer', featureCount);
            if (!check.allowed) {
                featureGroupRef.current.removeLayer(layer);
                if (onUpgradeRequired) {
                    onUpgradeRequired({ type: 'limit', limitKey: 'maxFeaturesPerLayer', current: featureCount, limit: check.limit!, requiredPlan: check.upgradeRequired! });
                }
                return;
            }
            // Read the new geometry (the drawn layer is already in the group),
            // then remove leaflet-draw's layer. State is the single source of
            // truth: InitialDataLoader re-renders the feature from the updated
            // GeoJSON. If we keep this layer, the feature shows twice on the map
            // (once here, once from the loader) while the features list shows 1.
            const geojson = featureGroupRef.current.toGeoJSON();
            featureGroupRef.current.removeLayer(layer);
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

    // NOTE: We intentionally do NOT add our own `map.on('draw:created')`
    // listener here. react-leaflet-draw's EditControl already binds one
    // globally (it adds the drawn layer to the FeatureGroup and calls
    // onCreated → _onCreated) for EVERY draw, including the sidebar's
    // `new L.Draw.Polygon(map)`. A second listener double-processed the same
    // event, which made each drawn feature render twice on the map while the
    // features list showed only one. _onCreated + InitialDataLoader are the
    // single source of truth.

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
            onShowToast?.("WKT copied", 'success');
        }
        setMenu(null);
    };

    const handleOpenComments = () => {
        if (!menu || menu.index === -1) { setMenu(null); return; }
        const feature = activeLayer?.features?.features?.[menu.index];
        const name = feature?.properties?.name ?? `Feature ${menu.index + 1}`;
        const note = feature?.properties?.note ?? '';
        if (onToggleSelection) onToggleSelection(menu.index, false);
        setCommentsFeature({ index: menu.index, name, note });
        setMenu(null);
    };

    const handleSaveNote = (note: string) => {
        if (!commentsFeature || !activeLayerId) return;
        if (!activeLayer) return;
        const updatedFeatures = activeLayer.features.features.map((f: any, i: number) =>
            i === commentsFeature.index ? { ...f, properties: { ...f.properties, note } } : f
        );
        onUpdateLayer(activeLayerId, { ...activeLayer.features, features: updatedFeatures });
        setCommentsFeature(prev => prev ? { ...prev, note } : null);
    };

    // Close comments when the associated feature is deselected
    useEffect(() => {
        if (!commentsFeature) return;
        if (!selectedIndices.has(commentsFeature.index)) {
            setCommentsFeature(null);
        }
    }, [selectedIndices]);

    const handleBuffer = () => {
        if (!hasFeature(plan, 'hasSpatialAnalysis')) {
            if (onUpgradeRequired) {
                onUpgradeRequired({ type: 'feature', featureKey: 'hasSpatialAnalysis', requiredPlan: 'pro' });
            }
            setMenu(null);
            return;
        }
        setBufferInputOpen(true);
    };

    const handleBufferConfirm = async () => {
        const distMeters = parseFloat(bufferDistance);
        if (isNaN(distMeters) || distMeters <= 0) {
            onShowToast?.("Invalid distance — enter a positive number", 'warning');
            return;
        }
        if (!menu?.layer || !activeLayerId || !featureGroupRef.current) { setMenu(null); setBufferInputOpen(false); return; }
        setIsSpatialProcessing(true);
        try {
            const turf = await getTurf();
            // Single toGeoJSON() call
            const currentGeoJSON = featureGroupRef.current.toGeoJSON() as any;
            const feature = currentGeoJSON.features[menu.index];
            const buffered = turf.buffer(feature, distMeters / 1000, { units: 'kilometers' });
            if (!buffered) { onShowToast?.("Buffer failed: could not generate geometry", 'error'); setMenu(null); setBufferInputOpen(false); return; }
            buffered.properties = { name: `Buffer ${distMeters}m`, color: '#f59e0b' };

            const newFeatures = [...currentGeoJSON.features, buffered];
            onUpdateLayer(activeLayerId, { ...currentGeoJSON, features: newFeatures });
            onShowToast?.(`Buffer of ${distMeters}m created`, 'success');
        } catch (err: any) {
            onShowToast?.(`Buffer failed: ${err.message || "invalid geometry"}`, 'error');
        } finally {
            setIsSpatialProcessing(false);
        }
        setMenu(null);
        setBufferInputOpen(false);
        setBufferDistance('500');
    };

    // Memoized active layer — avoids O(n) .find() on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const activeLayer = useMemo(() => layers.find(l => l.id === activeLayerId), [layers, activeLayerId]);

    if (!activeLayer?.visible) return null;
    const activeLayerData = activeLayer?.features;

    // Derived state for Subtract Button
    const showSubtract = menu && selectedIndices.has(menu.index) && selectedIndices.size === 2;

    return (
        <>
            <FeatureGroup ref={featureGroupRef}>
                <EditControl
                    position="topleft"
                    onCreated={_onCreated}
                    onEdited={_onEdited}
                    onDeleted={_onDeleted}
                    draw={{
                        rectangle: true, polygon: true, circle: false, circlemarker: false, marker: true, polyline: false
                    }}
                />
                <InitialDataLoader
                    data={activeLayerData}
                    layerId={activeLayerId}
                    groupRef={featureGroupRef}
                    setupLayerEvents={setupLayerEvents}
                />
            </FeatureGroup>

            {isSpatialProcessing && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--surface-color)', padding: '16px 24px', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', fontSize: '14px', color: 'var(--text-main)' }}>
                        Processing…
                    </div>
                </div>
            )}

            {menu && (
                <div
                    className="context-menu"
                    style={{ position: 'fixed', top: menu.y, left: menu.x, display: 'block', zIndex: 9999, background: 'var(--surface-color)', padding: '6px', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div onClick={handleCopyWKT} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        <span>Copy WKT</span>
                    </div>

                    {showSubtract ? (
                        <>
                            <div onClick={handleSubtract} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14" /></svg>
                                <span>Subtract selection</span>
                            </div>
                            <div onClick={handleAdd} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                <span>Union selection</span>
                            </div>
                        </>
                    ) : null}

                    {editingLayer === menu.layer ? (
                        <div onClick={handleStopEdit} className="menu-item" style={{ color: '#f59e0b', display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                            <span>Stop editing</span>
                        </div>
                    ) : (
                        <div onClick={handleEdit} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z" /></svg>
                            <span>Edit</span>
                        </div>
                    )}

                    {bufferInputOpen ? (
                        <div style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Buffer distance</p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                    type="number"
                                    value={bufferDistance}
                                    onChange={e => setBufferDistance(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleBufferConfirm()}
                                    autoFocus
                                    min={1}
                                    style={{ width: '90px', padding: '5px 8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', outline: 'none', background: 'var(--surface-color)', color: 'var(--text-main)' }}
                                />
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>m</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                <button
                                    onClick={handleBufferConfirm}
                                    style={{ flex: 1, padding: '5px 8px', background: 'var(--primary-color, #3b82f6)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => { setBufferInputOpen(false); setBufferDistance('500'); }}
                                    style={{ flex: 1, padding: '5px 8px', background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div onClick={handleBuffer} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" strokeDasharray="2 2"/></svg>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Buffer
                                {!hasFeature(plan, 'hasSpatialAnalysis') && <span style={{ fontSize: '10px', background: '#6366f1', color: 'white', padding: '1px 5px', borderRadius: '99px', fontWeight: 700 }}>Pro</span>}
                            </span>
                        </div>
                    )}
                    {projectId && (
                        <div onClick={handleOpenComments} className="menu-item" style={{ display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center', color: '#6366f1' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            <span>Annotation</span>
                        </div>
                    )}
                    <div onClick={handleDelete} className="menu-item" style={{ color: '#ef4444', display: 'flex', gap: '10px', padding: '10px', cursor: 'pointer', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        <span>Delete</span>
                    </div>
                </div>
            )}

            {commentsFeature && (
                <FeatureComments
                    featureName={commentsFeature.name}
                    featureNote={commentsFeature.note}
                    onClose={() => setCommentsFeature(null)}
                    onSaveNote={handleSaveNote}
                    canWrite={!isReadOnly}
                />
            )}
        </>
    );
}
