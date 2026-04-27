import { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface MapControlsProps {
    activeTileLayer: string;
    setActiveTileLayer: (layer: string) => void;
}

export const MAP_LAYERS: Record<string, { name: string, url: string, attribution: string, preview?: string }> = {
    'osm': {
        name: 'Estándar',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
        preview: 'https://a.tile.openstreetmap.org/12/2048/1360.png'
    },
    'satellite': {
        name: 'Satélite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1360/2048'
    },
    'terrain': {
        name: 'Terreno',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
        preview: 'https://a.tile.opentopomap.org/12/2048/1360.png'
    },
    'dark': {
        name: 'Oscuro',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        preview: 'https://a.basemaps.cartocdn.com/dark_all/12/2048/1360.png'
    },
    'light': {
        name: 'Claro',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        preview: 'https://a.basemaps.cartocdn.com/light_all/12/2048/1360.png'
    },
    'mapbox_streets': {
        name: 'Mapbox Streets',
        url: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        attribution: '© Mapbox',
        preview: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/12/2048/1360?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    },
    'mapbox_outdoors': {
        name: 'Mapbox Outdoors',
        url: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        attribution: '© Mapbox',
        preview: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/tiles/12/2048/1360?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    },
    'mapbox_light': {
        name: 'Mapbox Light',
        url: `https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        attribution: '© Mapbox',
        preview: `https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/12/2048/1360?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    },
    'mapbox_dark': {
        name: 'Mapbox Dark',
        url: `https://api.mapbox.com/styles/v1/mapbox/dark-v10/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        attribution: '© Mapbox',
        preview: `https://api.mapbox.com/styles/v1/mapbox/dark-v10/tiles/12/2048/1360?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    },
    'mapbox_satellite': {
        name: 'Mapbox Satélite',
        url: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        attribution: '© Mapbox',
        preview: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/12/2048/1360?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    },
    'mapbox_satellite_streets': {
        name: 'Mapbox Sat. Calles',
        url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v11/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        attribution: '© Mapbox',
        preview: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v11/tiles/12/2048/1360?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    }
};

export default function MapControls({ activeTileLayer, setActiveTileLayer }: MapControlsProps) {
    const map = useMap();
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [showLayerMenu, setShowLayerMenu] = useState(false);
    const [showDonateModal, setShowDonateModal] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length < 3) {
                setSuggestions([]);
                return;
            }

            setIsSearching(true);
            try {
                const PERU_VIEWBOX = "-81.5,0.5,-68,-19"; // left,top,right,bottom
                const url = new URL("https://nominatim.openstreetmap.org/search");
                url.searchParams.set("format", "jsonv2");
                url.searchParams.set("accept-language", "es-PE,es");
                url.searchParams.set("q", searchQuery);
                url.searchParams.set("limit", "10");
                url.searchParams.set("addressdetails", "1");
                url.searchParams.set("countrycodes", "pe");
                url.searchParams.set("dedupe", "1");
                url.searchParams.set("viewbox", PERU_VIEWBOX);
                // url.searchParams.set("bounded", "1");

                const response = await fetch(url.toString());
                const data = await response.json();
                setSuggestions(data);
                setShowSuggestions(true);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectSuggestion = (suggestion: any) => {
        const lat = parseFloat(suggestion.lat);
        const lon = parseFloat(suggestion.lon);
        map.flyTo([lat, lon], 18, { duration: 1.5 });
        setSearchQuery(suggestion.display_name);
        setShowSuggestions(false);
    };

    const toggleLayerMenu = () => {
        setShowLayerMenu(!showLayerMenu);
    };

    return (
        <>
            {/* Search Bar - Top Left */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '60px', // Right of zoom controls (Leaflet defaults left)
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                width: '300px'
            }}>
                <div style={{ display: 'flex', background: 'white', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
                        placeholder="Buscar dirección..."
                        style={{ border: 'none', padding: '8px 12px', borderRadius: '4px', outline: 'none', flex: 1 }}
                    />
                    <div style={{ padding: '8px', color: '#666' }}>
                        {isSearching ? (
                            <div style={{
                                width: '16px', height: '16px',
                                border: '2px solid #ccc', borderTop: '2px solid #3b82f6',
                                borderRadius: '50%', animation: 'spin 1s linear infinite'
                            }} />
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        )}
                    </div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div style={{
                        marginTop: '5px',
                        background: 'white',
                        borderRadius: '4px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {suggestions.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSelectSuggestion(item)}
                                style={{
                                    padding: '8px 12px',
                                    borderBottom: idx < suggestions.length - 1 ? '1px solid #eee' : 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                {item.display_name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Controls Right Side */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '10px'
            }}>
                {/* Layer Selector */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={toggleLayerMenu}
                        style={{
                            background: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                        <span>Capas</span>
                    </button>

                    {showLayerMenu && (
                        <div style={{
                            position: 'absolute',
                            top: '40px',
                            right: '0',
                            background: 'white',
                            padding: '10px',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            width: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            {Object.entries(MAP_LAYERS).map(([key, layer]) => (
                                <div
                                    key={key}
                                    onClick={() => { setActiveTileLayer(key); setShowLayerMenu(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '5px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        backgroundColor: activeTileLayer === key ? '#eff6ff' : 'transparent',
                                        border: activeTileLayer === key ? '1px solid #3b82f6' : '1px solid transparent'
                                    }}
                                >
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        border: '1px solid #ddd',
                                        backgroundImage: `url(${layer.preview})`,
                                        backgroundSize: 'cover'
                                    }} />
                                    <span style={{ fontSize: '14px', fontWeight: activeTileLayer === key ? 500 : 400 }}>{layer.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Donate Button */}
                <button
                    onClick={() => setShowDonateModal(true)}
                    style={{
                        background: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <img src="/yape.png" alt="Yape" width="32" height="32" style={{ borderRadius: '4px' }} />
                </button>
            </div>

            {/* Donate Modal */}
            {showDonateModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '30px',
                        borderRadius: '12px',
                        maxWidth: '400px',
                        width: '90%',
                        textAlign: 'center',
                        position: 'relative',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <button 
                            onClick={() => setShowDonateModal(false)}
                            style={{ 
                                position: 'absolute', top: '15px', right: '15px', 
                                background: '#f3f4f6', border: 'none', cursor: 'pointer', 
                                width: '30px', height: '30px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '18px', color: '#6b7280'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                        >
                            ✕
                        </button>
                        <h3 style={{ marginTop: '10px', color: '#1f2937', fontSize: '20px' }}>¡Apoya este proyecto!</h3>
                        <p style={{ color: '#4b5563', lineHeight: '1.5', marginTop: '10px' }}>
                            Si te gustó este proyecto, puedes colaborar yapeando al siguiente QR:
                        </p>
                        <div style={{ 
                            width: '200px', height: '200px', 
                            margin: '25px auto', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb'
                        }}>
                            <img src="/qr.jpeg" alt="Código QR Yape" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <p style={{ fontWeight: '600', color: '#111827', margin: '0', fontSize: '18px' }}>Nombre: Luis Roman</p>
                    </div>
                </div>
            )}
        </>
    );
}
