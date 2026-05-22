"use client";
import { useState, Dispatch, SetStateAction, useRef } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { Project, Layer, createProject } from "@/lib/firebase";
import { useAuth } from "@/components/AuthWrapper";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { checkLimit, hasFeature } from "@/lib/plans";
import UpgradeModal from "@/components/UpgradeModal";
import PlanBadge from "@/components/PlanBadge";
import {
    EyeIcon,
    EyeSlashIcon,
    TrashIcon,
    PlusIcon,
    ShareIcon,
    ArrowUpTrayIcon,
    DocumentDuplicateIcon,
    FolderOpenIcon,
    ClipboardDocumentCheckIcon,
    PencilSquareIcon,
    Cog6ToothIcon,
    SparklesIcon,
    CircleStackIcon,
    PaintBrushIcon,
} from "@heroicons/react/24/outline";
import ShareModal from "@/components/ShareModal";
import { generateColor, parseWKT } from "@/lib/map-utils";
import { generatePostgisSQL } from "@/lib/export-utils";
import LayerStyleEditor from "@/components/map/LayerStyleEditor";
import type { LayerStyle } from "@/lib/firebase";
import type { ToastType } from "@/components/Toast";

const PLAN_COLORS: Record<string, string> = { free: '#6b7280', pro: '#6366f1' };
const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro' };

interface SidebarProps {
    projects: Project[];
    currentProject: Project | null;
    layers: Layer[];
    setLayers: Dispatch<SetStateAction<Layer[]>>;
    activeLayerId: string | null;
    setActiveLayerId: (id: string | null) => void;
    onLoadProject: (project: Project) => void;
    isSaving: boolean;
    // Layer actions
    onImportCsv: (file: File) => void;
    onExportLayer: (layerId: string) => void;
    onAddFeature: () => void;
    onCopyWkt: (feature: any) => void;
    onFocusFeature: (feature: any) => void;

    // Legacy/Project actions
    onExportProject: () => void;
    selectedIndices: Set<number>;
    onToggleSelection: (index: number, multi: boolean) => void;
    onClearSelection: () => void;
    onUpdateProject?: (project: Project) => void;
    isReadOnly?: boolean;

    // Sandbox mode — no auth required, save prompts Google login
    sandboxMode?: boolean;
    onSandboxSave?: () => void;
    isSandboxSaving?: boolean;
    onShowToast?: (message: string, type?: ToastType) => void;
    onImportFile?: (file: File) => void;
}

