"use client";

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMap, useMapEvents, GeoJSON } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { generateColor, stringifyWKT } from '@/lib/map-utils';
import { difference, featureCollection } from '@turf/turf';
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
function ActiveLayerEditor({ layers, activeLayerId, onUpdateLayer, requestDraw, requestFlyTo, onShowToast, selectedIndices, onToggleSelection, onClearSelection }: MapProps) {
    const featureGroupRef = useRef<L.FeatureGroup>(null);
    const [mounted, setMounted] = useState(false);
    const map = useMap();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleClick = () => setMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);


    // Fly to bounds trigger
    useEffect(() => {
        if (requestFlyTo && map) {
            try {
                // Check if bounds valid?
                const bounds = L.geoJSON(requestFlyTo).getBounds();
                if (bounds.isValid()) {
                    map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
                }
            } catch (e) {
                console.error("FlyTo error", e);
            }
        }
    }, [requestFlyTo, map]);


    // Handle Programmatic Draw Trigger
    useEffect(() => {
        if (!requestDraw || !map) return;

        // @ts-ignore
        if (requestDraw.type === 'polygon' && L.Draw && L.Draw.Polygon) {
            // @ts-ignore
            new L.Draw.Polygon(map).enable();
        }
        // @ts-ignore
        else if (requestDraw.type === 'point' && L.Draw && L.Draw.Marker) {
            // @ts-ignore
            new L.Draw.Marker(map).enable();
        }
    }, [requestDraw, map]);


    // When active layer changes, we need to clear the feature group and load the new features.
    // React-Leaflet's FeatureGroup doesn't auto-update children easily if unmanaged.
    // We will use a ref to set the content manually or rely on `key` to force remount.

    const activeLayer = layers.find(l => l.id === activeLayerId);

    const [menu, setMenu] = useState<{ x: number, y: number, layer: L.Layer | null } | null>(null);
    const [editingLayer, setEditingLayer] = useState<L.Layer | null>(null);

    const _onCreated = (e: any) => {
        const layer = e.layer;

        // Attach context menu to new layer
        layer.on('contextmenu', (e: any) => {
            setMenu({ x: e.originalEvent.clientX, y: e.originalEvent.clientY, layer: layer });
        });

        // Add to feature group if not added by EditControl (EditControl usually adds it)
        // Check if it's already there? EditControl adds it to the FeatureGroup it wraps.
        // BUT if we trigger draw manually via L.Draw.Polygon(map), does it add to this FeatureGroup?
        // NO. L.Draw via map adds it to map (or nothing?). It fires draw:created.
        // We need to catch draw:created globally or from map if we trigger it manually?
        // Actually EditControl listens to map 'draw:created'.
        // Let's verify if EditControl picks it up. 
        // If not, we might need a map event listener here too.

        if (activeLayerId && featureGroupRef.current) {
            // Wait for next tick to ensure layer is added?
            // Actually _onCreated is called by EditControl.
            // If we use manual draw, we should ensure the result goes into our Update loop.

            // If manual draw fires map event, EditControl might NOT pick it up if it didn't initiate it?
            // "The created layer is added to the map by default" -> No, L.Draw doesn't add.
            // We need to listen to map.on('draw:created') for manual triggers.
        }

        if (activeLayerId && featureGroupRef.current) {
            // The layer is already added by EditControl if it originated there.
            // If manual, we need to add        // Click for selection
            // @ts-ignore
            layer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (onToggleSelection && featureGroupRef.current) {
                    const idx = featureGroupRef.current.getLayers().indexOf(layer);
                    onToggleSelection(idx, e.originalEvent.metaKey || e.originalEvent.ctrlKey);
                }
            });

            // Add to feature group
            featureGroupRef.current.addLayer(layer);

            const geojson = featureGroupRef.current.toGeoJSON();
            onUpdateLayer(activeLayerId, geojson);
        }
    };

    // Listen for manual draw creation which bypasses EditControl's onCreate sometimes
    useEffect(() => {
        if (!map) return;

        const handleManualCreated = (e: any) => {
            // Need to distinguish if EditControl handled it?
            // EditControl binds to draw:created too.
            // If we add it twice, it might be bad.
            // Let's see. If I use `new L.Draw.Polygon`, the type is 'polygon'.
            // EditControl props `onCreated` might only fire for its own toolbar.

            if (e.layerType === 'polygon' || e.layerType === 'marker') {
                // Add to our group
                if (featureGroupRef.current) {
                    // Check if already has layer? Leaflet IDs.
                    if (!featureGroupRef.current.hasLayer(e.layer)) {
                        featureGroupRef.current.addLayer(e.layer);

                        // Attach simple events
                        e.layer.on('contextmenu', (evt: any) => {
                            setMenu({ x: evt.originalEvent.clientX, y: evt.originalEvent.clientY, layer: e.layer });
                        });

                        // Update
                        if (activeLayerId) {
                            const geojson = featureGroupRef.current.toGeoJSON();
                            onUpdateLayer(activeLayerId, geojson);
                        }
                    }
                }
            }
        };

        map.on('draw:created', handleManualCreated);
        return () => {
            map.off('draw:created', handleManualCreated);
        };
    }, [map, activeLayerId]);


    const _onEdited = (e: any) => {
        if (activeLayerId && featureGroupRef.current) {
            const geojson = featureGroupRef.current.toGeoJSON();
            onUpdateLayer(activeLayerId, geojson);
        }
    };

    const _onDeleted = (e: any) => {
        if (activeLayerId && featureGroupRef.current) {
            const geojson = featureGroupRef.current.toGeoJSON();
            onUpdateLayer(activeLayerId, geojson);
        }
    };

    // Handler passed to InitialDataLoader
    const handleContextMenu = (e: any, layer: L.Layer) => {
        setMenu({ x: e.originalEvent.clientX, y: e.originalEvent.clientY, layer: layer });
    };

    const handleCopyWKT = () => {
        if (menu?.layer) {
            // @ts-ignore
            const geojson = menu.layer.toGeoJSON();
            const wkt = stringifyWKT(geojson);
            navigator.clipboard.writeText(wkt);
            if (onShowToast) {
                onShowToast("WKT copiado al portapapeles");
            } else {
                alert("WKT copiado al portapapeles");
            }
        }
        setMenu(null);
    };

    const handleDelete = () => {
        if (menu?.layer && featureGroupRef.current) {
            featureGroupRef.current.removeLayer(menu.layer);
            // Trigger update
            const geojson = featureGroupRef.current.toGeoJSON();
            if (activeLayerId) onUpdateLayer(activeLayerId, geojson);
        }
        setMenu(null);
    };

    const handleSubtract = () => {
        // console.log("handleSubtract called");
        if (!menu?.layer || !selectedIndices || selectedIndices.size !== 2 || !featureGroupRef.current || !activeLayerId) {
            console.log("Subtract guards failed", { menuLayer: !!menu?.layer, selectedSize: selectedIndices?.size, ref: !!featureGroupRef.current });
            return;
        }

        // "Active" layer (clicked) is the Subject
        // The other selected layer is the Clip
        const layersArr = featureGroupRef.current.getLayers();
        const subjectIndex = layersArr.indexOf(menu.layer);

        console.log("Subject Index:", subjectIndex);

        if (subjectIndex === -1) return;

        const otherIndex = Array.from(selectedIndices).find(i => i !== subjectIndex);
        console.log("Other Index:", otherIndex);

        if (otherIndex === undefined) return;

        const subjectLayer = menu.layer;
        const clipLayer = layersArr[otherIndex];

        console.log("Subject Layer:", subjectLayer);
        console.log("Clip Layer:", clipLayer);

        if (!clipLayer) return;

        try {
            // @ts-ignore
            const sG = subjectLayer.toGeoJSON();
            // @ts-ignore
            const cG = clipLayer.toGeoJSON();

            console.log("Subject GeoJSON:", sG);
            console.log("Clip GeoJSON:", cG);

            const diff = difference(featureCollection([sG, cG]));

            console.log("Diff Result:", diff);

            if (!diff) {
                if (onShowToast) onShowToast("La resta no produjo resultado (geometrías disjuntas o invalida)");
                else alert("Restar: Sin resultado");
                return;
            }

            // Update Features
            // We want to replace the Subject with the Result.
            // AND we optionally keep the Clip? Vanilla script:
            // "drawnItems.removeLayer(subj); drawnItems.addLayer(newL);"
            // Clip remains.

            // We need to construct new feature collection.
            // We have the raw features in `activeLayer.features`.
            // But we can also rebuild from `featureGroupRef` logic or just map activeLayer.features.
            if (!activeLayer) return; // Defined in outer scope

            // Deep clone to be safe
            // const newFeaturesList = JSON.parse(JSON.stringify(activeLayer.features.features));
            // Actually, simply mapping is cleaner
            const newFeaturesList = activeLayer.features.features.map((f: any, i: number) => {
                if (i === subjectIndex) {
                    // Replace subject with diff
                    // Preserve properties?
                    return {
                        ...diff,
                        properties: { ...f.properties, ...diff.properties }
                    };
                }
                return f;
            });

            // Update layer
            onUpdateLayer(activeLayerId, { type: 'FeatureCollection', features: newFeaturesList });
            if (onShowToast) onShowToast("Resta realizada con éxito");

        } catch (e) {
            console.error(e);
            if (onShowToast) onShowToast("Error calculando resta");
        }
        setMenu(null);
    };

    const handleStopEdit = () => {
        if (editingLayer) {
            // @ts-ignore
            editingLayer.editing.disable();
            // Trigger update? editing disabled event should trigger?
            // "drawnItems.toGeoJSON()" needs to be called.
            // `L.Draw.Event.EDITED` listener in Page? No, Map handles it?
            // Leaflet.draw fires: 'draw:edited', 'draw:created', 'draw:deleted'.
            // But we are manually enabling edit.
            // When we disable, we should save.

            // Re-fetch GeoJSON and update
            if (featureGroupRef.current && activeLayerId) {
                const geojson = featureGroupRef.current.toGeoJSON();
                onUpdateLayer(activeLayerId, geojson);
            }

            setEditingLayer(null);
        } else {
            // If NOT editing, Escape should Clear Selection
            if (onClearSelection) onClearSelection();
        }
        setMenu(null);
    };

    const handleEdit = () => {
        const layerToEdit = menu?.layer;
        if (layerToEdit) {
            // @ts-ignore
            if (layerToEdit.editing) {
                // @ts-ignore
                layerToEdit.editing.enable();
                setEditingLayer(layerToEdit);
                setMenu(null);
            }
        }
    };

    // Listen for Escape key to stop editing
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleStopEdit();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingLayer, onClearSelection, activeLayerId]); // tracking editingLayer to have closure access if needed, though state is fresh.

    // Listen for Map Click (Empty space)
    useMapEvents({
        click: (e) => {
            // If we clicked on a layer, the event propagation should have been stopped by the layer click handler.
            // So if this fires, it means we clicked empty map.
            if (!editingLayer && onClearSelection) {
                onClearSelection();
            }
            // Close context menu if open
            setMenu(null);
        }
    });


    if (!activeLayer || !activeLayer.visible) return null;



    return (
        <>
            <FeatureGroup ref={featureGroupRef} key={activeLayerId}>
                <EditControl
                    position="topleft"
                    onCreated={_onCreated}
                    onEdited={_onEdited}
                    onDeleted={_onDeleted}
                    draw={{
                        rectangle: true,
                        polygon: true,
                        circle: false,
                        circlemarker: false,
                        marker: true,
                        polyline: true,
                    }}
                />
                <InitialDataLoader
                    data={activeLayer.features}
                    groupRef={featureGroupRef}
                    onContextMenu={handleContextMenu}
                    selectedIndices={selectedIndices}
                    onToggleSelection={onToggleSelection}
                />
            </FeatureGroup>

            {menu && (
                <div
                    className="context-menu"
                    style={{
                        position: 'fixed', // usamos fixed para respetar clientX/clientY
                        top: menu.y,
                        left: menu.x,
                        display: 'block', // sobrescribe el display:none del CSS
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Copiar WKT */}
                    <div
                        onClick={handleCopyWKT}
                        className="menu-item"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copiar WKT</span>
                        <svg
                            className="check-icon"
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    {/* Restar selección (visible sólo si 2 items seleccionados) */}
                    {selectedIndices && selectedIndices.size === 2 && menu.layer && selectedIndices.has(featureGroupRef.current?.getLayers().indexOf(menu.layer) ?? -1) && (
                        <div
                            onClick={handleSubtract}
                            className="menu-item"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M5 12h14" />
                            </svg>
                            <span>Restar selección</span>
                        </div>
                    )}
                    {/* Editar / Terminar Edición */}
                    {editingLayer === menu.layer ? (
                        <div
                            onClick={handleStopEdit}
                            className="menu-item"
                            style={{ color: '#f59e0b' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                            <span>Terminar edición</span>
                        </div>
                    ) : (
                        <div
                            onClick={handleEdit}
                            className="menu-item"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z" />
                            </svg>
                            <span>Editar</span>
                        </div>
                    )}
                    {/* Eliminar */}
                    <div
                        onClick={handleDelete}
                        className="menu-item"
                        style={{ color: '#ef4444' }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>Eliminar</span>
                    </div>
                </div>
            )}
        </>
    );
}

// Helper to hydrate the FeatureGroup with existing GeoJSON
function InitialDataLoader({
    data,
    groupRef,
    onContextMenu,
    selectedIndices,
    onToggleSelection
}: {
    data: any,
    groupRef: any,
    onContextMenu?: any,
    selectedIndices?: Set<number>,
    onToggleSelection?: any
}) {
    // Effect 1: Load Data (run only when data or handlers change, NOT on selection change)
    useEffect(() => {
        if (!groupRef.current || !data) return;

        // Clear existing layers to prevent duplication/stale state
        groupRef.current.clearLayers();

        if (data.type === 'FeatureCollection') {
            L.geoJSON(data, {
                // We don't set style here based on selection, we do it in the next effect.
                // Or set default style.
                style: (feature: any) => ({
                    color: feature?.properties?.color || '#3388ff',
                    fillColor: feature?.properties?.color || '#3388ff',
                    weight: 2,
                    fillOpacity: 0.2
                }),
                onEachFeature: (feature: any, layer: L.Layer) => {
                    // Empty onEachFeature
                }
            }).eachLayer((layer) => {
                // Attach events
                // @ts-ignore
                layer.on('contextmenu', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (onContextMenu) onContextMenu(e, layer);
                });
                // @ts-ignore
                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (onToggleSelection && groupRef.current) {
                        const idx = groupRef.current.getLayers().indexOf(layer);
                        onToggleSelection(idx, e.originalEvent.metaKey || e.originalEvent.ctrlKey);
                    }
                });

                groupRef.current.addLayer(layer);
            });
        }

        // After loading data, we might need to apply selection styles immediately?
        // The second effect will run after this render anyway?
        // Yes, if selectedIndices is in deps of second effect.

    }, [data, groupRef, onContextMenu, onToggleSelection]);

    // Effect 2: Update Styles based on Selection (run when selectedIndices changes)
    useEffect(() => {
        if (!groupRef.current) return;

        const layers = groupRef.current.getLayers();
        layers.forEach((layer: any, index: number) => {
            const isSelected = selectedIndices?.has(index);

            // Re-apply style. We need references to original color.
            // Fortunately `layer.feature` is attached by L.geoJSON usually.
            // Or we check `layer.options` or `layer.feature.properties`.

            // `L.geoJSON` attaches `feature` to `layer.feature`.
            const color = layer.feature?.properties?.color || '#3388ff';

            if (layer.setStyle) {
                layer.setStyle({
                    color: color,
                    fillColor: color,
                    weight: isSelected ? 4 : 2,
                    dashArray: isSelected ? '10, 10' : undefined,
                    fillOpacity: 0.2
                });
            }
        });
    }, [selectedIndices, groupRef, data]); // specific dependency on data ensures it runs after data load too?
    // Actually, if `data` changes, Effect 1 runs. Effect 2 runs too because of `data` dep?
    // Yes. Ideally we want Effect 2 to run AFTER Effect 1.

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
            <ActiveLayerEditor {...props} selectedIndices={props.selectedIndices} />
        </MapContainer>
    );
}
