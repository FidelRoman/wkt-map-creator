"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Toast from '@/components/Toast';
import Sidebar from '@/components/Sidebar';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import { generateColor, parseWKT } from '@/lib/map-utils';
import { parseCSVLine } from '@/lib/csv-utils';
import { auth, googleProvider, createProject, saveProjectLayers } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, type User } from 'firebase/auth';
import { stringify } from 'wellknown';
import { useRouter } from 'next/navigation';

const SANDBOX_STORAGE_KEY = 'wkt_sandbox_layer';
const SANDBOX_LIMITS = { maxFeatures: 50 };

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100">Loading Map...</div>
});

function makeSandboxLayer() {
    return {
        id: 'sandbox_layer',
        name: 'Mi Mapa',
        visible: true,
        features: { type: 'FeatureCollection', features: [] as any[] }
    };
}

function SandboxEditor() {
    const { user } = useAuth();
    const router = useRouter();
    const [layers, setLayers] = useState([makeSandboxLayer()]);
    const [activeLayerId] = useState('sandbox_layer');
    const [toast, setToast] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [drawRequest, setDrawRequest] = useState<{ type: 'polygon' | 'point'; id: number } | null>(null);
    const [flyToRequest, setFlyToRequest] = useState<any | null>(null);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Ref so the auth callback can read the latest layers without stale closure
    const layersRef = useRef(layers);
    layersRef.current = layers;

    // If user is already logged in, redirect to dashboard
    useEffect(() => {
        if (user) router.replace('/');
    }, [user]);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(SANDBOX_STORAGE_KEY);
            if (saved) setLayers([JSON.parse(saved)]);
        } catch { /* ignore */ }
    }, []);

    // Persist to localStorage on every change
    useEffect(() => {
        if (layers[0]) {
            localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(layers[0]));
        }
    }, [layers]);

    const migrateAndRedirect = useCallback(async (user: User) => {
        setSaving(true);
        try {
            const currentLayer = layersRef.current[0];
            const hasFeatures = (currentLayer?.features?.features?.length ?? 0) > 0;

            const { id } = await createProject(
                'Mi Primer Mapa',
                user.uid,
                user.displayName ?? 'Anonymous',
                user.email ?? ''
            );

            if (hasFeatures) {
                await saveProjectLayers(id, [{ ...currentLayer, id: 'layer_1' }]);
            }

            localStorage.removeItem(SANDBOX_STORAGE_KEY);
            window.location.href = `/${id}`;
        } catch (err) {
            console.error(err);
            setSaving(false);
            setToast('Error saving. Please try again.');
        }
    }, []);

    const handleSave = useCallback(async () => {
        if (saving) return;

        if (auth.currentUser) {
            await migrateAndRedirect(auth.currentUser);
            return;
        }

        setSaving(true);
        try {
            // Subscribe BEFORE popup to avoid race condition
            const unsubscribe = onAuthStateChanged(auth, (u) => {
                if (u) {
                    unsubscribe();
                    migrateAndRedirect(u);
                }
            });
            await signInWithPopup(auth, googleProvider);
        } catch (err: any) {
            if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
                setToast('Sign-in failed. Please try again.');
            }
            setSaving(false);
        }
    }, [saving, migrateAndRedirect]);

    const handleImportCsv = async (file: File) => {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
            setToast('The CSV file is empty or has no data rows.');
            return;
        }
        const newFeatures: any[] = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = parseCSVLine(line);
            const wktMatch = line.match(/\b(POLYGON|MULTIPOLYGON|POINT|LINESTRING|MULTILINESTRING|MULTIPOINT)\s*\(.*?\)/i);
            if (!wktMatch) continue;
            const geojson = parseWKT(wktMatch[0]);
            if (!geojson) continue;
            newFeatures.push({ type: 'Feature', geometry: geojson, properties: { name: cols[1] || `Feature ${i}`, color: generateColor() } });
        }
        if (newFeatures.length === 0) {
            setToast('No WKT geometries found in the CSV. Make sure rows contain POLYGON, POINT, etc.');
            return;
        }
        const currentCount = layersRef.current[0]?.features?.features?.length ?? 0;
        const remaining = SANDBOX_LIMITS.maxFeatures - currentCount;
        const toAdd = newFeatures.slice(0, remaining);
        setLayers(prev => [{
            ...prev[0],
            features: { type: 'FeatureCollection', features: [...(prev[0].features?.features ?? []), ...toAdd] }
        }]);
        if (toAdd.length < newFeatures.length) {
            setToast(`Only ${toAdd.length} of ${newFeatures.length} features added (demo limit: ${SANDBOX_LIMITS.maxFeatures}). Save to continue.`);
        } else {
            setToast(`${toAdd.length} features imported successfully.`);
        }
    };

    const handleImportFile = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const currentCount = layersRef.current[0]?.features?.features?.length ?? 0;
        const remaining = SANDBOX_LIMITS.maxFeatures - currentCount;

        if (ext === 'geojson' || ext === 'json') {
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                let features: any[] = [];
                if (parsed.type === 'FeatureCollection') features = parsed.features ?? [];
                else if (parsed.type === 'Feature') features = [parsed];
                else if (parsed.type && parsed.coordinates) features = [{ type: 'Feature', geometry: parsed, properties: {} }];
                else { setToast('Unrecognized GeoJSON format.'); return; }

                const normalized = features.filter(f => f?.geometry).map((f, i) => ({
                    ...f,
                    properties: { ...f.properties, name: f.properties?.name ?? `Feature ${i + 1}`, color: generateColor() },
                }));
                if (normalized.length === 0) { setToast('No geometries found in the GeoJSON file.'); return; }

                const toAdd = normalized.slice(0, remaining);
                setLayers(prev => [{
                    ...prev[0],
                    features: { type: 'FeatureCollection', features: [...(prev[0].features?.features ?? []), ...toAdd] }
                }]);
                const msg = toAdd.length < normalized.length
                    ? `Only ${toAdd.length} of ${normalized.length} features added (demo limit). Save to continue.`
                    : `${toAdd.length} features imported from GeoJSON.`;
                setToast(msg);
            } catch {
                setToast('Error reading GeoJSON. Make sure it is valid JSON.');
            }

        } else if (ext === 'shp') {
            try {
                const shapefile = await import('shapefile');
                const arrayBuffer = await file.arrayBuffer();
                const source = await shapefile.open(arrayBuffer as any);
                const features: any[] = [];
                let result = await source.read();
                while (!result.done) {
                    if (result.value) features.push(result.value);
                    result = await source.read();
                }
                if (features.length === 0) { setToast('No geometries found in the Shapefile.'); return; }
                const normalized = features.map((f, i) => ({
                    ...f,
                    properties: { ...f.properties, name: f.properties?.name ?? `Feature ${i + 1}`, color: generateColor() },
                }));
                const toAdd = normalized.slice(0, remaining);
                setLayers(prev => [{
                    ...prev[0],
                    features: { type: 'FeatureCollection', features: [...(prev[0].features?.features ?? []), ...toAdd] }
                }]);
                setToast(toAdd.length < normalized.length
                    ? `Only ${toAdd.length} of ${normalized.length} features added (demo limit). Save to continue.`
                    : `${toAdd.length} features imported from Shapefile.`);
            } catch {
                setToast('Error reading Shapefile. Make sure you selected a valid .shp file.');
            }

        } else if (ext === 'csv' || ext === 'txt') {
            const text = await file.text();
            const firstLine = text.split('\n')[0].toLowerCase();
            const hasLatLng = /\blat(itude|itud)?\b/.test(firstLine) && /\b(lon(gitude|gitud)?|lng)\b/.test(firstLine);
            if (hasLatLng) {
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 2) { setToast('The CSV file is empty or has no data rows.'); return; }
                const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/"/g, ''));
                const latIdx = headers.findIndex(h => ['lat', 'latitude', 'latitud', 'y'].includes(h));
                const lngIdx = headers.findIndex(h => ['lon', 'lng', 'longitude', 'longitud', 'x'].includes(h));
                const nameIdx = headers.findIndex(h => ['name', 'nombre', 'label'].includes(h));
                if (latIdx === -1 || lngIdx === -1) { setToast('lat/lng columns not found. Use headers: lat, lng (or latitude/longitude).'); return; }
                const features: any[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = parseCSVLine(lines[i]);
                    const lat = parseFloat(cols[latIdx]);
                    const lng = parseFloat(cols[lngIdx]);
                    if (isNaN(lat) || isNaN(lng)) continue;
                    const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx].trim().replace(/^"|"$/g, '') : `Point ${features.length + 1}`;
                    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { name, color: generateColor() } });
                }
                if (features.length === 0) { setToast('No valid coordinates found in the file.'); return; }
                const toAdd = features.slice(0, remaining);
                setLayers(prev => [{
                    ...prev[0],
                    features: { type: 'FeatureCollection', features: [...(prev[0].features?.features ?? []), ...toAdd] }
                }]);
                setToast(toAdd.length < features.length
                    ? `Only ${toAdd.length} of ${features.length} points added (demo limit). Save to continue.`
                    : `${toAdd.length} points imported.`);
            } else {
                await handleImportCsv(file);
            }
        } else {
            setToast('Unsupported format. Use .csv, .geojson or .shp');
        }
    };

    const handleExportLayer = (layerId: string) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;
        let csvContent = "id,name,color,WKT\n";
        layer.features.features.forEach((feature: any, index: number) => {
            const props = feature.properties || {};
            const name = (props.name || `Feature ${index + 1}`).replace(/"/g, '""');
            const color = (props.color || '#000000').replace(/"/g, '""');
            let wkt = "";
            try { wkt = stringify(feature.geometry); } catch { /* ignore */ }
            csvContent += `"${index}","${name}","${color}","${wkt}"\n`;
        });
        const a = document.createElement('a');
        a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        a.download = `${layer.name}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handleUpdateLayer = (layerId: string, features: any) => {
        setLayers(prev => prev.map(l => l.id === layerId ? { ...l, features } : l));
    };

    const handleCopyWkt = (feature: any) => {
        try {
            const wkt = stringify(feature.geometry);
            navigator.clipboard.writeText(wkt).then(() => setToast('WKT copied to clipboard'));
        } catch { setToast('Error copying WKT'); }
    };

    const handleSelectionChange = (index: number, multi: boolean) => {
        setSelectedIndices(prev => {
            if (!multi) return new Set([index]);
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const featureCount = layers[0]?.features?.features?.length ?? 0;
    const limitReached = featureCount >= SANDBOX_LIMITS.maxFeatures;

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden">
            {/* Sandbox limit banner */}
            {limitReached && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm flex-shrink-0 z-20">
                    <span className="text-amber-800">
                        Demo limit: {SANDBOX_LIMITS.maxFeatures} features. Save your project to continue without limits.
                    </span>
                    <button onClick={handleSave} className="ml-4 text-indigo-600 font-semibold hover:underline flex-shrink-0">
                        Save for free →
                    </button>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                <Sidebar
                    projects={[]}
                    currentProject={null}
                    layers={layers as any}
                    setLayers={setLayers as any}
                    activeLayerId={activeLayerId}
                    setActiveLayerId={() => {}}
                    onLoadProject={() => {}}
                    isSaving={false}
                    onImportCsv={handleImportCsv}
                    onImportFile={handleImportFile}
                    onExportLayer={handleExportLayer}
                    onAddFeature={() => setDrawRequest({ type: 'polygon', id: Date.now() })}
                    onCopyWkt={handleCopyWkt}
                    onFocusFeature={(f) => setFlyToRequest(f)}
                    onExportProject={() => {}}
                    selectedIndices={selectedIndices}
                    onToggleSelection={handleSelectionChange}
                    onClearSelection={() => setSelectedIndices(new Set())}
                    sandboxMode
                    onSandboxSave={handleSave}
                    isSandboxSaving={saving}
                />
                <div className="flex-1 relative">
                    <Map
                        layers={layers as any}
                        activeLayerId={activeLayerId}
                        onUpdateLayer={handleUpdateLayer}
                        requestDraw={drawRequest}
                        requestFlyTo={flyToRequest}
                        onShowToast={setToast}
                        selectedIndices={selectedIndices}
                        onToggleSelection={handleSelectionChange}
                        onClearSelection={() => setSelectedIndices(new Set())}
                        plan="free"
                    />
                </div>
            </div>

            {toast && <Toast message={toast} onClose={() => setToast(null)} duration={4000} />}
        </div>
    );
}

export default function EditorPage() {
    return (
        <AuthWrapper>
            <SandboxEditor />
        </AuthWrapper>
    );
}
