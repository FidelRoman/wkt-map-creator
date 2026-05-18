"use client";
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { PLANS, type PlanId, type LimitKey, type FeatureKey, LIMIT_LABELS, FEATURE_LABELS } from '@/lib/plans';
import { useAuth } from './AuthWrapper';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason?: {
        type: 'limit';
        limitKey: LimitKey;
        current: number;
        limit: number;
        requiredPlan: PlanId;
    } | {
        type: 'feature';
        featureKey: FeatureKey;
        requiredPlan: PlanId;
    };
}

export default function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
    const { user, refreshProfile } = useAuth();
    const [interval, setInterval] = useState<'month' | 'year'>('year');
    const [loading, setLoading] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!isOpen || !mounted) return null;

    const targetPlan = reason?.requiredPlan ?? 'pro';
    const proPlans = PLANS.filter(p => p.id !== 'free');

    const handleUpgrade = async (planId: PlanId) => {
        if (!user) return;
        setLoading(planId);
        try {
            const token = await getIdToken(auth.currentUser!);
            const res = await fetch('/api/ls/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ planId, interval }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert(data.error ?? 'Error al iniciar el checkout. Intenta de nuevo.');
        } catch {
            alert('Error al iniciar el checkout. Intenta de nuevo.');
        } finally {
            setLoading(null);
        }
    };

    const limitText = reason?.type === 'limit'
        ? `Alcanzaste el límite de ${LIMIT_LABELS[reason.limitKey]} (${reason.current}/${reason.limit})`
        : reason?.type === 'feature'
        ? `${FEATURE_LABELS[reason.featureKey]} requiere plan ${reason.requiredPlan === 'pro' ? 'Pro' : 'Business'}`
        : null;

    const yearlySavings = (plan: typeof proPlans[0]) =>
        Math.round(100 - (plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <SparklesIcon className="w-5 h-5 text-indigo-500" />
                            <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Mejora tu plan</span>
                        </div>
                        {limitText && (
                            <p className="text-sm text-gray-500 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {limitText}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Billing toggle */}
                <div className="flex justify-center mb-6 px-6">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
                        <button
                            onClick={() => setInterval('month')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${interval === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                        >
                            Mensual
                        </button>
                        <button
                            onClick={() => setInterval('year')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${interval === 'year' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                        >
                            Anual
                            <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">-30%</span>
                        </button>
                    </div>
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 pb-6">
                    {proPlans.map(plan => {
                        const isTarget = plan.id === targetPlan;
                        const price = interval === 'month' ? plan.monthlyPrice : plan.yearlyPrice;
                        const savings = yearlySavings(plan);

                        return (
                            <div
                                key={plan.id}
                                className={`rounded-xl border-2 p-5 flex flex-col gap-4 transition-all ${isTarget ? 'border-indigo-500 shadow-lg shadow-indigo-100' : 'border-gray-200'}`}
                            >
                                {isTarget && (
                                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Recomendado</div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                                    <p className="text-sm text-gray-500">{plan.description}</p>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-3xl font-extrabold text-gray-900">${price}</span>
                                    <span className="text-gray-500 text-sm mb-1">/{interval === 'month' ? 'mes' : 'año'}</span>
                                </div>
                                {interval === 'year' && (
                                    <p className="text-xs text-green-600 font-medium -mt-2">
                                        Ahorra {savings}% vs mensual
                                    </p>
                                )}

                                <ul className="space-y-2 flex-1">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                            <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleUpgrade(plan.id)}
                                    disabled={!!loading}
                                    className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                                        isTarget
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                    } disabled:opacity-60`}
                                >
                                    {loading === plan.id ? 'Redirigiendo...' : `Upgrade a ${plan.name}`}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <p className="text-center text-xs text-gray-400 pb-4">
                    Pago seguro con Lemon Squeezy · Cancela cuando quieras · Sin compromisos
                </p>
            </div>
        </div>,
        document.body
    );
}
