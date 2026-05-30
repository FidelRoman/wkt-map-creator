import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface InitialDataLoaderProps {
    data: any;
    layerId: string | null;
    groupRef: any;
    setupLayerEvents: (l: any) => void;
}

export default function InitialDataLoader({ data, layerId, groupRef, setupLayerEvents }: InitialDataLoaderProps) {
    // Ref keeps the latest setupLayerEvents without adding it to effect deps
    const setupLayerEventsRef = useRef(setupLayerEvents);
    setupLayerEventsRef.current = setupLayerEvents;

    // Rebuild the FeatureGroup from state on every change. State (the GeoJSON
    // passed in `data`) is the single source of truth, so the map always
    // matches it exactly: no leftover layers after union/delete, and no
    // duplicates when drawing (the raw leaflet-draw layer is wiped and the
    // feature is re-rendered once from state).
    //
    // NOTE: an earlier "in-place update by feature index" optimisation lived
    // here, but it desynced from state — the untracked leaflet-draw layer was
    // rendered twice, and index reconciliation left merged-away polygons on the
    // map after a union. Correctness wins; clearing and rebuilding is cheap for
    // the layer sizes this app handles.
    useEffect(() => {
        const group = groupRef.current;
        if (!group || !data || data.type !== 'FeatureCollection') return;

        group.clearLayers();

        L.geoJSON(data, {
            style: (feature: any) => {
                const color = feature?.properties?.color || '#3388ff';
                return { color, fillColor: color, weight: 2 };
            },
            onEachFeature: (_feature: any, layer: L.Layer) => {
                setupLayerEventsRef.current(layer);
                group.addLayer(layer);
            },
        });
    }, [data, layerId, groupRef]); // setupLayerEvents via ref — stable without being a dep

    return null;
}
