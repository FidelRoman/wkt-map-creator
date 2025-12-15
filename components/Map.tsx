"use client";
import { useState } from 'react';
import MapControls, { MAP_LAYERS } from './map/MapControls';

import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Layer } from '@/lib/firebase';
import ActiveLayerEditor from './map/ActiveLayerEditor'; // Import extracted component

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

export default function MapComponent(props: MapProps) {
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
                return <GeoJSON key={layer.id} data={layer.features} pathOptions={{ color: '#64748b' }} />;
            })}

            {/* Active editing layer */}
            <ActiveLayerEditor {...props} />
        </MapContainer>
    );
}
