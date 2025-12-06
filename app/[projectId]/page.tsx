"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import { Project, Layer, getUserProjects, getProject, saveProjectLayers } from '@/lib/firebase';
import { parseWKT, calculateStats, generateColor } from '@/lib/map-utils';
import { parseCSVLine } from '@/lib/csv-utils';
import Modal from '@/components/Modal';
import Toast from '@/components/Toast';
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
    const [flyToRequest, setFlyToRequest] = useState<any | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

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
                features: {
                    type: 'FeatureCollection',
                    features: newFeatures
                }
            };

            setLayers(prev => [...prev, newLayer]);
            setActiveLayerId(newLayerId);
            alert(`Importados ${addedCount} objetos en nueva capa "${newLayer.name}".`);
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
                setToastMessage("WKT copiado al portapapeles");
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

    const handleFocusFeature = (feature: any) => {
        setFlyToRequest(feature);
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
                isSaving={isSaving}
                // New Props
                onImportCsv={handleImportCsv}
                onExportLayer={handleExportLayer}
                onAddFeature={handleAddFeature}
                onCopyWkt={handleCopyWkt}
                onExportProject={handleExportProject}
                onFocusFeature={handleFocusFeature}
            />
            <div className="flex-1 relative">
                <Map
                    layers={layers}
                    activeLayerId={activeLayerId}
                    onUpdateLayer={handleUpdateLayer}
                    requestDraw={drawRequest}
                    requestFlyTo={flyToRequest}
                    onShowToast={(msg) => setToastMessage(msg)}
                />


            </div>

            {toastMessage && (
                <Toast
                    message={toastMessage}
                    onClose={() => setToastMessage(null)}
                    duration={3000}
                />
            )}
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
