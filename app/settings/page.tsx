"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, deleteUser } from 'firebase/auth';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/firebase';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import UpgradeModal from '@/components/UpgradeModal';
import Modal from '@/components/Modal';
import { PLAN_LIMITS, type PlanId } from '@/lib/plans';
import {
    ArrowLeftIcon, CheckIcon, SparklesIcon,
    ArrowRightStartOnRectangleIcon, TrashIcon, ShieldCheckIcon,
    ChartBarIcon, UserCircleIcon, CreditCardIcon, ExclamationTriangleIcon,
    KeyIcon, PlusIcon
} from '@heroicons/react/24/outline';
import Toast, { type ToastType } from '@/components/Toast';

const PLAN_COLORS: Record<PlanId, string> = {
    free: '#6b7280',
    pro: '#6366f1',
    business: '#f59e0b',
};

const PLAN_LABELS: Record<PlanId, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
};

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
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
                <span className="text-slate-600">{label}</span>
                <span className={`font-semibold ${isOver ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500'}`}>
                    {value}{max !== null ? `/${max}` : ''}
                </span>
            </div>
            {max !== null && (
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
    const [displayName, setDisplayName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);
    const [loadingPortal, setLoadingPortal] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [generatingKey, setGeneratingKey] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        if (!loading && !user) router.replace('/');
    }, [user, loading, router]);

    useEffect(() => {
        if (userProfile) setDisplayName(userProfile.displayName ?? '');
    }, [userProfile]);

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
            showToast('Error al guardar. Intenta de nuevo.', 'error');
        } finally {
            setSavingName(false);
        }
    };

    const handleManageSubscription = async () => {
        if (!user) return;
        setLoadingPortal(true);
        try {
            const token = await getIdToken(auth.currentUser!);
            const res = await fetch('/api/ls/customer-portal', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                showToast(data.error ?? 'No se encontró un portal de suscripción. Contacta a soporte.', 'error');
            }
        } catch {
            showToast('Error al abrir el portal. Intenta de nuevo.', 'error');
        } finally {
            setLoadingPortal(false);
        }
    };

    const handleSignOut = async () => {
        await signOut(auth);
        router.replace('/');
    };

    const handleDeleteAccount = async () => {
        if (!user || deleteConfirmText !== 'ELIMINAR') return;
        setDeletingAccount(true);
        try {
            await deleteUser(user);
            router.replace('/');
        } catch (err: any) {
            if (err?.code === 'auth/requires-recent-login') {
                showToast('Por seguridad, cierra sesión y vuelve a ingresar antes de eliminar tu cuenta.', 'warning');
            } else {
                showToast('Error al eliminar la cuenta. Intenta de nuevo.', 'error');
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
            await updateUserProfile(user.uid, { apiKeys });
            await refreshProfile();
            setNewKeyName('');
            showToast('API Key generada con éxito.', 'success');
        } catch (error) {
            showToast('Error al generar la API Key.', 'error');
        } finally {
            setGeneratingKey(false);
        }
    };

    const handleDeleteApiKey = async (keyToDelete: string) => {
        if (!user || !userProfile) return;
        try {
            const apiKeys = (userProfile.apiKeys || []).filter(k => k.key !== keyToDelete);
            await updateUserProfile(user.uid, { apiKeys });
            await refreshProfile();
            showToast('API Key eliminada.', 'success');
        } catch (error) {
            showToast('Error al eliminar la API Key.', 'error');
        }
    };

    if (loading || !userProfile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const plan = userProfile.plan;
    const isPaid = plan === 'pro' || plan === 'business';
    const limits = PLAN_LIMITS[plan];
    const projectCount = userProfile.usageCounters?.projectCount ?? 0;
    const apiCalls = userProfile.usageCounters?.apiCallsThisMonth ?? 0;

    const renewalDate = userProfile.currentPeriodEnd
        ? new Date(userProfile.currentPeriodEnd.seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    const memberSince = userProfile.createdAt?.seconds
        ? new Date(userProfile.createdAt.seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-semibold text-slate-800">Configuración</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

                {/* ── Perfil ── */}
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <SectionHeader icon={UserCircleIcon} title="Perfil" />
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
                                <p className="font-semibold text-slate-800">{userProfile.displayName}</p>
                                <p className="text-sm text-slate-500">{userProfile.email}</p>
                                {memberSince && (
                                    <p className="text-xs text-slate-400 mt-0.5">Miembro desde {memberSince}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-shadow"
                                    placeholder="Tu nombre"
                                />
                                <button
                                    onClick={handleSaveName}
                                    disabled={savingName || displayName.trim() === userProfile.displayName}
                                    className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                                >
                                    {nameSaved ? (
                                        <span className="flex items-center gap-1"><CheckIcon className="w-4 h-4" /> Guardado</span>
                                    ) : savingName ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
                            <input
                                type="email"
                                value={userProfile.email}
                                readOnly
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-1">Vinculado a tu cuenta de Google. No se puede cambiar.</p>
                        </div>
                    </div>
                </section>

                {/* ── Uso ── */}
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <SectionHeader icon={ChartBarIcon} title="Uso" />
                    <div className="px-6 py-5 space-y-4">
                        <UsageBar
                            label="Proyectos"
                            value={projectCount}
                            max={limits.maxProjects}
                        />
                        <UsageBar
                            label="Capas por proyecto"
                            value={0}
                            max={limits.maxLayersPerProject}
                        />
                        <UsageBar
                            label="Objetos por capa"
                            value={0}
                            max={limits.maxFeaturesPerLayer}
                        />
                        {apiCalls > 0 && (
                            <UsageBar
                                label="Llamadas API este mes"
                                value={apiCalls}
                                max={plan === 'free' ? 100 : null}
                            />
                        )}
                        {plan === 'free' && (
                            <p className="text-xs text-slate-400 pt-1">
                                Los límites se muestran para el plan Free.{' '}
                                <button onClick={() => setShowUpgrade(true)} className="text-indigo-600 font-medium hover:underline">
                                    Upgrade a Pro
                                </button>{' '}
                                para límites más altos.
                            </p>
                        )}
                    </div>
                </section>

                {/* ── Suscripción ── */}
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <SectionHeader icon={CreditCardIcon} title="Suscripción" />
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
                                            <p className="text-sm font-medium text-slate-800">Plan activo</p>
                                            {renewalDate && userProfile.subscriptionStatus !== 'canceled' && (
                                                <p className="text-xs text-slate-500">Renueva el {renewalDate}</p>
                                            )}
                                            {userProfile.subscriptionStatus === 'canceled' && renewalDate && (
                                                <p className="text-xs text-amber-600">Acceso hasta el {renewalDate}</p>
                                            )}
                                            {userProfile.subscriptionStatus === 'past_due' && (
                                                <p className="text-xs text-red-600">Pago fallido — actualiza tu método de pago</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-slate-500">Proyectos y capas limitadas</p>
                                    )}
                                </div>
                            </div>
                            {isPaid ? (
                                <button
                                    onClick={handleManageSubscription}
                                    disabled={loadingPortal}
                                    className="btn-outline text-sm px-4 py-2"
                                >
                                    {loadingPortal ? 'Cargando...' : 'Gestionar'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowUpgrade(true)}
                                    className="btn-primary text-sm px-4 py-2"
                                >
                                    Upgrade a Pro
                                </button>
                            )}
                        </div>

                        {!isPaid && (
                            <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                                {[
                                    { value: PLAN_LIMITS.free.maxProjects, label: 'proyectos' },
                                    { value: PLAN_LIMITS.free.maxLayersPerProject, label: 'capas / proyecto' },
                                    { value: PLAN_LIMITS.free.maxFeaturesPerLayer, label: 'objetos / capa' },
                                ].map(({ value, label }) => (
                                    <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                        <p className="text-lg font-bold text-slate-800">{value}</p>
                                        <p>{label}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* ── API Keys ── */}
                {isPaid && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <SectionHeader icon={KeyIcon} title="API Keys" />
                        <div className="px-6 py-5 space-y-5">
                            <p className="text-sm text-slate-600">
                                Las API Keys te permiten acceder de forma programática a los datos de tus proyectos.
                            </p>
                            
                            {userProfile.apiKeys && userProfile.apiKeys.length > 0 && (
                                <div className="space-y-3">
                                    {userProfile.apiKeys.map((k) => (
                                        <div key={k.key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50 gap-3">
                                            <div className="overflow-hidden">
                                                <p className="font-semibold text-sm text-slate-800">{k.name}</p>
                                                <p className="font-mono text-xs text-slate-500 truncate">{k.key}</p>
                                                <p className="text-xs text-slate-400 mt-1">
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
                                        placeholder="Nombre de la nueva API Key"
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                                <p className="text-xs text-amber-600">Has alcanzado el límite de 5 API Keys.</p>
                            )}
                        </div>
                    </section>
                )}

                {/* ── Seguridad ── */}
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <SectionHeader icon={ShieldCheckIcon} title="Seguridad" />
                    <div className="px-6 py-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-700">Proveedor de autenticación</p>
                                <p className="text-xs text-slate-500 mt-0.5">Tu acceso está vinculado a tu cuenta de Google.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                                <span className="text-xs font-semibold text-slate-700">Google</span>
                            </div>
                        </div>
                        {user?.metadata?.lastSignInTime && (
                            <div>
                                <p className="text-sm font-medium text-slate-700">Última sesión</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {new Date(user.metadata.lastSignInTime).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        )}

                        <div className="pt-1 border-t border-slate-100">
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors w-full"
                            >
                                <ArrowRightStartOnRectangleIcon className="w-4 h-4 text-slate-400" />
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Zona de peligro ── */}
                <section className="bg-white rounded-2xl border border-red-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                        <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">Zona de peligro</h2>
                    </div>
                    <div className="px-6 py-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-800">Eliminar cuenta</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Elimina permanentemente tu cuenta y todos tus proyectos. Esta acción no se puede deshacer.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="shrink-0 flex items-center gap-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Eliminar
                            </button>
                        </div>
                    </div>
                </section>

                {/* Legal links */}
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pb-4">
                    <Link href="/terms" className="hover:text-slate-600 transition-colors">Términos de Servicio</Link>
                    <span>·</span>
                    <Link href="/privacy" className="hover:text-slate-600 transition-colors">Política de Privacidad</Link>
                    <span>·</span>
                    <a href="mailto:soporte@wktmap.com" className="hover:text-slate-600 transition-colors">Soporte</a>
                </div>
            </div>

            {/* Delete Account Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                title="Eliminar cuenta"
                footer={
                    <>
                        <button
                            onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                            className="btn-outline"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'ELIMINAR' || deletingAccount}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40"
                        >
                            {deletingAccount ? 'Eliminando...' : 'Eliminar cuenta'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-700">
                            <p className="font-semibold mb-1">Esta acción es irreversible</p>
                            <p className="text-xs text-red-600">Se eliminarán tu perfil, todos tus proyectos y capas. No podrás recuperar esta información.</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Escribe <span className="font-mono font-bold text-red-600">ELIMINAR</span> para confirmar
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={e => setDeleteConfirmText(e.target.value)}
                            placeholder="ELIMINAR"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
