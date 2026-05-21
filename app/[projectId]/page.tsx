"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import { Project, Layer, getUserProjects, getProject, saveProjectLayers, forkProject } from '@/lib/firebase';
import { parseWKT, calculateStats, generateColor } from '@/lib/map-utils';
import { parseCSVLine } from '@/lib/csv-utils';
import Modal from '@/components/Modal';
import Toast, { type ToastType } from '@/components/Toast';
import UpgradeModal from '@/components/UpgradeModal';
import { stringify } from 'wellknown';
import { checkLimit, hasFeature } from '@/lib/plans';
// @ts-ignore
import tokml from 'tokml';

// Dynamically import Map to avoid SSR window issues
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium text-sm">Cargando mapa interactivo...</p>
        </div>
    )
});

function ProjectApp() {
    const { user, loading, userProfile } = useAuth();
    const plan = userProfile?.plan ?? 'free';
    const [upgradeModalReason, setUpgradeModalReason] = useState<React.ComponentProps<typeof UpgradeModal>['reason']>(undefined);
    const params = useParams();
    const projectId = params.projectId as string;

    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

    // States for feedback
    const [drawRequest, setDrawRequest] = useState<{ type: 'polygon' | 'point', id: number } | null>(null);
    const [flyToRequest, setFlyToRequest] = useState<any | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const showToast = (message: string, type: ToastType = 'info') => setToast({ message, type });

    // Selection State
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    const handleSelectionChange = (index: number, multi: boolean) => {
        setSelectedIndices(prev => {
            if (!multi) {
                // Single select: if clicking one of many, select just it.
                // If clicking the only selected one, keep it.
                // Standard behavior: clear others, set this one.
                const next = new Set<number>();
                next.add(index);
                return next;
            } else {
                // Multi select trigger
                const next = new Set(prev);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
            }
        });
    };

    // Clear selection when changing layers
    const handleSetActiveLayerId = (id: string | null) => {
        setActiveLayerId(id);
        setSelectedIndices(new Set());
    };

    // States for feedback
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load Projects for Sidebar context
    useEffect(() => {
        if (user) {
            loadUserProjects(user.uid);
        }
    }, [user]);

    // Load specific project from URL
    useEffect(() => {
        if (projectId) {
            getProject(projectId).then(p => {
                if (p) {
                    loadProject(p);
                } else {
                    // Project not found
                    window.location.href = '/404';
                }
            }).catch(e => {
                console.error("Error loading project:", e);
                window.location.href = '/404';
            });
        }
    }, [projectId]);

    // Access Control
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        if (loading) return; // Waiting for auth to initialize
        if (!currentProject) return; // Waiting for project data

        const isPublic = currentProject.isPublic;
        const isOwner = user && user.uid === currentProject.ownerId;
        const isCollaborator = user && user.email && currentProject.collaborators?.includes(user.email);

        if (!isPublic && !isOwner && !isCollaborator) {
            setAccessDenied(true);
        } else {
            setAccessDenied(false);
        }
    }, [user, loading, currentProject]);


    // Determine Access Level (ReadOnly)
    const isReadOnly = useMemo(() => {
        if (!currentProject) return true;
        if (accessDenied) return true; // Safety
        if (!user) return true;
        if (currentProject.ownerId === user.uid) return false;

        const userEmail = user.email;
        if (userEmail && currentProject.collaborators?.includes(userEmail)) {
            const role = currentProject.roles?.[userEmail];
            return role === 'viewer';
        }
        return true;
    }, [currentProject, user, accessDenied]);


    // Auto-save effect (debounced)
    useEffect(() => {
        if (!projectId || layers.length === 0) return;
        if (isReadOnly) return; // SKIP SAVE

        setIsSaving(true);
        const timeout = setTimeout(() => {
            if (currentProject) {
                saveProjectLayers(projectId, layers).then(() => {
                    setIsSaving(false);
                });
            }
        }, 2000);
        return () => clearTimeout(timeout);
    }, [layers, projectId, isReadOnly]);


    const loadUserProjects = async (uid: string) => {
        const pros = await getUserProjects(uid);
        setProjects(pros);
    };

    const loadProject = (project: Project) => {
        setCurrentProject(project);
        let loadedLayers = project.layers || [];
        if (loadedLayers.length === 0) {
            loadedLayers = [{ id: 'l1', name: 'Base', visible: true, features: { type: 'FeatureCollection', features: [] } }];
        }
        setLayers(loadedLayers);
        setActiveLayerId(loadedLayers[0].id);
        setIsSaving(false); // Reset saving state after load
    };

    const handleUpdateLayer = (layerId: string, features: any) => {
        setLayers(prev => prev.map(l => l.id === layerId ? { ...l, features } : l));
    };

    // --- Handlers for Sidebar ---

    const handleImportCsv = async (file: File) => {
        const text = await file.text();
        const lines = text.split(/\r?\n/);

        let headerIndex = -1;
        let nameColIndex = -1;
        let wktColIndex = -1; // Optional, if we want strict column finding, but line searching is robust for simple files.

        // Try to find header
        if (lines.length > 0) {
            const potentialHeader = lines[0].toLowerCase();
            if (potentialHeader.includes('name') || potentialHeader.includes('nombre') || potentialHeader.includes('label') || potentialHeader.includes('wkt')) {
                headerIndex = 0;
                // Use robust parser for header too
                const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, ''));
                nameColIndex = headers.findIndex(h => ['name', 'nombre', 'label', 'id'].includes(h));
            }
        }

        let addedCount = 0;
        const newFeatures = [];

        for (let i = 0; i < lines.length; i++) {
            if (i === headerIndex) continue; // Skip header
            const line = lines[i];
            if (!line.trim()) continue;

            const wktMatch = line.match(/(MULTIPOLYGON|POLYGON|POINT|LINESTRING|MULTILINESTRING|MULTIPOINT)\s*\([\s\d\.,\(\)\-\+]+\)/i);

            if (wktMatch) {
                const wkt = wktMatch[0];
                const geojson = parseWKT(wkt);

                // Try to extract name
                let name = `Objeto ${addedCount + 1}`;
                if (nameColIndex !== -1) {
                    const cols = parseCSVLine(line);
                    if (cols[nameColIndex]) {
                        name = cols[nameColIndex].trim().replace(/^"|"$/g, '');
                    }
                } else {
                    // Fallback: if no header, try to find a non-WKT string part or just default
                }

                if (geojson) {
                    newFeatures.push({
                        type: 'Feature',
                        geometry: geojson,
                        properties: {
                            name: name,
                            color: generateColor() // Ensure we have a color
                        }
                    });
                    addedCount++;
                }
            }
        }

        if (addedCount > 0) {
            const newLayerId = 'layer_' + Date.now();
            const newLayer: Layer = {
                id: newLayerId,
                name: file.name.replace('.csv', '').replace('.txt', '') || 'Capa Importada',
                visible: true,
                features: { type: 'FeatureCollection', features: newFeatures }
            };
            setLayers(prev => [...prev, newLayer]);
            setActiveLayerId(newLayerId);
            showToast(`Importados ${addedCount} objetos en nueva capa "${newLayer.name}".`, 'success');
        } else {
            showToast('No se encontraron geometrías WKT válidas en el archivo.', 'warning');
        }
    };

    const handleImportGeoJSON = async (file: File) => {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            let features: any[] = [];

            if (parsed.type === 'FeatureCollection') {
                features = parsed.features ?? [];
            } else if (parsed.type === 'Feature') {
                features = [parsed];
            } else if (parsed.type && parsed.coordinates) {
                features = [{ type: 'Feature', geometry: parsed, properties: {} }];
            } else {
                showToast('Formato GeoJSON no reconocido.', 'error');
                return;
            }

            const normalized = features
                .filter(f => f?.geometry)
                .map((f, i) => ({
                    ...f,
                    properties: {
                        ...f.properties,
                        name: f.properties?.name ?? f.properties?.NAME ?? f.properties?.nombre ?? `Objeto ${i + 1}`,
                        color: f.properties?.color ?? generateColor(),
                    },
                }));

            if (normalized.length === 0) { showToast('No se encontraron geometrías en el archivo GeoJSON.', 'warning'); return; }

            const newLayerId = 'layer_' + Date.now();
            const layerName = file.name.replace(/\.(geojson|json)$/i, '') || 'Capa GeoJSON';
            setLayers(prev => [...prev, { id: newLayerId, name: layerName, visible: true, features: { type: 'FeatureCollection', features: normalized } }]);
            setActiveLayerId(newLayerId);
            showToast(`Importados ${normalized.length} objetos desde "${layerName}".`, 'success');
        } catch {
            showToast('Error leyendo el archivo GeoJSON. Verifica que sea JSON válido.', 'error');
        }
    };

    const handleImportShapefile = async (file: File) => {
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

            if (features.length === 0) { showToast('No se encontraron geometrías en el Shapefile.', 'warning'); return; }

            const normalized = features.map((f, i) => ({
                ...f,
                properties: {
                    ...f.properties,
                    name: f.properties?.name ?? f.properties?.NAME ?? f.properties?.nombre ?? `Objeto ${i + 1}`,
                    color: generateColor(),
                },
            }));

            const newLayerId = 'layer_' + Date.now();
            const layerName = file.name.replace(/\.shp$/i, '') || 'Shapefile';
            setLayers(prev => [...prev, { id: newLayerId, name: layerName, visible: true, features: { type: 'FeatureCollection', features: normalized } }]);
            setActiveLayerId(newLayerId);
            showToast(`Importados ${normalized.length} objetos desde "${layerName}".`, 'success');
        } catch (err) {
            console.error(err);
            showToast('Error leyendo Shapefile. Asegúrate de seleccionar un archivo .shp válido.', 'error');
        }
    };

    const handleImportLatLng = async (file: File) => {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { showToast('El archivo debe tener al menos una fila de datos y un encabezado.', 'warning'); return; }

        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/"/g, ''));
        const latIdx = headers.findIndex(h => ['lat', 'latitude', 'latitud', 'y'].includes(h));
        const lngIdx = headers.findIndex(h => ['lon', 'lng', 'longitude', 'longitud', 'x'].includes(h));
        const nameIdx = headers.findIndex(h => ['name', 'nombre', 'label', 'titulo', 'title'].includes(h));

        if (latIdx === -1 || lngIdx === -1) {
            showToast('Columnas lat/lng no encontradas. Usa encabezados: lat, lng (o latitude/longitude).', 'warning');
            return;
        }

        const features: any[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const lat = parseFloat(cols[latIdx]);
            const lng = parseFloat(cols[lngIdx]);
            if (isNaN(lat) || isNaN(lng)) continue;
            const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx].trim().replace(/^"|"$/g, '') : `Punto ${features.length + 1}`;
            const extra: Record<string, string> = {};
            headers.forEach((h, idx) => {
                if (idx !== latIdx && idx !== lngIdx && !['name', 'nombre', 'color'].includes(h) && cols[idx]) {
                    extra[h] = cols[idx].trim().replace(/^"|"$/g, '');
                }
            });
            features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { name, color: generateColor(), ...extra } });
        }

        if (features.length === 0) { showToast('No se encontraron coordenadas válidas en el archivo.', 'warning'); return; }

        const newLayerId = 'layer_' + Date.now();
        const layerName = file.name.replace(/\.(csv|txt)$/i, '') || 'Puntos';
        setLayers(prev => [...prev, { id: newLayerId, name: layerName, visible: true, features: { type: 'FeatureCollection', features } }]);
        setActiveLayerId(newLayerId);
        showToast(`Importados ${features.length} puntos desde "${layerName}".`, 'success');
    };

    const handleImportFile = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'geojson' || ext === 'json') {
            await handleImportGeoJSON(file);
        } else if (ext === 'shp') {
            await handleImportShapefile(file);
        } else if (ext === 'csv' || ext === 'txt') {
            const text = await file.text();
            const firstLine = text.split('\n')[0].toLowerCase();
            const hasLatLng = (firstLine.match(/\blat(itude|itud)?\b/i) || firstLine.match(/\by\b/i)) &&
                              (firstLine.match(/\blon(gitude|gitud)?\b/i) || firstLine.match(/\blng\b/i) || firstLine.match(/\bx\b/i));
            if (hasLatLng) {
                await handleImportLatLng(file);
            } else {
                await handleImportCsv(file);
            }
        } else {
            showToast('Formato no soportado. Usa .csv, .geojson, o .shp', 'warning');
        }
    };

    const handleExportLayer = (layerId: string, format: 'csv' | 'geojson' | 'kml' = 'csv') => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;

        if (format === 'kml') {
            if (!hasFeature(plan, 'hasKmlExport')) {
                setUpgradeModalReason({ type: 'feature', featureKey: 'hasKmlExport', requiredPlan: 'pro' });
                return;
            }
            const kmlStr = tokml(layer.features, { documentName: layer.name, documentDescription: '' });
            const dataStr = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kmlStr);
            const a = document.createElement('a');
            a.setAttribute("href", dataStr);
            a.setAttribute("download", `${layer.name}.kml`);
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }

        if (format === 'geojson') {
            const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layer.features, null, 2));
            const a = document.createElement('a');
            a.setAttribute("href", dataStr);
            a.setAttribute("download", `${layer.name}.geojson`);
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }

        // CSV (default, free)
        let csvContent = "id,name,color,WKT\n";
        layer.features.features.forEach((feature: any, index: number) => {
            const props = feature.properties || {};
            const name = (props.name || `Objeto ${index + 1}`).replace(/"/g, '""');
            const color = (props.color || '#000000').replace(/"/g, '""');
            let wkt = "";
            try { wkt = stringify(feature.geometry); } catch (e) { console.error(e); }
            csvContent += `"${index}","${name}","${color}","${wkt}"\n`;
        });

        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", `${layer.name}.csv`);
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handleAddFeature = () => {
        // Trigger Polygon drawing
        setDrawRequest({ type: 'polygon', id: Date.now() });
        // Maybe show toast?
    };

    const handleCopyWkt = (feature: any) => {
        // Convert GeoJSON geometry back to WKT
        // I need a toWKT function. 'tokml' is in package.json, 'wellknown' is there too.
        // 'wellknown' has stringify().
        try {
            const wkt = stringify(feature.geometry);
            navigator.clipboard.writeText(wkt).then(() => {
                showToast('WKT copiado al portapapeles', 'success');
            });
        } catch (e) {
            console.error("Error copying WKT", e);
            showToast('Error generando WKT', 'error');
        }
    };

    const handleExportProject = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProject));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (currentProject?.name || "project") + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleFocusFeature = (feature: any) => {
        setFlyToRequest(feature);
    };

    const [isForkingProject, setIsForkingProject] = useState(false);
    const handleForkProject = async () => {
        if (!user || !currentProject?.id) return;
        setIsForkingProject(true);
        try {
            const newId = await forkProject(currentProject.id, user.uid, user.displayName ?? 'Usuario', user.email ?? '');
            showToast('Proyecto duplicado a tu cuenta. Abriendo...', 'success');
            setTimeout(() => { window.location.href = `/${newId}`; }, 1200);
        } catch (e) {
            showToast('Error al duplicar el proyecto', 'error');
            setIsForkingProject(false);
        }
    };

    const canFork = !loading && user && currentProject && currentProject.ownerId !== user.uid && currentProject.isPublic;

    if (accessDenied) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-50 flex-col gap-4">
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-center max-w-md">
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Acceso Restringido</h1>
                    <p className="text-slate-600 mb-4 text-sm">Este proyecto es privado y no tienes permisos para verlo.</p>
                    <a href="/" className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                        Volver al Inicio
                    </a>
                </div>
            </div>
        );
    }

    if (loading) return <div>Cargando...</div>;

    return (
        <div className="flex h-screen w-screen overflow-hidden">
            <Sidebar
                projects={projects}
                currentProject={currentProject}
                layers={layers}
                setLayers={setLayers}
                activeLayerId={activeLayerId}
                setActiveLayerId={handleSetActiveLayerId}
                onLoadProject={loadProject}
                isSaving={isSaving}
                isReadOnly={isReadOnly}
                // New Props
                onImportCsv={handleImportCsv}
                onImportFile={handleImportFile}
                onExportLayer={handleExportLayer}
                onAddFeature={handleAddFeature}
                onCopyWkt={handleCopyWkt}
                onFocusFeature={handleFocusFeature}
                // Legacy
                onExportProject={() => { }}
                // Selection
                selectedIndices={selectedIndices}
                onToggleSelection={handleSelectionChange}
                onClearSelection={() => setSelectedIndices(new Set())}
                onShowToast={showToast}
            />
            <div className="flex-1 relative">
                {canFork && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400]">
                        <button
                            onClick={handleForkProject}
                            disabled={isForkingProject}
                            className="flex items-center gap-2 bg-white border border-slate-200 shadow-md rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                        >
                            {isForkingProject ? (
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            )}
                            {isForkingProject ? 'Duplicando...' : 'Duplicar a mi cuenta'}
                        </button>
                    </div>
                )}
                <Map
                    layers={layers}
                    activeLayerId={activeLayerId}
                    onUpdateLayer={handleUpdateLayer}
                    requestDraw={drawRequest}
                    requestFlyTo={flyToRequest}
                    onShowToast={showToast}
                    selectedIndices={selectedIndices}
                    onToggleSelection={handleSelectionChange}
                    onClearSelection={() => setSelectedIndices(new Set())}
                    plan={plan}
                    onUpgradeRequired={(reason) => setUpgradeModalReason(reason as any)}
                    projectId={projectId}
                    isReadOnly={isReadOnly}
                />
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                    duration={3000}
                />
            )}

            <UpgradeModal
                isOpen={!!upgradeModalReason}
                onClose={() => setUpgradeModalReason(undefined)}
                reason={upgradeModalReason}
                onShowToast={showToast}
            />
        </div>
    );
}

export default function Page() {
    return (
        <AuthWrapper>
            <ProjectApp />
        </AuthWrapper>
    );
}
