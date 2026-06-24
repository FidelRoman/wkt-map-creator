"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import { Project, Layer, getUserProjects, getProjectWithFeatures, subscribeToProjectFeatures, bulkWriteChangeset, saveLayersMeta, forkProject } from '@/lib/firebase';
import VersionHistoryPanel from '@/components/VersionHistoryPanel';
import { analytics } from '@/lib/analytics';
import { parseWKT, generateColor, newFeatureId, ensureFeatureIds, diffFeatures, computeBbox } from '@/lib/map-utils';
import { useUndoableState } from '@/lib/useUndoableState';
import { parseCSVLine } from '@/lib/csv-utils';
import Modal from '@/components/Modal';
import Toast, { type ToastType } from '@/components/Toast';
import UpgradeModal from '@/components/UpgradeModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import CsvImportModal, { type CsvImportConfig } from '@/components/CsvImportModal';
import { stringify } from 'wellknown';
import { checkLimit, hasFeature } from '@/lib/plans';
import PasswordGate from '@/components/PasswordGate';


// Dynamically import Map to avoid SSR window issues
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium text-sm">Loading interactive map…</p>
        </div>
    )
});

function ProjectApp() {
    const { user, loading, userProfile } = useAuth();
    const plan = userProfile?.plan ?? 'free';
    const [upgradeModalReason, setUpgradeModalReason] = useState<React.ComponentProps<typeof UpgradeModal>['reason']>(undefined);
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const projectId = params.projectId as string;

    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [
        layers,
        setLayers,
        undo,
        redo,
        canUndo,
        canRedo,
        trackHistoryRef,
        resetLayers
    ] = useUndoableState<Layer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

    /** Wrap setLayers for undoable operations (drawing, imports, spatial ops) */
    const setLayersUndoable = useCallback((action: Layer[] | ((prev: Layer[]) => Layer[])) => {
        setLayers(action, true);
    }, [setLayers]);

    // Flat array of features last successfully persisted to Firestore.
    // Plain array avoids the Turbopack HMR prototype-chain breakage that
    // happens with Map instances (Map.prototype.values becomes undefined
    // after a hot reload, crashing the autosave and losing drawn features).
    const lastPersistedRef = useRef<any[]>([]);
    // Signature of the layer metadata last persisted (id/name/visible/style/order).
    // Lets the autosave detect layer changes (new/renamed/deleted/visibility)
    // independently of feature changes — in v2 these are saved separately.
    const lastLayersMetaRef = useRef<string>('');

    // Stable refs so the keyboard handler never needs to be re-registered
    const undoRef = useRef(undo);
    const redoRef = useRef(redo);
    useEffect(() => { undoRef.current = undo; }, [undo]);
    useEffect(() => { redoRef.current = redo; }, [redo]);

    // Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) — registered once
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!trackHistoryRef.current) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redoRef.current(); else undoRef.current();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redoRef.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []); // empty deps — handler uses refs, never stale

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
    const [isImporting, setIsImporting] = useState(false);

    // CSV import modal state
    const [csvImportPending, setCsvImportPending] = useState<{
        file: File;
        headers: string[];
        previewRows: string[][];
        importType: 'wkt' | 'latlng';
    } | null>(null);

    // Show welcome toast when arriving from sandbox save flow
    useEffect(() => {
        if (searchParams.get('welcome') === '1') {
            showToast('Your map is saved! Welcome to WKT Studio.', 'success');
            router.replace(`/p/${projectId}`, { scroll: false });
        }
    }, []);

    // Initial Load Projects for Sidebar context
    useEffect(() => {
        if (user) {
            loadUserProjects(user.uid);
        }
    }, [user]);

    // Load specific project from URL (project doc + features subcollection)
    useEffect(() => {
        if (!projectId) return;
        getProjectWithFeatures(projectId).then(p => {
            if (p) {
                loadProject(p);
            } else {
                window.location.href = '/404';
            }
        }).catch(e => {
            console.error("Error loading project:", e);
            window.location.href = '/404';
        });
    }, [projectId]);

    // Realtime listener — only injects features added remotely (API / other
    // users) that don't yet exist in local state.  It intentionally never
    // modifies or removes local features because the editor is the source of
    // truth for anything the user is actively working on.  The autosave diff
    // handles conflicts on the write side.
    const dirtyIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!projectId || !currentProject) return;

        const unsub = subscribeToProjectFeatures(projectId, (docs, _fromCache, hasPendingWrites) => {
            if (hasPendingWrites) return; // our own write echoing — skip

            setLayers(prev => {
                // Build a set of all ids already in local state
                const localIds = new Set(prev.flatMap(l => (l.features?.features ?? []).map((f: any) => f.id)));

                // Group docs that are ONLY in remote (not yet in local) by layer
                const newByLayer: Record<string, any[]> = {};
                for (const { id, data } of docs) {
                    if (localIds.has(id)) continue; // already present locally — don't touch
                    if (!newByLayer[data.layerId]) newByLayer[data.layerId] = [];
                    newByLayer[data.layerId].push({
                        type: 'Feature', id,
                        geometry: data.geometry,
                        properties: data.properties,
                    });
                }

                // Nothing new to inject
                if (Object.keys(newByLayer).length === 0) return prev;

                return prev.map(l => {
                    const incoming = newByLayer[l.id];
                    if (!incoming?.length) return l;
                    return {
                        ...l,
                        features: {
                            ...l.features,
                            features: [...(l.features?.features ?? []), ...incoming],
                        },
                    };
                });
            });
        });
        return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, currentProject?.id]);

    // Access Control
    const [accessDenied, setAccessDenied] = useState(false);
    const [passwordUnlocked, setPasswordUnlocked] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);


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


    // Saving state: 'idle' | 'saving' | 'saved' | 'error'
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const saveRetryRef = useRef(0);

    // Auto-save effect (debounced 2s).  Writes only what changed:
    // layer metadata via saveLayersMeta, and feature creates/updates/deletes
    // via bulkWriteChangeset.  `lastPersistedRef` tracks what's in Firestore so
    // the diff is accurate and we skip saves when nothing changed.
    useEffect(() => {
        if (!projectId || layers.length === 0) return;
        if (isReadOnly) return;

        const timeout = setTimeout(async () => {
            if (!currentProject) return;

            const allNext: any[] = layers.flatMap(l =>
                (l.features?.features ?? []).map((f: any) => ({ ...f, __layerId: l.id }))
            );
            const cs = diffFeatures(Array.isArray(lastPersistedRef.current) ? lastPersistedRef.current : [], allNext);
            const featuresDirty = cs.creates.length > 0 || cs.updates.length > 0 || cs.deletes.length > 0;

            // Layer metadata (id/name/visible/style/order) — saved separately.
            const layersMeta = layers.map((l, i) => ({
                id: l.id, name: l.name, visible: l.visible ?? true, style: l.style ?? null, order: i,
            }));
            const layersMetaSig = JSON.stringify(layersMeta);
            const layersDirty = layersMetaSig !== lastLayersMetaRef.current;

            if (!featuresDirty && !layersDirty) return;

            // Compute metadata client-side to avoid O(N) database reads on the server
            const calculatedBbox = computeBbox(allNext);
            const calculatedFeatureCount = allNext.length;
            const calculatedLayerFeatureCounts: Record<string, number> = {};
            layers.forEach(l => {
                calculatedLayerFeatureCounts[l.id] = l.features?.features?.length ?? 0;
            });
            const metadata = {
                bbox: calculatedBbox,
                featureCount: calculatedFeatureCount,
                layerFeatureCounts: calculatedLayerFeatureCounts,
            };

            if (process.env.NODE_ENV === 'development') {
                console.debug('[autosave]', {
                    creates: cs.creates.length, updates: cs.updates.length, deletes: cs.deletes.length,
                    layersDirty,
                });
            }

            setSaveStatus('saving');
            // Mark created/updated ids as dirty so the realtime listener skips them
            [...cs.creates.map((f: any) => f.id), ...cs.updates.map(u => u.id)]
                .forEach(id => dirtyIdsRef.current.add(id));

            try {
                // Save layer metadata FIRST so feature docs reference layers that exist.
                if (layersDirty) await saveLayersMeta(projectId, layersMeta as any);
                if (featuresDirty) {
                    const layerOrderMap: Record<string, number> = {};
                    layers.forEach(l => {
                        layerOrderMap[l.id] = (l.features?.features?.length ?? 0) * 1024;
                    });
                    await bulkWriteChangeset(projectId, cs, layerOrderMap, metadata);
                }
                lastPersistedRef.current = allNext.filter((f: any) => f.id);
                lastLayersMetaRef.current = layersMetaSig;
                // Clear dirty ids after successful save
                [...cs.creates.map((f: any) => f.id), ...cs.updates.map(u => u.id)]
                    .forEach(id => dirtyIdsRef.current.delete(id));
                saveRetryRef.current = 0;
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (err) {
                console.error('[autosave] save failed:', err);
                setSaveStatus('error');
            }
        }, 2000);
        return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layers, projectId, isReadOnly]);


    const loadUserProjects = async (uid: string) => {
        const pros = await getUserProjects(uid);
        setProjects(pros);
    };

    const loadProject = (project: Project) => {
        trackHistoryRef.current = false; // pause tracking during load
        setCurrentProject(project);
        let loadedLayers = project.layers || [];
        if (loadedLayers.length === 0) {
            loadedLayers = [{ id: 'l1', name: 'Base', visible: true, features: { type: 'FeatureCollection', features: [] } }];
        }
        resetLayers(loadedLayers);
        setActiveLayerId(loadedLayers[0].id);
        setIsSaving(false);
        // Seed lastPersistedRef so the first autosave diff is accurate.
        // Map features to include __layerId so that layer moves can be diffed correctly.
        const allFeatures = loadedLayers.flatMap((l: any) =>
            (l.features?.features ?? []).map((f: any) => ({ ...f, __layerId: l.id }))
        );
        lastPersistedRef.current = allFeatures.filter((f: any) => f.id);
        // Seed layer-meta signature so we don't re-save unchanged layers on load.
        lastLayersMetaRef.current = JSON.stringify(loadedLayers.map((l: any, i: number) => ({
            id: l.id, name: l.name, visible: l.visible ?? true, style: l.style ?? null, order: i,
        })));
        // Enable history after initial load settles
        setTimeout(() => { trackHistoryRef.current = true; }, 300);
    };

    const handleUpdateLayer = (layerId: string, features: any) => {
        setLayersUndoable(prev => prev.map(l => l.id === layerId ? { ...l, features } : l));
    };

    // --- Handlers for Sidebar ---

    const handleImportCsv = async (file: File) => {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        const headers = lines.length > 0
            ? parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim()).filter(h => h)
            : [];
        if (headers.length === 0) {
            showToast('Could not parse CSV headers. Make sure the file has a header row.', 'warning');
            return;
        }
        const previewRows = lines.slice(1).filter(l => l.trim()).slice(0, 4)
            .map(l => parseCSVLine(l).map(v => v.replace(/^"|"$/g, '').trim()));
        setCsvImportPending({ file, headers, previewRows, importType: 'wkt' });
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
                showToast('Unrecognized GeoJSON format.', 'error');
                return;
            }

            const normalized = features
                .filter(f => f?.geometry)
                .map((f, i) => ({
                    ...f,
                    id: f.id || newFeatureId(),
                    properties: {
                        ...f.properties,
                        name: f.properties?.name ?? f.properties?.NAME ?? f.properties?.nombre ?? `Feature ${i + 1}`,
                        color: f.properties?.color ?? generateColor(),
                    },
                }));

            if (normalized.length === 0) { showToast('No geometries found in the GeoJSON file.', 'warning'); return; }

            const newLayerId = 'layer_' + Date.now();
            const layerName = file.name.replace(/\.(geojson|json)$/i, '') || 'GeoJSON Layer';
            setLayersUndoable(prev => [...prev, { id: newLayerId, name: layerName, visible: true, features: { type: 'FeatureCollection', features: normalized } }]);
            setActiveLayerId(newLayerId);
            analytics.featureAdded('import');
            showToast(`Imported ${normalized.length} features from "${layerName}".`, 'success');
        } catch {
            showToast('Error reading GeoJSON file. Make sure it is valid JSON.', 'error');
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

            if (features.length === 0) { showToast('No geometries found in the Shapefile.', 'warning'); return; }

            const normalized = features.map((f, i) => ({
                ...f,
                id: f.id || newFeatureId(),
                properties: {
                    ...f.properties,
                    name: f.properties?.name ?? f.properties?.NAME ?? f.properties?.nombre ?? `Feature ${i + 1}`,
                    color: generateColor(),
                },
            }));

            const newLayerId = 'layer_' + Date.now();
            const layerName = file.name.replace(/\.shp$/i, '') || 'Shapefile';
            setLayersUndoable(prev => [...prev, { id: newLayerId, name: layerName, visible: true, features: { type: 'FeatureCollection', features: normalized } }]);
            setActiveLayerId(newLayerId);
            analytics.featureAdded('import');
            showToast(`Imported ${normalized.length} features from "${layerName}".`, 'success');
        } catch (err) {
            console.error(err);
            showToast('Error reading Shapefile. Make sure you selected a valid .shp file.', 'error');
        }
    };

    const handleImportLatLng = async (file: File) => {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            showToast('File must have at least a header row and one data row.', 'warning');
            return;
        }
        const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim()).filter(h => h);
        const previewRows = lines.slice(1, 5).map(l => parseCSVLine(l).map(v => v.replace(/^"|"$/g, '').trim()));
        setCsvImportPending({ file, headers, previewRows, importType: 'latlng' });
    };

    const handleConfirmCsvImport = async (config: CsvImportConfig) => {
        if (!csvImportPending) return;
        const { file, headers } = csvImportPending;
        analytics.importStarted(config.importType);
        setCsvImportPending(null);
        setIsImporting(true);
        try {
            if (config.importType === 'wkt') {
                const geoIdx = config.geoCol ? headers.indexOf(config.geoCol) : -1;
                const nameIdx = config.nameCol ? headers.indexOf(config.nameCol) : -1;
                const text = await file.text();
                const lines = text.split(/\r?\n/);
                let addedCount = 0;
                const newFeatures: any[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) continue;
                    const cols = parseCSVLine(line);
                    // Try the selected geo column first, fall back to regex scan of the full line
                    const rawWkt = geoIdx !== -1 ? (cols[geoIdx] ?? '').trim().replace(/^"|"$/g, '') : '';
                    const wktMatch = rawWkt
                        ? rawWkt.match(/(MULTIPOLYGON|POLYGON|POINT|LINESTRING|MULTILINESTRING|MULTIPOINT)\s*\([\s\d\.,\(\)\-\+]+\)/i)?.[0]
                        : line.match(/(MULTIPOLYGON|POLYGON|POINT|LINESTRING|MULTILINESTRING|MULTIPOINT)\s*\([\s\d\.,\(\)\-\+]+\)/i)?.[0];

                    if (wktMatch) {
                        const geojson = parseWKT(wktMatch);
                        if (geojson) {
                            const name = nameIdx !== -1 && cols[nameIdx]
                                ? cols[nameIdx].trim().replace(/^"|"$/g, '')
                                : `Feature ${addedCount + 1}`;
                            newFeatures.push({
                                type: 'Feature',
                                id: newFeatureId(),
                                geometry: geojson,
                                properties: { name, color: generateColor() }
                            });
                            addedCount++;
                        }
                    }
                }

                if (addedCount > 0) {
                    const newLayerId = 'layer_' + Date.now();
                    const newLayer: Layer = {
                        id: newLayerId,
                        name: file.name.replace(/\.(csv|txt)$/i, '') || 'Imported Layer',
                        visible: true,
                        features: { type: 'FeatureCollection', features: newFeatures }
                    };
                    setLayersUndoable(prev => [...prev, newLayer]);
                    setActiveLayerId(newLayerId);
                    analytics.featureAdded('import');
                    showToast(`Imported ${addedCount} features into new layer "${newLayer.name}".`, 'success');
                } else {
                    showToast('No valid WKT geometries found in the selected column.', 'warning');
                }
            } else {
                // lat/lng mode
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 2) { showToast('No data rows found.', 'warning'); return; }

                const latIdx = config.latCol ? headers.indexOf(config.latCol) : -1;
                const lngIdx = config.lngCol ? headers.indexOf(config.lngCol) : -1;
                const nameIdx = config.nameCol ? headers.indexOf(config.nameCol) : -1;

                const features: any[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = parseCSVLine(lines[i]);
                    const lat = latIdx !== -1 ? parseFloat(cols[latIdx]) : NaN;
                    const lng = lngIdx !== -1 ? parseFloat(cols[lngIdx]) : NaN;
                    if (isNaN(lat) || isNaN(lng)) continue;
                    const name = nameIdx !== -1 && cols[nameIdx]
                        ? cols[nameIdx].trim().replace(/^"|"$/g, '')
                        : `Point ${features.length + 1}`;
                    const extra: Record<string, string> = {};
                    headers.forEach((h, idx) => {
                        if (idx !== latIdx && idx !== lngIdx && cols[idx]) {
                            extra[h] = cols[idx].trim().replace(/^"|"$/g, '');
                        }
                    });
                    features.push({
                        type: 'Feature',
                        id: newFeatureId(),
                        geometry: { type: 'Point', coordinates: [lng, lat] },
                        properties: { name, color: generateColor(), ...extra }
                    });
                }

                if (features.length === 0) { showToast('No valid coordinates found.', 'warning'); return; }

                const newLayerId = 'layer_' + Date.now();
                const layerName = file.name.replace(/\.(csv|txt)$/i, '') || 'Points';
                setLayersUndoable(prev => [...prev, {
                    id: newLayerId, name: layerName, visible: true,
                    features: { type: 'FeatureCollection', features }
                }]);
                setActiveLayerId(newLayerId);
                analytics.featureAdded('import');
                showToast(`Imported ${features.length} points from "${layerName}".`, 'success');
            }
        } finally {
            setIsImporting(false);
        }
    };

    const handleImportFileWithLoading = async (file: File) => {
        setIsImporting(true);
        try {
            await handleImportFile(file);
        } finally {
            setIsImporting(false);
        }
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
            showToast('Unsupported format. Use .csv, .geojson, or .shp', 'warning');
        }
    };

    const handleExportLayer = async (layerId: string, format: 'csv' | 'geojson' | 'kml' = 'csv') => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;

        analytics.exportStarted(format);

        if (format === 'kml') {
            if (!hasFeature(plan, 'hasKmlExport')) {
                setUpgradeModalReason({ type: 'feature', featureKey: 'hasKmlExport', requiredPlan: 'pro' });
                return;
            }
            // @ts-ignore
            const tokml = (await import('tokml')).default;
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
            const name = (props.name || `Feature ${index + 1}`).replace(/"/g, '""');
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
                showToast('WKT copied to clipboard', 'success');
            });
        } catch (e) {
            console.error("Error copying WKT", e);
            showToast('Error generating WKT', 'error');
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

    const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

    const [isForkingProject, setIsForkingProject] = useState(false);
    const handleForkProject = async () => {
        if (!user || !currentProject?.id) return;
        setIsForkingProject(true);
        try {
            const newId = await forkProject(currentProject.id, user.uid, user.displayName ?? 'Anonymous', user.email ?? '');
            analytics.projectForked();
            showToast('Project forked to your account. Opening…', 'success');
            setTimeout(() => { window.location.href = `/p/${newId}`; }, 1200);
        } catch (e) {
            showToast('Error forking project', 'error');
            setIsForkingProject(false);
        }
    };

    const canFork = !loading && user && currentProject && currentProject.ownerId !== user.uid && currentProject.isPublic;

    if (accessDenied) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-50 flex-col gap-4">
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-center max-w-md">
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h1>
                    <p className="text-slate-600 mb-4 text-sm">This project is private and you don't have permission to view it.</p>
                    <a href="/" className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                        Back to Dashboard
                    </a>
                </div>
            </div>
        );
    }

    // Password gate: show for public password-protected projects when not the owner
    const isOwnerForPw = user && currentProject && user.uid === currentProject.ownerId;
    const needsPassword =
        !isOwnerForPw &&
        currentProject &&
        (currentProject as any).isPasswordProtected &&
        !passwordUnlocked &&
        typeof sessionStorage !== 'undefined' &&
        !sessionStorage.getItem(`pw-unlocked-${projectId}`);

    if (!loading && currentProject && needsPassword) {
        return <PasswordGate projectId={projectId} onUnlocked={() => setPasswordUnlocked(true)} />;
    }

    // Wait for BOTH auth and the project to load before rendering the editor.
    // Otherwise isReadOnly defaults to true (no project yet) and the
    // "View / Local changes only" badge flashes for a moment during load.
    if (loading || !currentProject) return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <ErrorBoundary>
        <div className="flex h-screen w-screen overflow-hidden">
            {/* View-mode banner for collaborators with viewer role */}
            {isReadOnly && !accessDenied && currentProject && (
                <div className="fixed top-0 left-0 right-0 z-500 bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-amber-800">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    <span><strong>View mode</strong> — your changes are local and won't be saved.</span>
                    {currentProject.isPublic && (
                        <button
                            onClick={handleForkProject}
                            disabled={isForkingProject}
                            className="ml-2 underline font-semibold hover:text-amber-900"
                        >
                            Fork to edit →
                        </button>
                    )}
                </div>
            )}
            <Sidebar
                projects={projects}
                currentProject={currentProject}
                layers={layers}
                setLayers={setLayersUndoable}
                activeLayerId={activeLayerId}
                setActiveLayerId={handleSetActiveLayerId}
                onLoadProject={loadProject}
                isSaving={saveStatus === 'saving'}
                isReadOnly={isReadOnly}
                isImporting={isImporting}
                // New Props
                onImportCsv={handleImportCsv}
                onImportFile={handleImportFileWithLoading}
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
                // Version history
                onOpenVersionHistory={!isReadOnly ? () => setVersionHistoryOpen(true) : undefined}
                // Undo / Redo
                onUndo={!isReadOnly ? undo : undefined}
                onRedo={!isReadOnly ? redo : undefined}
                canUndo={canUndo}
                canRedo={canRedo}
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />
            <div className={`flex-1 relative ${isReadOnly && currentProject ? 'pt-8' : ''}`}>
                {/* Mobile hamburger button */}
                <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="md:hidden absolute bottom-6 left-4 z-30 bg-white dark:bg-slate-800 shadow-lg rounded-full p-3 border border-slate-200 dark:border-slate-700"
                    aria-label="Open sidebar"
                >
                    <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                {canFork && !isReadOnly && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-400">
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
                            {isForkingProject ? 'Forking…' : 'Fork to my account'}
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

            {csvImportPending && (
                <CsvImportModal
                    isOpen={true}
                    onClose={() => setCsvImportPending(null)}
                    onConfirm={handleConfirmCsvImport}
                    fileName={csvImportPending.file.name}
                    headers={csvImportPending.headers}
                    previewRows={csvImportPending.previewRows}
                    importType={csvImportPending.importType}
                />
            )}

            {currentProject && user && (
                <VersionHistoryPanel
                    isOpen={versionHistoryOpen}
                    onClose={() => setVersionHistoryOpen(false)}
                    projectId={projectId}
                    ownerId={user.uid}
                    layers={layers}
                    onRestore={(restoredLayers) => {
                        resetLayers(restoredLayers);
                    }}
                    plan={plan}
                    onUpgradeRequired={() => {
                        setVersionHistoryOpen(false);
                        setUpgradeModalReason({ type: 'feature', featureKey: 'hasVersionHistory', requiredPlan: 'pro' });
                    }}
                />
            )}
        </div>
        </ErrorBoundary>
    );
}

export default function Page() {
    return (
        <AuthWrapper>
            <ProjectApp />
        </AuthWrapper>
    );
}
