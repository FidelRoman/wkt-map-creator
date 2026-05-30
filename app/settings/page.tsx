"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, deleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { updateUserProfile, addApiKeyToIndex, removeApiKeyFromIndex } from '@/lib/firebase';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import UpgradeModal from '@/components/UpgradeModal';
import Modal from '@/components/Modal';
import { PLAN_LIMITS, type PlanId } from '@/lib/plans';
import { getUserProjects } from '@/lib/firebase';
import {
    ArrowLeftIcon, CheckIcon, SparklesIcon,
    ArrowRightStartOnRectangleIcon, TrashIcon, ShieldCheckIcon,
    ChartBarIcon, UserCircleIcon, CreditCardIcon, ExclamationTriangleIcon,
    KeyIcon, PlusIcon, SunIcon, MoonIcon
} from '@heroicons/react/24/outline';
import Toast, { type ToastType } from '@/components/Toast';
import { useDarkMode } from '@/lib/useDarkMode';

const PLAN_COLORS: Record<PlanId, string> = {
    free: '#6b7280',
    pro: '#6366f1',
};

const PLAN_LABELS: Record<PlanId, string> = {
    free: 'Free',
    pro: 'Pro',
};

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{title}</h2>
        </div>
    );
}

function UsageBar({ label, value, max }: { label: string; value: number; max: number | null }) {
    const pct = max === null ? 0 : Math.min(100, (value / max) * 100);
    const isWarning = max !== null && pct >= 80;
    const isOver = max !== null && value >= max;
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-300">{label}</span>
                <span className={`font-semibold ${isOver ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500'}`}>
                    {value}{max !== null ? `/${max}` : ''}
                </span>
            </div>
            {max !== null && (
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all"
                        style={{
                            width: `${pct}%`,
                            background: isOver ? '#ef4444' : isWarning ? '#f59e0b' : '#6366f1',
                        }}
                    />
                </div>
            )}
        </div>
    );
}

