"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import { Project, Layer, getUserProjects, getProject, saveProjectLayers } from '@/lib/firebase';
import { parseWKT, calculateStats } from '@/lib/map-utils';
import Modal from '@/components/Modal';
import { stringify } from 'wellknown'; // Assuming we can use this to reverse if needed, or just use property

// Dynamically import Map to avoid SSR window issues
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100">Cargando Mapa...</div>
});

function ProjectApp() {
    const { user, loading } = useAuth();
    const params = useParams();
    const projectId = params.projectId as string;

    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

    // States for feedback
    const [drawRequest, setDrawRequest] = useState<{ type: 'polygon' | 'point', id: number } | null>(null);

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
                if (p) loadProject(p);
            });
        }
    }, [projectId]);

    // Auto-save effect (debounced)
    useEffect(() => {
        if (!projectId || layers.length === 0) return;

        setIsSaving(true);
        const timeout = setTimeout(() => {
            if (currentProject) {
                saveProjectLayers(projectId, layers).then(() => {
                    setIsSaving(false);
                });
            }
        }, 2000);
        return () => clearTimeout(timeout);
    }, [layers, projectId]);


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
        if (!activeLayerId) {
            alert("Selecciona una capa primero");
            return;
        }

        const text = await file.text();
        const lines = text.split(/\r?\n/);
        // Simple CSV parser: Look for WKT in each line.
        // Or if it has headers, try to find a "wkt" column.
        // Fallback: try to parse the whole line as WKT? Or find a substring starting with POLYGON/POINT?

        let addedCount = 0;
        const newFeatures = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            // Clean quotes if CSV
            // A very naive matching: find first occurrence of "POLYGON", "POINT", "LINESTRING", etc.
            // Or just regex for WKT pattern.
            const wktMatch = line.match(/(MULTIPOLYGON|POLYGON|POINT|LINESTRING|MULTILINESTRING|MULTIPOINT)\s*\([\s\d\.,\(\)\-\+]+\)/i);

            if (wktMatch) {
                const wkt = wktMatch[0];
                const geojson = parseWKT(wkt);
                if (geojson) {
                    newFeatures.push({
                        type: 'Feature',
                        geometry: geojson,
                        properties: { name: `Imported ${addedCount + 1}` }
                    });
                    addedCount++;
                }
            }
        }

        if (addedCount > 0) {
            const active = layers.find(l => l.id === activeLayerId);
            if (active) {
                const currentFeats = active.features?.features || [];
                const updatedFeats = {
                    type: 'FeatureCollection',
                    features: [...currentFeats, ...newFeatures]
                };
                handleUpdateLayer(activeLayerId, updatedFeats);
                alert(`Importados ${addedCount} objetos exitosamente.`);
            }
        } else {
            alert("No se encontraron geometrías WKT válidas en el archivo.");
        }
    };

    const handleExportLayer = (layerId: string) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layer.features));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${layer.name}.geojson`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
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
                // Toast or something? 
                alert("WKT copiado al portapapeles"); // Simple for now
            });
        } catch (e) {
            console.error("Error copying WKT", e);
            alert("Error generando WKT");
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

    if (loading) return <div>Cargando...</div>;

    return (
        <div className="flex h-screen w-screen overflow-hidden">
            <Sidebar
                projects={projects}
                currentProject={currentProject}
                layers={layers}
                setLayers={setLayers}
                activeLayerId={activeLayerId}
                setActiveLayerId={setActiveLayerId}
                onLoadProject={loadProject}
                // New Props
                onImportCsv={handleImportCsv}
                onExportLayer={handleExportLayer}
                onAddFeature={handleAddFeature}
                onCopyWkt={handleCopyWkt}
                onExportProject={handleExportProject}
            />
            <div className="flex-1 relative">
                <Map
                    layers={layers}
                    activeLayerId={activeLayerId}
                    onUpdateLayer={handleUpdateLayer}
                    requestDraw={drawRequest}
                />

                <div className="ui-overlay pointer-events-none">
                    <header className="app-header pointer-events-auto flex justify-between items-center">
                        {/* Show Project Name if available */}
                        <h1>{currentProject ? currentProject.name : 'WKT Map Creator'}</h1>
                        <div className="text-sm text-slate-500 font-medium bg-white/80 px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                            {isSaving ? (
                                <span className="flex items-center gap-2 text-blue-600">
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Guardando...
                                </span>
                            ) : 'Guardado'}
                        </div>
                    </header>
                </div>
            </div>
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
