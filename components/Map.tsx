"use client";
import { useState } from 'react';
import MapControls, { MAP_LAYERS } from './map/MapControls';

import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
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

export default function MapComponent(props: MapProps) {
    const { projectId, isReadOnly, ...rest } = props;
    const [activeTileLayer, setActiveTileLayer] = useState("light");

    // @ts-ignore
    const currentLayer = MAP_LAYERS[activeTileLayer] || MAP_LAYERS['osm'];

    return (
        <MapContainer center={[-12.0464, -77.0428]} zoom={12} style={{ height: "100%", width: "100%" }}>
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