export default function Sidebar({
    projects,
    currentProject,
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    onLoadProject,
    isSaving,
    onImportCsv,
    onExportLayer,
    onAddFeature,
    onCopyWkt,
    onFocusFeature,
    onExportProject,
    selectedIndices,
    onToggleSelection,
    onClearSelection,
    onUpdateProject,
    isReadOnly = false,
    sandboxMode = false,
    onSandboxSave,
    isSandboxSaving = false,
    onShowToast,
    onImportFile,
}: SidebarProps) {
    const { user, userProfile } = useAuth();
    const [projectListOpen, setProjectListOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [upgradeModal, setUpgradeModal] = useState<React.ComponentProps<typeof UpgradeModal>['reason']>(undefined);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const plan = userProfile?.plan ?? 'free';

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const [showImportMenu, setShowImportMenu] = useState(false);

    // Modal States
    const [modalAction, setModalAction] = useState<'newProject' | 'newLayer' | 'deleteLayer' | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [layerToDelete, setLayerToDelete] = useState<string | null>(null);

    // Paste WKT State
    const [pasteModalOpen, setPasteModalOpen] = useState(false);
    const [wktInput, setWktInput] = useState("");

    // SQL Export State
    const [sqlModalOpen, setSqlModalOpen] = useState(false);
    const [sqlLayerId, setSqlLayerId] = useState<string | null>(null);
    const [sqlTableName, setSqlTableName] = useState('');
    const [sqlOutput, setSqlOutput] = useState('');
    const [sqlCopied, setSqlCopied] = useState(false);

    const openSqlExport = (layerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;
        const defaultTable = layer.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'layer';
        setSqlLayerId(layerId);
        setSqlTableName(defaultTable);
        setSqlOutput(generatePostgisSQL(layer, defaultTable));
        setSqlModalOpen(true);
    };

    const handleSqlTableNameChange = (name: string) => {
        setSqlTableName(name);
        const layer = layers.find(l => l.id === sqlLayerId);
        if (!layer) return;
        const safe = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1').toLowerCase() || 'layer';
        setSqlOutput(generatePostgisSQL(layer, safe));
    };

    const downloadSql = () => {
        const blob = new Blob([sqlOutput], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sqlTableName || 'layer'}.sql`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Style editor state
    const [styleLayerId, setStyleLayerId] = useState<string | null>(null);

    const handleStyleUpdate = (layerId: string, style: LayerStyle) => {
        setLayers(prev => prev.map(l => l.id === layerId ? { ...l, style } : l));
    };

    // Rename State
    const [renamingFeatureIndex, setRenamingFeatureIndex] = useState<number | null>(null);
    const [renamingName, setRenamingName] = useState("");

    const updateFeatureColor = (index: number, color: string) => {
        const activeLayer = layers.find(l => l.id === activeLayerId);
        if (!activeLayer) return;

        const newFeatures = [...(activeLayer.features?.features || [])];
        if (newFeatures[index]) {
            newFeatures[index] = {
                ...newFeatures[index],
                properties: {
                    ...newFeatures[index].properties,
                    color: color
                }
            };

            // Update Layer
            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, features: { ...l.features, features: newFeatures } } : l));
        }
    };

    const deleteFeature = (index: number) => {
        const activeLayer = layers.find(l => l.id === activeLayerId);
        if (!activeLayer) return;

        onClearSelection(); // Clear selection to avoid index mismatch
        const newFeatures = [...(activeLayer.features?.features || [])];
        newFeatures.splice(index, 1);

        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, features: { ...l.features, features: newFeatures } } : l));
    };

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error(err);
            onShowToast?.('Error al iniciar sesión. Intenta de nuevo.', 'error');
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        window.location.href = "/"; // Go to dashboard
    };

    const openNewProjectModal = () => {
        if (!user) return;
        setInputValue("Nuevo Proyecto");
        setModalAction('newProject');
    };

    const openNewLayerModal = () => {
        const check = checkLimit(plan, 'maxLayersPerProject', layers.length);
        if (!check.allowed) {
            setUpgradeModal({ type: 'limit', limitKey: 'maxLayersPerProject', current: layers.length, limit: check.limit!, requiredPlan: check.upgradeRequired! });
            return;
        }
        setInputValue("Nueva Capa");
        setModalAction('newLayer');
    };

    const handleModalSubmit = async () => {
        if (!inputValue.trim()) return;

        if (modalAction === 'newProject' && user) {
            try {
                const { id } = await createProject(inputValue, user.uid, user.displayName || 'Usuario', user.email || '');
                window.location.href = `/${id}`;
            } catch (e) {
                console.error(e);
                onShowToast?.('Error al crear proyecto. Intenta de nuevo.', 'error');
            }
        } else if (modalAction === 'newLayer') {
            const newLayer: Layer = {
                id: 'layer_' + Date.now(),
                name: inputValue,
                visible: true,
                features: { type: "FeatureCollection", features: [] }
            };
            setLayers([...layers, newLayer]);
            setActiveLayerId(newLayer.id);
        }

        setModalAction(null);
        setInputValue("");
    };

    const startRenaming = (index: number, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingFeatureIndex(index);
        setRenamingName(currentName || `Objeto ${index + 1}`);
    };

    const saveRename = (index: number) => {
        if (!activeLayerId) return;
        const activeLayer = layers.find(l => l.id === activeLayerId);
        if (!activeLayer) return;

        const newFeatures = [...(activeLayer.features?.features || [])];
        if (newFeatures[index]) {
            newFeatures[index] = {
                ...newFeatures[index],
                properties: {
                    ...newFeatures[index].properties,
                    name: renamingName
                }
            };
            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, features: { ...l.features, features: newFeatures } } : l));
        }
        setRenamingFeatureIndex(null);
        setRenamingName("");
    };

    const handlePasteWkt = () => {
        if (!wktInput.trim()) return;
        if (!activeLayerId) {
            onShowToast?.('Selecciona una capa primero', 'warning');
            return;
        }
        const activeLayer = layers.find(l => l.id === activeLayerId);
        const featureCount = activeLayer?.features?.features?.length ?? 0;
        const check = checkLimit(plan, 'maxFeaturesPerLayer', featureCount);
        if (!check.allowed) {
            setUpgradeModal({ type: 'limit', limitKey: 'maxFeaturesPerLayer', current: featureCount, limit: check.limit!, requiredPlan: check.upgradeRequired! });
            setPasteModalOpen(false);
            return;
        }

        const geojson = parseWKT(wktInput);
        if (!geojson) {
            onShowToast?.('WKT inválido o no soportado', 'error');
            return;
        }

        const newFeature = {
            type: "Feature",
            properties: {
                name: `Objeto WKT ${Date.now().toString().slice(-4)}`,
                color: generateColor(),
            },
            geometry: geojson
        };
        if (activeLayer) {
            const newFeatures = {
                ...activeLayer.features,
                features: [...(activeLayer.features.features || []), newFeature]
            };
            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, features: newFeatures } : l));
        }

        setWktInput("");
        setPasteModalOpen(false);
    };

    const toggleLayerVisibility = (id: string) => {
        const newLayers = layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
        setLayers(newLayers);
    };

    const deleteLayer = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setLayerToDelete(id);
        setModalAction('deleteLayer');
    };

    const confirmDeleteLayer = () => {
        if (!layerToDelete) return;
        setLayers(prev => prev.filter(l => l.id !== layerToDelete));
        if (activeLayerId === layerToDelete) {
            const nextLayer = layers.find(l => l.id !== layerToDelete);
            if (nextLayer) {
                setActiveLayerId(nextLayer.id);
            } else {
                setActiveLayerId(null);
            }
        }
        setModalAction(null);
        setLayerToDelete(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImportCsv(e.target.files[0]);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImportFile?.(e.target.files[0]);
        }
        if (importFileRef.current) importFileRef.current.value = "";
        setShowImportMenu(false);
    };

    if (!user && !sandboxMode) {
        return (
            <div id="login-overlay">
                <div className="login-card">
                    <h2>Bienvenido</h2>
                    <button onClick={handleLogin} className="btn-google">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" width="18" height="18" />
                        Continuar con Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="sidebar">
                {/* Header: Proyectos */}
                <div className="project-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                    {sandboxMode ? (
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <span className="font-bold text-slate-800 text-base">WKT Studio</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ml-auto">
                                Demo
                            </span>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <a href="/" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                    &larr; Volver al Dashboard
                                </a>
                                {!isReadOnly && (
                                    <button
                                        onClick={() => setShareModalOpen(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors shadow-sm"
                                        title="Compartir Proyecto"
                                    >
                                        <ShareIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 text-lg truncate" title={currentProject?.name}>
                                        {currentProject ? currentProject.name : 'Cargando...'}
                                    </div>
                                    {isReadOnly && (
                                        <div className="mt-1">
                                            <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider font-medium">
                                                Lector
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs font-medium ml-2 self-start mt-1">
                                    {isSaving ? (
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </span>
                                    ) : (
                                        <span className="text-slate-300">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Capas Section */}
                <div className="layers-header">
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Capas</h2>
                    <div className="layers-actions">
                        {/* Legacy CSV input kept for backward compat */}
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv,.txt" onChange={handleFileChange} />
                        {/* Multi-format import input */}
                        <input type="file" ref={importFileRef} style={{ display: 'none' }} accept=".csv,.txt,.geojson,.json,.shp" onChange={handleImportFileChange} />

                        <button onClick={openNewLayerModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Nueva Capa" aria-label="Nueva Capa">
                            <PlusIcon style={{ width: 18, height: 18, color: '#64748b' }} />
                        </button>

                        {/* Import dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowImportMenu(v => !v)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Importar Capa"
                                aria-label="Importar Capa"
                            >
                                <FolderOpenIcon style={{ width: 18, height: 18, color: '#64748b' }} />
                            </button>
                            {showImportMenu && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setShowImportMenu(false)} />
                                    <div className="absolute right-0 top-7 z-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-48">
                                        <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Formato</p>
                                        {[
                                            { label: 'CSV con WKT', ext: '.csv,.txt', desc: 'WKT', onClick: () => fileInputRef.current?.click() },
                                            { label: 'GeoJSON', ext: '.geojson,.json', desc: 'GeoJSON', onClick: () => importFileRef.current?.click() },
                                            { label: 'Shapefile', ext: '.shp', desc: '.shp', onClick: () => importFileRef.current?.click() },
                                            { label: 'CSV lat/lng', ext: '.csv,.txt', desc: 'lat, lng cols', onClick: () => importFileRef.current?.click() },
                                        ].map(({ label, desc, onClick }) => (
                                            <button
                                                key={label}
                                                onClick={() => { onClick(); setShowImportMenu(false); }}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                <span>{label}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ flex: '0 0 150px', minHeight: '100px', borderBottom: '1px solid #e2e8f0', overflowY: 'auto' }}>
                    <div id="layers-list">
                        {layers.map(layer => (
                            <div
                                key={layer.id}
                                className={`layer-item ${activeLayerId === layer.id ? 'active' : ''}`}
                                onClick={() => setActiveLayerId(layer.id)}
                            >
                                <span style={{ width: 12, height: 12, borderRadius: '50%', marginRight: 8, background: activeLayerId === layer.id ? 'var(--primary-color)' : '#cbd5e1' }}></span>
                                <span className="layer-name">{layer.name}</span>
                                <div className="ml-auto flex items-center gap-1">
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setStyleLayerId(l => l === layer.id ? null : layer.id); }}
                                        style={{ cursor: 'pointer', color: styleLayerId === layer.id ? '#6366f1' : '#94a3b8' }}
                                        title="Estilo de capa"
                                    >
                                        <PaintBrushIcon style={{ width: 14, height: 14 }} />
                                    </span>
                                    <span onClick={(e) => openSqlExport(layer.id, e)} style={{ cursor: 'pointer', color: '#94a3b8' }} title="Exportar SQL (PostGIS)">
                                        <CircleStackIcon style={{ width: 14, height: 14 }} />
                                    </span>
                                    <span onClick={(e) => { e.stopPropagation(); onExportLayer(layer.id); }} style={{ cursor: 'pointer', color: '#94a3b8' }} title="Exportar Capa">
                                        <ArrowUpTrayIcon style={{ width: 14, height: 14 }} />
                                    </span>
                                    <span onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }} className="layer-visibility cursor-pointer text-slate-400 hover:text-blue-500">
                                        {layer.visible ? <EyeIcon style={{ width: 14, height: 14 }} /> : <EyeSlashIcon style={{ width: 14, height: 14 }} />}
                                    </span>
                                    <span onClick={(e) => deleteLayer(layer.id, e)} style={{ cursor: 'pointer', color: '#94a3b8' }} className="hover:text-red-500">
                                        <TrashIcon style={{ width: 14, height: 14 }} />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Layer Style Editor (floating panel) */}
                {styleLayerId && (() => {
                    const styleLayer = layers.find(l => l.id === styleLayerId);
                    if (!styleLayer) return null;
                    return (
                        <LayerStyleEditor
                            layer={styleLayer}
                            onUpdate={(style) => handleStyleUpdate(styleLayerId, style)}
                            onClose={() => setStyleLayerId(null)}
                        />
                    );
                })()}

                {/* Objetos Section */}
                <div className="layers-header" style={{ borderTop: 'none' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Objetos</h2>
                    <div className="layers-actions">
                        <button
                            onClick={() => setPasteModalOpen(true)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition-colors"
                            title="Pegar WKT"
                        >
                            <ClipboardDocumentCheckIcon style={{ width: 13, height: 13 }} />
                            Pegar WKT
                        </button>
                        <button onClick={onAddFeature} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }} title="Dibujar en mapa">
                            <PlusIcon style={{ width: 18, height: 18, color: '#64748b' }} />
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', color: '#94a3b8', fontSize: '0.9rem' }}>
                    {layers.find(l => l.id === activeLayerId)?.features.features.length === 0 && (
                        <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                                <ClipboardDocumentCheckIcon className="w-6 h-6 text-indigo-400" />
                            </div>
                            <p className="text-sm font-semibold text-slate-600 mb-1">Pega tu geometría WKT</p>
                            <p className="text-[11px] text-slate-400 font-mono mb-4 leading-relaxed">
                                POLYGON ((-77.03 -12.04,<br />-77.02 -12.05, ...))
                            </p>
                            <button
                                onClick={() => setPasteModalOpen(true)}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                            >
                                <ClipboardDocumentCheckIcon className="w-4 h-4" />
                                Pegar WKT
                            </button>
                            <p className="text-[11px] text-slate-400 mt-3">o dibuja directamente en el mapa →</p>
                        </div>
                    )}
                    <ul className="list-none p-0 m-0 px-4 pb-4">
                        {layers.find(l => l.id === activeLayerId)?.features.features.map((feature: any, index: number) => {
                            const color = feature.properties?.color || '#3388ff';
                            const isSelected = selectedIndices.has(index);

                            return (
                                <li
                                    key={index}
                                    onClick={(e) => {
                                        onToggleSelection(index, e.metaKey || e.ctrlKey);
                                        onFocusFeature(feature);
                                    }}
                                    className={`flex items-center p-3 mb-2 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100'}`}
                                >
                                    <div
                                        className="relative w-6 h-6 rounded-md mr-3 shadow-inner overflow-hidden shrink-0"
                                        style={{ backgroundColor: color }}
                                    >
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => updateFeatureColor(index, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                    </div>

                                    {renamingFeatureIndex === index ? (
                                        <input
                                            type="text"
                                            value={renamingName}
                                            onChange={(e) => setRenamingName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveRename(index);
                                                if (e.key === 'Escape') setRenamingFeatureIndex(null);
                                            }}
                                            onBlur={() => saveRename(index)}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 px-2 py-1 mx-2 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <span className={`flex-1 font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`} title={feature.properties?.name}>
                                            {feature.properties?.name || `Objeto ${index + 1}`}
                                        </span>
                                    )}

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => startRenaming(index, feature.properties?.name, e)}
                                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Renombrar"
                                        >
                                            <PencilSquareIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onCopyWkt(feature); }}
                                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Copiar WKT"
                                        >
                                            <DocumentDuplicateIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteFeature(index); }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Footer */}
                {sandboxMode ? (
                    <div className="p-3 border-t border-slate-100">
                        <button
                            onClick={onSandboxSave}
                            disabled={isSandboxSaving}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                        >
                            {isSandboxSaving ? (
                                <>
                                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" width="14" height="14" />
                                    Guardar con Google
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-slate-400 text-center mt-1.5">Gratis · Sin tarjeta de crédito</p>
                    </div>
                ) : (
                    <div className="user-profile">
                        <img
                            src={user?.photoURL || "https://via.placeholder.com/36"}
                            alt={user?.displayName ?? 'Foto de perfil'}
                            className="user-avatar"
                        />
                        <div className="user-info">
                            <div className="flex items-center gap-1.5">
                                <span className="user-name" title={user?.displayName || ""}>
                                    {user?.displayName}
                                </span>
                                {userProfile && (
                                    <button
                                        onClick={() => plan === 'free' ? setShowUpgradeModal(true) : undefined}
                                        title={plan !== 'free' ? 'Plan activo' : 'Upgrade a Pro'}
                                        className={`shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none ${plan === 'free' ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                                        style={{ background: PLAN_COLORS[plan] }}
                                    >
                                        {plan !== 'free' && <SparklesIcon className="w-2.5 h-2.5" />}
                                        {PLAN_LABELS[plan]}
                                    </button>
                                )}
                            </div>
                            <span className="user-email" title={user?.email || ""}>
                                {user?.email}
                            </span>
                        </div>
                        <Link href="/settings" title="Configuración" className="btn-logout" style={{ color: '#64748b', textDecoration: 'none' }}>
                            <Cog6ToothIcon width={16} height={16} />
                        </Link>
                        <button onClick={handleLogout} title="Cerrar Sesión" className="btn-logout">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* General Modal */}
            <Modal
                isOpen={!!modalAction}
                onClose={() => setModalAction(null)}
                title={modalAction === 'newProject' ? 'Nuevo Proyecto' : modalAction === 'newLayer' ? 'Nueva Capa' : 'Eliminar Capa'}
                footer={
                    <>
                        <button onClick={() => setModalAction(null)} className="btn-outline">Cancelar</button>
                        {modalAction === 'deleteLayer' ? (
                            <button onClick={confirmDeleteLayer} className="btn-primary bg-red-600 hover:bg-red-700">Eliminar</button>
                        ) : (
                            <button onClick={handleModalSubmit} className="btn-primary">Crear</button>
                        )}
                    </>
                }
            >
                {modalAction === 'deleteLayer' ? (
                    <p className="text-slate-600">
                        ¿Estás seguro de que deseas eliminar esta capa? Esta acción no se puede deshacer.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">Nombre</label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleModalSubmit(); }}
                        />
                    </div>
                )}
            </Modal>

            {/* Paste WKT Modal */}
            <Modal
                isOpen={pasteModalOpen}
                onClose={() => { setPasteModalOpen(false); setWktInput(""); }}
                title="Pegar geometría WKT"
                footer={
                    <>
                        <button onClick={() => { setPasteModalOpen(false); setWktInput(""); }} className="btn-outline">Cancelar</button>
                        <button onClick={handlePasteWkt} className="btn-primary" disabled={!wktInput.trim()}>Visualizar</button>
                    </>
                }
            >
                <div className="flex flex-col gap-3">
                    <textarea
                        value={wktInput}
                        onChange={(e) => setWktInput(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm min-h-[160px] resize-none"
                        placeholder={"POLYGON ((-77.03 -12.04, -77.02 -12.05, -77.01 -12.04, -77.03 -12.04))\n\nSoporta: POLYGON, MULTIPOLYGON, POINT, LINESTRING, MULTILINESTRING, MULTIPOINT"}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePasteWkt(); }}
                    />
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Ctrl+Enter para confirmar</span>
                        <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">WKT · PostGIS · Shapely</span>
                    </div>
                </div>
            </Modal>
            {/* Share Modal */}
            {currentProject && (
                <ShareModal
                    isOpen={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    project={currentProject}
                    plan={plan}
                    onUpgradeRequired={(reason) => setUpgradeModal(reason)}
                    onUpdate={(updated) => {
                        if (onUpdateProject) onUpdateProject(updated);
                    }}
                    onShowToast={onShowToast}
                />
            )}

            {/* Upgrade Modal */}
            <UpgradeModal
                isOpen={!!upgradeModal || showUpgradeModal}
                onClose={() => { setUpgradeModal(undefined); setShowUpgradeModal(false); }}
                reason={upgradeModal}
                onShowToast={onShowToast}
            />

            {/* SQL Export Modal */}
            <Modal
                isOpen={sqlModalOpen}
                onClose={() => setSqlModalOpen(false)}
                title="Exportar SQL — PostGIS"
                footer={
                    <>
                        <button onClick={() => setSqlModalOpen(false)} className="btn-outline">Cerrar</button>
                        <button onClick={downloadSql} className="btn-primary flex items-center gap-1.5">
                            <ArrowUpTrayIcon className="w-4 h-4" />
                            Descargar .sql
                        </button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Nombre de tabla</label>
                        <input
                            type="text"
                            value={sqlTableName}
                            onChange={e => handleSqlTableNameChange(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                            placeholder="my_table"
                        />
                    </div>
                    <div className="relative">
                        <label className="text-sm font-medium text-slate-700 block mb-1">SQL generado</label>
                        <pre className="bg-slate-900 text-green-400 text-xs p-4 rounded-xl overflow-auto max-h-72 font-mono whitespace-pre-wrap break-all">{sqlOutput}</pre>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(sqlOutput);
                                setSqlCopied(true);
                                setTimeout(() => setSqlCopied(false), 2000);
                            }}
                            className="absolute top-8 right-2 text-xs bg-white text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                        >
                            {sqlCopied ? '✓ Copiado' : 'Copiar'}
                        </button>
                    </div>
                    <p className="text-xs text-slate-400">Compatible con PostgreSQL + PostGIS. Usa <code className="bg-slate-100 px-1 rounded">ST_GeomFromText()</code> con SRID 4326.</p>
                </div>
            </Modal>
        </>
    );
}
