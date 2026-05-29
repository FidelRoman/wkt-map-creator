"use client";
import { useState, useEffect, useRef } from 'react';
import MapControls, { MAP_LAYERS } from './map/MapControls';

import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Layer } from '@/lib/firebase';
import ActiveLayerEditor from './map/ActiveLayerEditor';
import type { PlanId } from '@/lib/plans';
import type { ToastType } from './Toast';

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
    onShowToast?: (message: string, type?: ToastType) => void;
    selectedIndices?: Set<number>;
    onToggleSelection?: (index: number, multi: boolean) => void;
    onClearSelection?: () => void;
    plan?: PlanId;
    onUpgradeRequired?: (reason: any) => void;
    projectId?: string;
    isReadOnly?: boolean;
}

function MapAutoFit({ layers, projectId }: { layers: Layer[]; projectId?: string }) {
    const map = useMap();
    const fittedRef = useRef(false);

    useEffect(() => {
        if (fittedRef.current) return;

        // 1. Restore last saved position for this project
        if (projectId) {
            const saved = localStorage.getItem(`wkt-map-pos-${projectId}`);
            if (saved) {
                try {
                    const { center, zoom } = JSON.parse(saved);
                    map.setView(center, zoom, { animate: false });
                    fittedRef.current = true;
                    return;
                } catch {}
            }
        }

        // 2. No saved position — fit to all features
        const allFeatures = layers.flatMap(l => l.features?.features ?? []).filter(f => f?.geometry);
        if (allFeatures.length > 0) {
            try {
                const bounds = L.geoJSON({ type: 'FeatureCollection', features: allFeatures } as any).getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [60, 60], animate: false, maxZoom: 16 });
                    fittedRef.current = true;
                }
            } catch {}
        }
    }, [layers]);

    // Save position whenever the user pans or zooms
    useMapEvents({
        moveend() {
            if (!projectId) return;
            const c = map.getCenter();
            localStorage.setItem(`wkt-map-pos-${projectId}`, JSON.stringify({
                center: [c.lat, c.lng],
                zoom: map.getZoom(),
            }));
        },
    });

    return null;
}

export default function MapComponent(props: MapProps) {
    const { projectId, isReadOnly, ...rest } = props;
    const [activeTileLayer, setActiveTileLayer] = useState("light");

    // @ts-ignore
    const currentLayer = MAP_LAYERS[activeTileLayer] || MAP_LAYERS['osm'];

    return (
        <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }}>
            <MapAutoFit layers={props.layers} projectId={projectId} />
            <MapControls activeTileLayer={activeTileLayer} setActiveTileLayer={setActiveTileLayer} />
            <TileLayer
                attribution={currentLayer.attribution}
                url={currentLayer.url}
            />
            {/* Non-active layers (Visual only) */}
            {props.layers.map(layer => {
                if (layer.id === props.activeLayerId || !layer.visible) return null;
                const s = layer.style;
                const pathOptions = s ? {
                    color: s.strokeColor ?? '#64748b',
                    weight: s.strokeWidth ?? 2,
                    opacity: s.strokeOpacity ?? 1,
                    fillColor: s.fillColor ?? '#64748b',
                    fillOpacity: s.fillOpacity ?? 0.4,
                } : { color: '#64748b' };
                return (
                    <GeoJSON
                        key={`${layer.id}-${JSON.stringify(s)}`}
                        data={layer.features}
                        pathOptions={pathOptions}
                        pointToLayer={s?.pointRadius ? (_feature, latlng) =>
                            L.circleMarker(latlng, { radius: s.pointRadius }) : undefined}
                    />
                );
            })}

            {/* Active editing layer */}
            <ActiveLayerEditor {...rest} projectId={projectId} isReadOnly={isReadOnly} />
        </MapContainer>
    );
}
