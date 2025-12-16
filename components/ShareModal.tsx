import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Project, updateProjectSharing } from "@/lib/firebase";
import { UserPlusIcon, LinkIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onUpdate: (updatedProject: Project) => void;
}

export default function ShareModal({ isOpen, onClose, project, onUpdate }: ShareModalProps) {
    const [isPublic, setIsPublic] = useState(project.isPublic);
    const [collaborators, setCollaborators] = useState<string[]>(project.collaborators || []);
    const [roles, setRoles] = useState<Record<string, 'editor' | 'viewer'>>(project.roles || {});
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState<'editor' | 'viewer'>('editor');
    const [loading, setLoading] = useState(false);

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
            alert("Error al guardar cambios");
        } finally {
            setLoading(false);
        }
    };

    const addCollaborator = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) return;
        if (!newEmail.includes('@')) {
            alert("Ingresa un correo válido");
            return;
        }
        if (collaborators.includes(newEmail)) return;

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
    }

    const publicLink = typeof window !== 'undefined' ? `${window.location.origin}/${project.id}` : '';

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
            <div className="space-y-6">
                {/* Public Link Section */}
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
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    {isPublic && (
                        <div className="mt-3 flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={publicLink}
                                className="flex-1 bg-white border border-slate-300 text-slate-600 text-xs rounded p-2 overflow-hidden text-ellipsis"
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(publicLink);
                                    alert("Link copiado!");
                                }}
                                className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                            >
                                Copiar
                            </button>
                        </div>
                    )}
                </div>

                <hr className="border-slate-100" />

                {/* Collaborators Section */}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <UserPlusIcon className="w-4 h-4 text-slate-500" />
                        Colaboradores
                    </h3>

                    <form onSubmit={addCollaborator} className="flex gap-2 mb-4">
                        <input
                            type="email"
                            placeholder="Agregar personas por correo"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'editor' | 'viewer')}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="editor">Editor</option>
                            <option value="viewer">Lector</option>
                        </select>
                        <button type="submit" className="px-3 py-2 bg-blue-50 text-blue-600 font-medium rounded-lg text-sm hover:bg-blue-100">
                            Agregar
                        </button>
                    </form>

                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {collaborators.length === 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-2">Sin colaboradores</p>
                        )}
                        {collaborators.map((email) => (
                            <div key={email} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                        {email.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm text-slate-700">{email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={roles[email] || 'editor'}
                                        onChange={(e) => handleRoleChange(email, e.target.value as 'editor' | 'viewer')}
                                        className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white text-slate-600 focus:outline-none"
                                    >
                                        <option value="editor">Editor</option>
                                        <option value="viewer">Lector</option>
                                    </select>
                                    <button
                                        onClick={() => removeCollaborator(email)}
                                        className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Quitar acceso"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
