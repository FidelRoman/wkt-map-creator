import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Project, updateProjectSharing } from "@/lib/firebase";
import { UserPlusIcon, LinkIcon, XMarkIcon, CodeBracketIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { checkLimit, hasFeature, type PlanId } from "@/lib/plans";
import type { ToastType } from "./Toast";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onUpdate: (updatedProject: Project) => void;
    plan?: PlanId;
    onUpgradeRequired?: (reason: any) => void;
    onShowToast?: (message: string, type?: ToastType) => void;
}

type Tab = 'link' | 'collaborators' | 'embed' | 'api';

export default function ShareModal({ isOpen, onClose, project, onUpdate, plan = 'free', onUpgradeRequired, onShowToast }: ShareModalProps) {
    const [tab, setTab] = useState<Tab>('link');
    const [isPublic, setIsPublic] = useState(project.isPublic);
    const [collaborators, setCollaborators] = useState<string[]>(project.collaborators || []);
    const [roles, setRoles] = useState<Record<string, 'editor' | 'viewer'>>(project.roles || {});
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState<'editor' | 'viewer'>('editor');
    const [emailError, setEmailError] = useState("");
    const [loading, setLoading] = useState(false);
    const [embedCopied, setEmbedCopied] = useState(false);

    useEffect(() => {
        setIsPublic(project.isPublic);
        setCollaborators(project.collaborators || []);
        setRoles(project.roles || {});
    }, [project]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateProjectSharing(project.id!, isPublic, collaborators, roles);
            onUpdate({ ...project, isPublic, collaborators, roles });
            onClose();
        } catch (error) {
            console.error(error);
            onShowToast?.('Error al guardar cambios. Intenta de nuevo.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const addCollaborator = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) return;
        if (!newEmail.includes('@')) { setEmailError("Ingresa un correo válido"); return; }
        setEmailError("");
        if (collaborators.includes(newEmail)) return;

        const maxCollaborators = 5; // pro limit
        const check = checkLimit(plan, 'maxCollaborators', collaborators.length);
        if (!check.allowed) {
            if (onUpgradeRequired) onUpgradeRequired({ type: 'limit', limitKey: 'maxCollaborators', current: collaborators.length, limit: check.limit, requiredPlan: check.upgradeRequired });
            return;
        }

        setCollaborators([...collaborators, newEmail]);
        setRoles({ ...roles, [newEmail]: newRole });
        setNewEmail("");
    };

    const removeCollaborator = (email: string) => {
        setCollaborators(collaborators.filter(c => c !== email));
        const newRoles = { ...roles };
        delete newRoles[email];
        setRoles(newRoles);
    };

    const handleRoleChange = (email: string, role: 'editor' | 'viewer') => {
        setRoles({ ...roles, [email]: role });
    };

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.com';
    const publicLink = `${origin}/${project.id}`;
    const embedCode = `<iframe\n  src="${origin}/embed/${project.id}"\n  width="800"\n  height="500"\n  style="border:none;border-radius:8px"\n  allowfullscreen\n></iframe>`;

    const handleCopyEmbed = () => {
        navigator.clipboard.writeText(embedCode);
        setEmbedCopied(true);
        setTimeout(() => setEmbedCopied(false), 2000);
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: 'link', label: 'Link público' },
        { id: 'collaborators', label: 'Colaboradores' },
        { id: 'embed', label: 'Embed' },
        { id: 'api', label: 'API REST' },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Compartir Proyecto"
            footer={
                <>
                    <button onClick={onClose} className="btn-outline">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="btn-primary">
                        {loading ? 'Guardando...' : 'Listo'}
                    </button>
                </>
            }
        >
            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-5 -mt-1">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {tab === 'link' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isPublic ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <LinkIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800">Acceso Público</p>
                                    <p className="text-sm text-slate-500">Cualquiera con el link puede ver</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        {isPublic && (
                            <div className="mt-3 flex items-center gap-2">
                                <input type="text" readOnly value={publicLink} className="flex-1 bg-white border border-slate-300 text-slate-600 text-xs rounded p-2 overflow-hidden text-ellipsis" />
                                <button onClick={() => { navigator.clipboard.writeText(publicLink); onShowToast?.('Link copiado', 'success'); }} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium">Copiar</button>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'collaborators' && (
                    <div>
                        {plan === 'free' && (
                            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
                                <SparklesIcon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-indigo-800">Colaboradores requieren plan Pro</p>
                                    <p className="text-xs text-indigo-600 mt-0.5">Invita hasta 5 colaboradores con plan Pro, o ilimitados con Business.</p>
                                    <button onClick={() => onUpgradeRequired?.({ type: 'feature', featureKey: 'hasCollaborators', requiredPlan: 'pro' })} className="text-xs text-indigo-600 font-semibold underline mt-1">Ver planes →</button>
                                </div>
                            </div>
                        )}
                        <form onSubmit={addCollaborator} className="flex gap-2 mb-4">
                            <input type="email" placeholder="Agregar personas por correo" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); if (emailError) setEmailError(""); }} disabled={plan === 'free'} />
                            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'editor' | 'viewer')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none disabled:opacity-50" disabled={plan === 'free'}>
                                <option value="editor">Editor</option>
                                <option value="viewer">Lector</option>
                            </select>
                            <button type="submit" disabled={plan === 'free'} className="px-3 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg text-sm hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed">Agregar</button>
                        </form>
                        {emailError && <p className="text-red-500 text-xs -mt-3 mb-2">{emailError}</p>}

                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                            {collaborators.length === 0 && <p className="text-sm text-slate-400 italic text-center py-2">Sin colaboradores</p>}
                            {collaborators.map((email) => (
                                <div key={email} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">{email.charAt(0).toUpperCase()}</div>
                                        <span className="text-sm text-slate-700">{email}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select value={roles[email] || 'editor'} onChange={(e) => handleRoleChange(email, e.target.value as 'editor' | 'viewer')} className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white text-slate-600 focus:outline-none">
                                            <option value="editor">Editor</option>
                                            <option value="viewer">Lector</option>
                                        </select>
                                        <button onClick={() => removeCollaborator(email)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Quitar acceso">
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'embed' && (
                    <div className="space-y-4">
                        {!hasFeature(plan, 'hasEmbedWidget') ? (
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                                <SparklesIcon className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                                <p className="text-sm font-semibold text-indigo-800 mb-1">Embed requiere plan Pro</p>
                                <p className="text-xs text-indigo-600 mb-3">Incorpora tu mapa en cualquier sitio web con un iframe.</p>
                                <button onClick={() => onUpgradeRequired?.({ type: 'feature', featureKey: 'hasEmbedWidget', requiredPlan: 'pro' })} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">Ver planes Pro</button>
                            </div>
                        ) : (
                            <>
                                {!isPublic && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                        El proyecto debe ser <strong>público</strong> para poder embeberse. Activa el link público en la pestaña "Link público".
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-2">Código de embed</label>
                                    <div className="relative">
                                        <pre className="bg-slate-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto">{embedCode}</pre>
                                        <button onClick={handleCopyEmbed} className="absolute top-2 right-2 text-xs bg-white text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">
                                            {embedCopied ? '✓ Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                                    <strong>Preview URL:</strong>{' '}
                                    <a href={`/embed/${project.id}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">/embed/{project.id}</a>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tab === 'api' && (
                    <div className="space-y-4">
                        {(plan === 'free') ? (
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                                <SparklesIcon className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                                <p className="text-sm font-semibold text-indigo-800 mb-1">API REST requiere plan Pro</p>
                                <p className="text-xs text-indigo-600 mb-3">Integra los datos de tus proyectos en tiempo real con nuestra API.</p>
                                <button onClick={() => onUpgradeRequired?.({ type: 'feature', featureKey: 'hasApiAccess', requiredPlan: 'pro' })} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">Ver planes Pro</button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-2">Endpoint de la API (GET)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" readOnly value={`${origin}/api/v1/projects/${project.id}/features`} className="flex-1 bg-white border border-slate-300 text-slate-600 text-xs rounded p-2 overflow-hidden text-ellipsis font-mono" />
                                        <button onClick={() => { navigator.clipboard.writeText(`${origin}/api/v1/projects/${project.id}/features`); onShowToast?.('Endpoint copiado', 'success'); }} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium border border-indigo-200 rounded px-3 py-2">Copiar</button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3">
                                        Para autenticar tus peticiones, debes enviar un header <code className="bg-slate-100 text-slate-700 px-1 rounded">Authorization: Bearer &lt;tu-api-key&gt;</code>.
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Puedes gestionar tus API Keys desde la <a href="/settings" target="_blank" className="text-indigo-600 hover:underline">página de Configuración</a>.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
