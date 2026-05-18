"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/firebase';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import UpgradeModal from '@/components/UpgradeModal';
import { PLAN_LIMITS, type PlanId } from '@/lib/plans';
import { ArrowLeftIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

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

function SettingsContent() {
    const router = useRouter();
    const { user, userProfile, refreshProfile, loading } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);
    const [loadingPortal, setLoadingPortal] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (userProfile) {
            setDisplayName(userProfile.displayName ?? '');
        }
    }, [userProfile]);

    const handleSaveName = async () => {
        if (!user || !displayName.trim()) return;
        setSavingName(true);
        try {
            await updateUserProfile(user.uid, { displayName: displayName.trim() });
            await refreshProfile();
            setNameSaved(true);
            setTimeout(() => setNameSaved(false), 2000);
        } catch {
            alert('Error al guardar. Intenta de nuevo.');
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
            if (data.url) window.location.href = data.url;
        } catch {
            alert('Error al abrir el portal. Intenta de nuevo.');
        } finally {
            setLoadingPortal(false);
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
    const renewalDate = userProfile.currentPeriodEnd
        ? new Date(userProfile.currentPeriodEnd.seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-semibold text-slate-800">Configuración</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
                {/* Perfil */}
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Perfil</h2>
                    </div>
                    <div className="px-6 py-5 space-y-5">
                        {/* Avatar + email (read-only) */}
                        <div className="flex items-center gap-4">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                                    {(userProfile.displayName?.[0] ?? userProfile.email?.[0] ?? '?').toUpperCase()}
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-slate-800">{userProfile.displayName}</p>
                                <p className="text-sm text-slate-500">{userProfile.email}</p>
                            </div>
                        </div>

                        {/* Display name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-shadow"
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

                        {/* Email (read-only) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
                            <input
                                type="email"
                                value={userProfile.email}
                                readOnly
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-1">El correo está vinculado a tu cuenta de Google.</p>
                        </div>
                    </div>
                </section>

                {/* Suscripción */}
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Suscripción</h2>
                    </div>
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
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">Plan activo</p>
                                            {renewalDate && userProfile.subscriptionStatus !== 'canceled' && (
                                                <p className="text-xs text-slate-500">Renueva el {renewalDate}</p>
                                            )}
                                            {userProfile.subscriptionStatus === 'canceled' && renewalDate && (
                                                <p className="text-xs text-amber-600">Cancela el {renewalDate}</p>
                                            )}
                                            {userProfile.subscriptionStatus === 'past_due' && (
                                                <p className="text-xs text-red-600">Pago fallido — actualiza tu método de pago</p>
                                            )}
                                        </div>
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
                            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                    <p className="text-lg font-bold text-slate-800">{PLAN_LIMITS.free.maxProjects}</p>
                                    <p>proyectos</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                    <p className="text-lg font-bold text-slate-800">{PLAN_LIMITS.free.maxLayersPerProject}</p>
                                    <p>capas / proyecto</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                    <p className="text-lg font-bold text-slate-800">{PLAN_LIMITS.free.maxFeaturesPerLayer}</p>
                                    <p>objetos / capa</p>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

            </div>

            <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
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
