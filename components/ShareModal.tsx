import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Project, updateProjectSharing, setProjectPassword, removeProjectPassword } from "@/lib/firebase";
import { analytics } from "@/lib/analytics";
import { UserPlusIcon, LinkIcon, XMarkIcon, CodeBracketIcon, SparklesIcon, LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";
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
    inviterName?: string;
}

type Tab = 'link' | 'collaborators' | 'embed' | 'api';

export default function ShareModal({ isOpen, onClose, project, onUpdate, plan = 'free', onUpgradeRequired, onShowToast, inviterName = 'Someone' }: ShareModalProps) {
    const [tab, setTab] = useState<Tab>('link');
    const [isPublic, setIsPublic] = useState(project.isPublic);
    const [collaborators, setCollaborators] = useState<string[]>(project.collaborators || []);
    const [roles, setRoles] = useState<Record<string, 'editor' | 'viewer'>>(project.roles || {});
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState<'editor' | 'viewer'>('editor');
    const [emailError, setEmailError] = useState("");
    const [loading, setLoading] = useState(false);
    const [embedCopied, setEmbedCopied] = useState(false);
    const [passwordProtected, setPasswordProtected] = useState(!!(project as any).isPasswordProtected);
    const [newPassword, setNewPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        setIsPublic(project.isPublic);
        setCollaborators(project.collaborators || []);
        setRoles(project.roles || {});
        setPasswordProtected(!!(project as any).isPasswordProtected);
    }, [project]);

    const handleTogglePassword = async (enable: boolean) => {
        if (!enable) {
            setSavingPassword(true);
            try {
                await removeProjectPassword(project.id!);
                setPasswordProtected(false);
                setNewPassword('');
                onShowToast?.('Password removed.', 'success');
            } catch { onShowToast?.('Error removing password.', 'error'); }
            finally { setSavingPassword(false); }
        } else {
            setPasswordProtected(true);
        }
    };

    const handleSavePassword = async () => {
        if (!newPassword.trim()) return;
        setSavingPassword(true);
        try {
            await setProjectPassword(project.id!, newPassword);
            setNewPassword('');
            onShowToast?.('Password set successfully.', 'success');
        } catch { onShowToast?.('Error setting password.', 'error'); }
        finally { setSavingPassword(false); }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateProjectSharing(project.id!, isPublic, collaborators, roles);
            onUpdate({ ...project, isPublic, collaborators, roles });

            // Send invite emails to newly added collaborators
            const existingCollaborators = new Set(project.collaborators ?? []);
            const newCollaborators = collaborators.filter(c => !existingCollaborators.has(c));
            if (newCollaborators.length > 0) {
                const projectUrl = `${window.location.origin}/p/${project.id}`;
                for (const email of newCollaborators) {
                    fetch('/api/email/invite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            inviteeEmail: email,
                            inviterName,
                            projectName: project.name,
                            projectUrl,
                            role: roles[email] ?? 'editor',
                        }),
                    }).catch(() => {});
                }
            }

            onClose();
        } catch (error) {
            console.error(error);
            onShowToast?.('Error saving changes. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const addCollaborator = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) return;
        if (!newEmail.includes('@')) { setEmailError("Enter a valid email address"); return; }
        setEmailError("");
        if (collaborators.includes(newEmail)) return;

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
    const publicLink = `${origin}/p/${project.id}`;
    const embedCode = `<iframe\n  src="${origin}/embed/${project.id}"\n  width="800"\n  height="500"\n  style="border:none;border-radius:8px"\n  allowfullscreen\n></iframe>`;

    const handleCopyEmbed = () => {
        navigator.clipboard.writeText(embedCode);
        analytics.embedCodeCopied();
        setEmbedCopied(true);
        setTimeout(() => setEmbedCopied(false), 2000);
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: 'link', label: 'Public link' },
        { id: 'collaborators', label: 'Collaborators' },
        { id: 'embed', label: 'Embed' },
        { id: 'api', label: 'REST API' },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Share Project"
            footer={
                <>
                    <button onClick={onClose} className="btn-outline">Cancel</button>
                    <button onClick={handleSave} disabled={loading} className="btn-primary">
                        {loading ? 'Saving…' : 'Done'}
                    </button>
                </>
            }
        >
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-5 -mt-1">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {tab === 'link' && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isPublic ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                    <LinkIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-slate-100">Public Access</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Anyone with the link can view</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        {isPublic && (
                            <div className="mt-3 flex items-center gap-2">
                                <input type="text" readOnly value={publicLink} className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs rounded p-2 overflow-hidden text-ellipsis" />
                                <button onClick={() => { navigator.clipboard.writeText(publicLink); onShowToast?.('Link copied', 'success'); }} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium">Copy</button>
                            </div>
                        )}
                        {isPublic && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {passwordProtected
                                            ? <LockClosedIcon className="w-4 h-4 text-amber-500" />
                                            : <LockOpenIcon className="w-4 h-4 text-slate-400" />}
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Password protection</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={passwordProtected}
                                            onChange={e => handleTogglePassword(e.target.checked)} disabled={savingPassword} />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>
                                {passwordProtected && (
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            type="password"
                                            placeholder={(project as any).isPasswordProtected ? 'Set new password' : 'Enter password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                                        />
                                        <button onClick={handleSavePassword} disabled={savingPassword || !newPassword.trim()}
                                            className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
                                            {savingPassword ? 'Saving…' : 'Save'}
                                        </button>
                                    </div>
                                )}
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
                                    <p className="text-sm font-medium text-indigo-800">Collaborators require Pro plan</p>
                                    <p className="text-xs text-indigo-600 mt-0.5">Invite up to 5 collaborators with Pro.</p>
                                    <button onClick={() => onUpgradeRequired?.({ type: 'feature', featureKey: 'hasCollaborators', requiredPlan: 'pro' })} className="text-xs text-indigo-600 font-semibold underline mt-1">See plans →</button>
                                </div>
                            </div>
                        )}
                        <form onSubmit={addCollaborator} className="flex gap-2 mb-4">
                            <input
                                type="email"
                                placeholder="Add people by email"
                                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newEmail}
                                onChange={(e) => { setNewEmail(e.target.value); if (emailError) setEmailError(""); }}
                                disabled={plan === 'free'}
                            />
                            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'editor' | 'viewer')} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50" disabled={plan === 'free'}>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                            </select>
                            <button type="submit" disabled={plan === 'free'} className="px-3 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg text-sm hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                        </form>
                        {emailError && <p className="text-red-500 text-xs -mt-3 mb-2">{emailError}</p>}

                        {/* Hint: collaborator may not have an account yet */}
                        {newEmail === '' && collaborators.length === 0 && plan !== 'free' && (
                            <p className="text-xs text-slate-400 mb-3">
                                The collaborator must have a WKT Studio account. If they don't, they'll get access once they sign up.
                            </p>
                        )}

                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                            {collaborators.length === 0 && <p className="text-sm text-slate-400 italic text-center py-2">No collaborators yet</p>}
                            {collaborators.map((email) => (
                                <div key={email} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">{email.charAt(0).toUpperCase()}</div>
                                        <span className="text-sm text-slate-700 dark:text-slate-200">{email}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select value={roles[email] || 'editor'} onChange={(e) => handleRoleChange(email, e.target.value as 'editor' | 'viewer')} className="text-xs border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 focus:outline-none">
                                            <option value="editor">Editor</option>
                                            <option value="viewer">Viewer</option>
                                        </select>
                                        <button onClick={() => removeCollaborator(email)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove access">
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
                                <p className="text-sm font-semibold text-indigo-800 mb-1">Embed requires Pro plan</p>
                                <p className="text-xs text-indigo-600 mb-3">Embed your map in any website as an iframe.</p>
                                <button onClick={() => onUpgradeRequired?.({ type: 'feature', featureKey: 'hasEmbedWidget', requiredPlan: 'pro' })} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">Upgrade to Pro</button>
                            </div>
                        ) : (
                            <>
                                {!isPublic && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
                                        The project must be <strong>public</strong> to be embeddable. Enable the public link in the "Public link" tab.
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-2">Embed code</label>
                                    <div className="relative">
                                        <pre className="bg-slate-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto">{embedCode}</pre>
                                        <button onClick={handleCopyEmbed} className="absolute top-2 right-2 text-xs bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600">
                                            {embedCopied ? '✓ Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
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
                                <p className="text-sm font-semibold text-indigo-800 mb-1">REST API requires Pro plan</p>
                                <p className="text-xs text-indigo-600 mb-3">Integrate your project data in real time with our API.</p>
                                <button onClick={() => onUpgradeRequired?.({ type: 'feature', featureKey: 'hasApiAccess', requiredPlan: 'pro' })} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">Upgrade to Pro</button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">API Endpoint (GET)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" readOnly value={`${origin}/api/v1/projects/${project.id}/features`} className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs rounded p-2 overflow-hidden text-ellipsis font-mono" />
                                        <button onClick={() => { navigator.clipboard.writeText(`${origin}/api/v1/projects/${project.id}/features`); onShowToast?.('Endpoint copied', 'success'); }} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium border border-indigo-200 rounded px-3 py-2">Copy</button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3">
                                        Authenticate requests with <code className="bg-slate-100 text-slate-700 px-1 rounded">Authorization: Bearer &lt;your-api-key&gt;</code>.
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Manage your API keys in <a href="/settings" target="_blank" className="text-indigo-600 hover:underline">Settings</a>.
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
