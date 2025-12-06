"use client";
import { useState, Dispatch, SetStateAction, useRef } from "react";
import Modal from "@/components/Modal";
import { Project, Layer, createProject } from "@/lib/firebase";
import { useAuth } from "@/components/AuthWrapper";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import {
    ArrowLeftOnRectangleIcon,
    EyeIcon,
    EyeSlashIcon,
    TrashIcon,
    PlusIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    DocumentDuplicateIcon,
    FolderOpenIcon
} from "@heroicons/react/24/outline";

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
    onToggleSelection
}: SidebarProps) {
    const { user } = useAuth();
    const [projectListOpen, setProjectListOpen] = useState(false);

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal States
    const [modalAction, setModalAction] = useState<'newProject' | 'newLayer' | 'deleteLayer' | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [layerToDelete, setLayerToDelete] = useState<string | null>(null);

    // Feature Selection State REMOVED (moved to parent)

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

        const newFeatures = [...(activeLayer.features?.features || [])];
        newFeatures.splice(index, 1);

        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, features: { ...l.features, features: newFeatures } } : l));
    };

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error(err);
            alert("Login failed");
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
        setInputValue("Nueva Capa");
        setModalAction('newLayer');
    };

    const handleModalSubmit = async () => {
        if (!inputValue.trim()) return;

        if (modalAction === 'newProject' && user) {
            try {
                const { id } = await createProject(inputValue, user.uid);
                window.location.href = `/${id}`;
            } catch (e) {
                console.error(e);
                alert("Error creando proyecto");
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
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    if (!user) {
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
                <div className="project-header" style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <a href="/" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            &larr; Volver al Dashboard
                        </a>
                    </div>

                    <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-slate-800 text-lg truncate flex-1" title={currentProject?.name}>
                            {currentProject ? currentProject.name : 'Cargando...'}
                        </div>
                        <div className="text-xs font-medium ml-2">
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
                </div>

                {/* Capas Section */}
                <div className="layers-header">
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Capas</h2>
                    <div className="layers-actions">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".csv,.txt"
                            onChange={handleFileChange}
                        />
                        <button onClick={openNewLayerModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Nueva Capa">
                            <PlusIcon style={{ width: 18, height: 18, color: '#64748b' }} />
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Importar Capa (CSV)">
                            <FolderOpenIcon style={{ width: 18, height: 18, color: '#64748b' }} />
                        </button>
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

                {/* Objetos Section */}
                <div className="layers-header" style={{ borderTop: 'none' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Objetos</h2>
                    <div className="layers-actions">
                        <button onClick={onAddFeature} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Agregar Objeto">
                            <PlusIcon style={{ width: 18, height: 18, color: '#64748b' }} />
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', color: '#94a3b8', fontSize: '0.9rem' }}>
                    {layers.find(l => l.id === activeLayerId)?.features.features.length === 0 && (
                        <div className="text-center italic text-slate-400 p-5">
                            Sin objetos en esta capa
                        </div>
                    )}
                    <ul className="list-none p-0 m-0">
                        {layers.find(l => l.id === activeLayerId)?.features.features.map((feature: any, index: number) => {
                            const color = feature.properties?.color || '#3388ff';
                            const isSelected = selectedIndices.has(index);

                            return (
                                <li
                                    key={index}
                                    onClick={(e) => {
                                        onToggleSelection(index, e.metaKey || e.ctrlKey);
                                        if (!selectedIndices.has(index)) onFocusFeature(feature); // Only focus if not already selected? Or always? Original logic focus on click.
                                        // Wait, original: `toggleSelection(index); onFocusFeature(feature);`
                                        // User request: "quiero que se implemente... aplica lo de toggleselection"
                                        // The provided snippet has `toggleSelection(layer, e.ctrlKey || e.metaKey)`
                                        // And `li.addEventListener('click', ...)`
                                        // So we should replicate that.

                                        // We should focus only if we are selecting it?
                                        // "fly to" is nice.
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

                                    <span className={`flex-1 font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`} title={feature.properties?.name}>
                                        {feature.properties?.name || `Objeto ${index + 1}`}
                                    </span>

                                    <div className="flex items-center gap-1">
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

                {/* Footer Profile */}
                <div className="user-profile">
                    <img
                        src={user.photoURL || "https://via.placeholder.com/36"}
                        alt="Profile"
                        className="user-avatar"
                    />
                    <div className="user-info">
                        <span
                            className="user-name"
                            title={user.displayName || ""}
                        >
                            {user.displayName}
                        </span>
                        <span
                            className="user-email"
                            title={user.email || ""}
                        >
                            {user.email}
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Cerrar Sesión"
                        className="btn-logout"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
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
        </>
    );
}
