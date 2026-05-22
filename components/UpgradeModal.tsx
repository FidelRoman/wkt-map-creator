"use client";
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { PLANS, PADDLE_PRICES, type PlanId, type LimitKey, type FeatureKey, LIMIT_LABELS, FEATURE_LABELS } from '@/lib/plans';
import { useAuth } from './AuthWrapper';
import type { ToastType } from './Toast';

declare global {
    interface Window {
        Paddle?: {
            Initialize: (opts: { token: string; eventCallback?: (e: any) => void }) => void;
            Checkout: {
                open: (opts: {
                    items: Array<{ priceId: string; quantity: number }>;
                    customer?: { email?: string };
                    customData?: Record<string, string>;
                    settings?: { successUrl?: string; displayMode?: string };
                }) => void;
            };
        };
    }
}

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShowToast?: (message: string, type?: ToastType) => void;
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

function loadPaddleScript(): Promise<void> {
    return new Promise((resolve) => {
        if (window.Paddle) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
}

export default function UpgradeModal({ isOpen, onClose, onShowToast, reason }: UpgradeModalProps) {
    const { user } = useAuth();
    const [interval, setInterval] = useState<'month' | 'year'>('year');
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const proPlan = PLANS.find(p => p.id === 'pro')!;

    const handleUpgrade = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await loadPaddleScript();
            const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';
            window.Paddle!.Initialize({ token: clientToken });

            const priceId = interval === 'month' ? PADDLE_PRICES.pro_monthly : PADDLE_PRICES.pro_yearly;
            window.Paddle!.Checkout.open({
                items: [{ priceId, quantity: 1 }],
                customer: { email: user.email ?? undefined },
                customData: { firebase_uid: user.uid },
                settings: {
                    successUrl: `${window.location.origin}/?upgrade=success`,
                    displayMode: 'overlay',
                },
            });
        } catch {
            onShowToast?.('Error starting checkout. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const limitText = reason?.type === 'limit'
        ? `You reached the limit for ${LIMIT_LABELS[reason.limitKey]} (${reason.current}/${reason.limit})`
        : reason?.type === 'feature'
        ? `${FEATURE_LABELS[reason.featureKey]} requires the Pro plan`
        : null;

    const yearlySavings = Math.round(100 - (proPlan.yearlyPrice / (proPlan.monthlyPrice * 12)) * 100);

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-modal-title"
        >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                <div className="flex items-start justify-between p-6 pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <SparklesIcon className="w-5 h-5 text-indigo-500" />
                            <span id="upgrade-modal-title" className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Upgrade to Pro</span>
                        </div>
                        {limitText && (
                            <p className="text-sm text-gray-500 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {limitText}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-4 flex-shrink-0"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex justify-center mb-6 px-6">
                    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                        <button
                            onClick={() => setInterval('month')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${interval === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setInterval('year')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${interval === 'year' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Yearly
                            <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">-{yearlySavings}%</span>
                        </button>
                    </div>
                </div>

                <div className="px-6 pb-6">
                    <div className="rounded-xl border-2 border-indigo-500 p-5 flex flex-col gap-4 shadow-lg shadow-indigo-100">
                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Most popular</div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{proPlan.name}</h3>
                            <p className="text-sm text-gray-500">{proPlan.description}</p>
                        </div>
                        <div className="flex items-end gap-1">
                            <span className="text-3xl font-extrabold text-gray-900">
                                ${interval === 'month' ? proPlan.monthlyPrice : proPlan.yearlyPrice}
                            </span>
                            <span className="text-gray-500 text-sm mb-1">/{interval === 'month' ? 'mo' : 'yr'}</span>
                        </div>
                        {interval === 'year' && (
                            <p className="text-xs text-green-600 font-medium -mt-2">
                                Save {yearlySavings}% vs monthly
                            </p>
                        )}
                        <ul className="space-y-2">
                            {proPlan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={handleUpgrade}
                            disabled={loading}
                            className="w-full py-2.5 rounded-lg font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Loading...
                                </>
                            ) : `Get Pro`}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 pb-4">
                    Secure payment via Paddle · Cancel anytime · No hidden fees
                </p>
            </div>
        </div>,
        document.body
    );
}