function SettingsContent() {
    const router = useRouter();
    const { user, userProfile, refreshProfile, loading } = useAuth();
    const { dark, toggle: toggleDark } = useDarkMode();
    const [displayName, setDisplayName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);

    const [showUpgrade, setShowUpgrade] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [generatingKey, setGeneratingKey] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [maxLayersInProject, setMaxLayersInProject] = useState(0);
    const [maxFeaturesInLayer, setMaxFeaturesInLayer] = useState(0);

    useEffect(() => {
        if (!loading && !user) router.replace('/');
    }, [user, loading, router]);

    useEffect(() => {
        if (userProfile) setDisplayName(userProfile.displayName ?? '');
    }, [userProfile]);

    useEffect(() => {
        if (!user) return;
        getUserProjects(user.uid).then(projects => {
            let maxLayers = 0;
            let maxFeatures = 0;
            for (const project of projects) {
                if (project.layers.length > maxLayers) maxLayers = project.layers.length;
                for (const layer of project.layers) {
                    const count = layer.features?.features?.length ?? 0;
                    if (count > maxFeatures) maxFeatures = count;
                }
            }
            setMaxLayersInProject(maxLayers);
            setMaxFeaturesInLayer(maxFeatures);
        });
    }, [user]);

    const showToast = (message: string, type: ToastType = 'info') =>
        setToast({ message, type });

    const handleSaveName = async () => {
        if (!user || !displayName.trim()) return;
        setSavingName(true);
        try {
            await updateUserProfile(user.uid, { displayName: displayName.trim() });
            await refreshProfile();
            setNameSaved(true);
            setTimeout(() => setNameSaved(false), 2000);
        } catch {
            showToast('Error saving. Please try again.', 'error');
        } finally {
            setSavingName(false);
        }
    };

    const [loadingPortal, setLoadingPortal] = useState(false);

    const handleManageSubscription = async () => {
        if (!user) return;
        setLoadingPortal(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/paddle/portal', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Unknown error');
            window.open(data.url, '_blank');
        } catch (err: any) {
            showToast(err.message ?? 'Could not open subscription portal.', 'error');
        } finally {
            setLoadingPortal(false);
        }
    };

    const handleSignOut = async () => {
        await signOut(auth);
        router.replace('/');
    };

    const handleDeleteAccount = async () => {
        if (!user || deleteConfirmText !== 'DELETE') return;
        setDeletingAccount(true);
        try {
            await deleteUser(user);
            router.replace('/');
        } catch (err: any) {
            if (err?.code === 'auth/requires-recent-login') {
                showToast('For security, sign out and sign in again before deleting your account.', 'warning');
            } else {
                showToast('Error deleting account. Please try again.', 'error');
            }
            setDeletingAccount(false);
            setShowDeleteModal(false);
        }
    };

    const handleGenerateApiKey = async () => {
        if (!user || !userProfile || !newKeyName.trim()) return;
        setGeneratingKey(true);
        try {
            const array = new Uint8Array(24);
            window.crypto.getRandomValues(array);
            const rawKey = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            const newKey = `wk_${rawKey}`;
            
            const apiKeys = [...(userProfile.apiKeys || []), { key: newKey, name: newKeyName.trim(), createdAt: new Date(), lastUsed: null }];
            await Promise.all([
                updateUserProfile(user.uid, { apiKeys }),
                addApiKeyToIndex(newKey, user.uid),  // O(1) index for fast server-side lookup
            ]);
            await refreshProfile();
            setNewKeyName('');
            showToast('API key generated successfully.', 'success');
        } catch (error) {
            showToast('Error generating API key. Please try again.', 'error');
        } finally {
            setGeneratingKey(false);
        }
    };

    const handleDeleteApiKey = async (keyToDelete: string) => {
        if (!user || !userProfile) return;
        try {
            const apiKeys = (userProfile.apiKeys || []).filter(k => k.key !== keyToDelete);
            await Promise.all([
                updateUserProfile(user.uid, { apiKeys }),
                removeApiKeyFromIndex(keyToDelete),
            ]);
            await refreshProfile();
            showToast('API key deleted.', 'success');
        } catch (error) {
            showToast('Error deleting API key. Please try again.', 'error');
        }
    };

    if (loading || !userProfile) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const plan = userProfile.plan;
    const isPaid = plan === 'pro';
    const limits = PLAN_LIMITS[plan];
    const projectCount = userProfile.usageCounters?.projectCount ?? 0;
    const apiCalls = userProfile.usageCounters?.apiCallsThisMonth ?? 0;

    const renewalDate = userProfile.currentPeriodEnd
        ? new Date(
            userProfile.currentPeriodEnd?.seconds
                ? userProfile.currentPeriodEnd.seconds * 1000
                : userProfile.currentPeriodEnd
          ).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    const memberSince = userProfile.createdAt?.seconds
        ? new Date(userProfile.createdAt.seconds * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Settings</h1>
                    <button onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

                {/* ── Perfil ── */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <SectionHeader icon={UserCircleIcon} title="Profile" />
                    <div className="px-6 py-5 space-y-5">
                        <div className="flex items-center gap-4">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={userProfile.displayName} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                                    {(userProfile.displayName?.[0] ?? userProfile.email?.[0] ?? '?').toUpperCase()}
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{userProfile.displayName}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{userProfile.email}</p>
                                {memberSince && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Member since {memberSince}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Name</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                    placeholder="Your name"
                                />
                                <button
                                    onClick={handleSaveName}
                                    disabled={savingName || displayName.trim() === userProfile.displayName}
                                    className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                                >
                                    {nameSaved ? (
                                        <span className="flex items-center gap-1"><CheckIcon className="w-4 h-4" /> Saved</span>
                                    ) : savingName ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={userProfile.email}
                                readOnly
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Linked to your Google account. Cannot be changed.</p>
                        </div>
                    </div>
                </section>

                {/* ── Uso ── */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <SectionHeader icon={ChartBarIcon} title="Usage" />
                    <div className="px-6 py-5 space-y-4">
                        <UsageBar
                            label="Projects"
                            value={projectCount}
                            max={limits.maxProjects}
                        />
                        <UsageBar
                            label="Layers (busiest project)"
                            value={maxLayersInProject}
                            max={limits.maxLayersPerProject}
                        />
                        <UsageBar
                            label="Features (busiest layer)"
                            value={maxFeaturesInLayer}
                            max={limits.maxFeaturesPerLayer}
                        />
                        {isPaid && (
                            <UsageBar
                                label="API calls this month"
                                value={apiCalls}
                                max={limits.apiRateLimitPerMonth}
                            />
                        )}
                        {!isPaid && (
                            <p className="text-xs text-slate-400 pt-1">
                                <button onClick={() => setShowUpgrade(true)} className="text-indigo-600 font-medium hover:underline">
                                    Upgrade to Pro
                                </button>{' '}
                                for unlimited projects and higher limits.
                            </p>
                        )}
                    </div>
                </section>

                {/* ── Suscripción ── */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <SectionHeader icon={CreditCardIcon} title="Subscription" />
                    <div className="px-6 py-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold"
                                    style={{ background: PLAN_COLORS[plan] }}
                                >
                                    {isPaid && <SparklesIcon className="w-3 h-3" />}
                                    {PLAN_LABELS[plan]}
                                </div>
                                <div>
                                    {isPaid ? (
                                        <>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Active plan</p>
                                            {renewalDate && userProfile.subscriptionStatus !== 'canceled' && (
                                                <p className="text-xs text-slate-500">Renews on {renewalDate}</p>
                                            )}
                                            {userProfile.subscriptionStatus === 'canceled' && renewalDate && (
                                                <p className="text-xs text-amber-600">Access until {renewalDate}</p>
                                            )}
                                            {userProfile.subscriptionStatus === 'past_due' && (
                                                <p className="text-xs text-red-600">Payment failed — update your payment method</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Limited projects and layers</p>
                                    )}
                                </div>
                            </div>
                            {isPaid ? (
                                <button
                                    onClick={handleManageSubscription}
                                    disabled={loadingPortal}
                                    className="btn-outline text-sm px-4 py-2 disabled:opacity-50"
                                >
                                    {loadingPortal ? 'Loading...' : 'Manage subscription'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowUpgrade(true)}
                                    className="btn-primary text-sm px-4 py-2"
                                >
                                    Upgrade to Pro
                                </button>
                            )}
                        </div>

                    </div>
                </section>

                {/* ── API Keys ── */}
                {isPaid && (
                    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <SectionHeader icon={KeyIcon} title="API Keys" />
                        <div className="px-6 py-5 space-y-5">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                API keys let you access your project data programmatically via the REST API.
                            </p>
                            
                            {userProfile.apiKeys && userProfile.apiKeys.length > 0 && (
                                <div className="space-y-3">
                                    {userProfile.apiKeys.map((k) => (
                                        <div key={k.key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 gap-3">
                                            <div className="overflow-hidden">
                                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{k.name}</p>
                                                <p className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">{k.key}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                    Creada: {new Date(k.createdAt?.seconds ? k.createdAt.seconds * 1000 : k.createdAt).toLocaleDateString()}
                                                    {' · '}
                                                    Último uso: {k.lastUsed ? new Date(k.lastUsed?.seconds ? k.lastUsed.seconds * 1000 : k.lastUsed).toLocaleDateString() : 'Nunca'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteApiKey(k.key)}
                                                className="shrink-0 text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar API Key"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(!userProfile.apiKeys || userProfile.apiKeys.length < 5) ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        placeholder="New API key name"
                                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateApiKey()}
                                    />
                                    <button
                                        onClick={handleGenerateApiKey}
                                        disabled={generatingKey || !newKeyName.trim()}
                                        className="btn-primary text-sm px-4 py-2 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                        <span>Generar</span>
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-amber-600">You've reached the 5 API key limit.</p>
                            )}
                        </div>
                    </section>
                )}

                {/* ── Seguridad ── */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <SectionHeader icon={ShieldCheckIcon} title="Security" />
                    <div className="px-6 py-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Authentication provider</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your access is linked to your Google account.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-full px-3 py-1.5">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Google</span>
                            </div>
                        </div>
                        {user?.metadata?.lastSignInTime && (
                            <div>
                                <p className="text-sm font-medium text-slate-700">Last sign-in</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        )}

                        <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors w-full"
                            >
                                <ArrowRightStartOnRectangleIcon className="w-4 h-4 text-slate-400" />
                                Sign out
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Zona de peligro ── */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900 overflow-hidden">
                    <div className="px-6 py-4 border-b border-red-100 dark:border-red-900 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Danger zone</h2>
                    </div>
                    <div className="px-6 py-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Delete account</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Permanently delete your account and all your projects. This action cannot be undone.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="shrink-0 flex items-center gap-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                </section>

                {/* Legal links */}
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500 pb-4">
                    <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
                    <span>·</span>
                    <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
                    <span>·</span>
                    <a href="mailto:support@wktstudio.com" className="hover:text-slate-600 transition-colors">Support</a>
                </div>
            </div>

            {/* Delete Account Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                title="Delete account"
                footer={
                    <>
                        <button
                            onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                            className="btn-outline"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40"
                        >
                            {deletingAccount ? 'Deleting...' : 'Delete account'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-700">
                            <p className="font-semibold mb-1">This action is irreversible</p>
                            <p className="text-xs text-red-600">Your profile, all your projects, and layers will be permanently deleted. This cannot be undone.</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={e => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETE"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            autoComplete="off"
                        />
                    </div>
                </div>
            </Modal>

            <UpgradeModal
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                onShowToast={(msg, type) => showToast(msg, type ?? 'info')}
            />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

export default function SettingsPage() {
    return (
        <AuthWrapper>
            <SettingsContent />
        </AuthWrapper>
    );
}
