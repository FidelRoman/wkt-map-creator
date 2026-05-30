import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface InitialDataLoaderProps {
    data: any;
    layerId: string | null;
    groupRef: any;
    setupLayerEvents: (l: any) => void;
}

export default function InitialDataLoader({ data, layerId, groupRef, setupLayerEvents }: InitialDataLoaderProps) {
    // Track existing Leaflet layers by feature index so we can update them in-place
    const layerMapRef = useRef<Map<number, L.Layer>>(new Map());
    const prevLayerIdRef = useRef<string | null>(null);
    // Ref keeps the latest setupLayerEvents without adding it to effect deps
    const setupLayerEventsRef = useRef(setupLayerEvents);
    setupLayerEventsRef.current = setupLayerEvents;

    useEffect(() => {
        if (!groupRef.current || !data) return;
        if (data.type !== 'FeatureCollection') return;

        const layerMap = layerMapRef.current;

        // When the active layer changes, clear everything and do a full reload
        if (layerId !== prevLayerIdRef.current) {
            groupRef.current.clearLayers();
            layerMap.clear();
            prevLayerIdRef.current = layerId;
        }

        const newFeatures: any[] = data.features ?? [];
        const newIndices = new Set<number>();

        newFeatures.forEach((feature: any, index: number) => {
            newIndices.add(index);
            const color = feature?.properties?.color || '#3388ff';

            if (layerMap.has(index)) {
                const existing = layerMap.get(index) as any;
                // Update style in-place — avoids destroying/recreating the layer
                if (typeof existing.setStyle === 'function') {
                    existing.setStyle({ color, fillColor: color, weight: 2 });
                }
                // Geometry changed: replace only that specific layer
                const existingGeom = JSON.stringify(existing.feature?.geometry);
                const newGeom = JSON.stringify(feature.geometry);
                if (existingGeom !== newGeom) {
                    groupRef.current.removeLayer(existing);
                    const newLayers: L.Layer[] = [];
                    L.geoJSON(feature, {
                        style: () => ({ color, fillColor: color, weight: 2 }),
                        onEachFeature: (_f: any, l: L.Layer) => newLayers.push(l),
                    });
                    if (newLayers.length > 0) {
                        setupLayerEventsRef.current(newLayers[0]);
                        groupRef.current.addLayer(newLayers[0]);
                        layerMap.set(index, newLayers[0]);
                    }
                }
            } else {
                // New feature — add it
                const newLayers: L.Layer[] = [];
                L.geoJSON(feature, {
                    style: () => ({ color, fillColor: color, weight: 2 }),
                    onEachFeature: (_f: any, l: L.Layer) => newLayers.push(l),
                });
                if (newLayers.length > 0) {
                    setupLayerEventsRef.current(newLayers[0]);
                    groupRef.current.addLayer(newLayers[0]);
                    layerMap.set(index, newLayers[0]);
                }
            }
        });

        // Remove layers for features that no longer exist
        for (const [index, layer] of layerMap.entries()) {
            if (!newIndices.has(index)) {
                groupRef.current.removeLayer(layer);
                layerMap.delete(index);
            }
        }
    }, [data, layerId, groupRef]); // setupLayerEvents via ref — stable without being a dep

    return null;
}
