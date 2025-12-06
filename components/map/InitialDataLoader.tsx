import { useEffect } from 'react';
import L from 'leaflet';

interface InitialDataLoaderProps {
    data: any;
    groupRef: any;
    setupLayerEvents: (l: any) => void;
}

export default function InitialDataLoader({ data, groupRef, setupLayerEvents }: InitialDataLoaderProps) {
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
