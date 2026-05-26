"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { PLANS } from '@/lib/plans';
import { CheckIcon } from '@heroicons/react/24/outline';

function GoogleIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

const faqs = [
    {
        q: 'Can I cancel anytime?',
        a: 'Yes. Cancel from your account settings at any time. You keep Pro access until the end of your billing period.',
    },
    {
        q: 'Is there a free trial?',
        a: 'The Free plan is free forever — no credit card needed. Upgrade to Pro when you need more projects, layers, or API access.',
    },
    {
        q: 'What payment methods do you accept?',
        a: 'All major credit and debit cards via Paddle. Paddle handles billing and issues VAT-compliant receipts automatically.',
    },
    {
        q: 'Do you offer refunds?',
        a: 'Yes — full refund within 14 days of purchasing any paid plan, no questions asked. Contact support@wktstudio.com.',
    },
    {
        q: 'Can I switch between monthly and yearly?',
        a: 'Yes. You can change your billing interval at any time from your Subscription settings.',
    },
];

export default function PricingPage() {
    const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');
    const [signingIn, setSigningIn] = useState(false);
    const router = useRouter();

    const freePlan = PLANS.find(p => p.id === 'free')!;
    const proPlan = PLANS.find(p => p.id === 'pro')!;

    const handleGetPro = async () => {
        setSigningIn(true);
        try {
            await signInWithPopup(auth, googleProvider);
            // After sign-in AuthWrapper will redirect; push to settings to trigger upgrade
            router.push('/settings');
        } catch {
            setSigningIn(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Nav */}
            <nav className="border-b border-slate-100 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-slate-800">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        WKT Studio
                    </Link>
                    <Link href="/editor" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                        Open editor →
                    </Link>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-16">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Simple, transparent pricing</h1>
                    <p className="text-slate-500 text-lg">Start free. Upgrade when you need more.</p>
                </div>

                {/* Billing toggle */}
                <div className="flex justify-center mb-10">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
                        <button
                            onClick={() => setBillingInterval('month')}
                            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingInterval === 'month' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingInterval('year')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${billingInterval === 'year' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                        >
                            Yearly
                            <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">−30%</span>
                        </button>
                    </div>
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Free */}
                    <div className="rounded-2xl border-2 border-slate-200 p-6 flex flex-col">
                        <h2 className="text-xl font-bold text-slate-900 mb-1">{freePlan.name}</h2>
                        <p className="text-slate-500 text-sm mb-4">{freePlan.description}</p>
                        <div className="text-4xl font-extrabold text-slate-900 mb-6">$0</div>
                        <ul className="space-y-2 flex-1 mb-6">
                            {freePlan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/editor"
                            className="w-full py-2.5 rounded-xl font-semibold text-sm text-center bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all"
                        >
                            Get started free
                        </Link>
                    </div>

                    {/* Pro */}
                    <div className="rounded-2xl border-2 border-indigo-500 p-6 flex flex-col shadow-lg shadow-indigo-50">
                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Most popular</div>
                        <h2 className="text-xl font-bold text-slate-900 mb-1">{proPlan.name}</h2>
                        <p className="text-slate-500 text-sm mb-4">{proPlan.description}</p>
                        <div className="flex items-end gap-1 mb-1">
                            <span className="text-4xl font-extrabold text-slate-900">
                                ${billingInterval === 'month' ? proPlan.monthlyPrice : proPlan.yearlyPrice}
                            </span>
                            <span className="text-slate-500 text-sm mb-1">/{billingInterval === 'month' ? 'mo' : 'yr'}</span>
                        </div>
                        {billingInterval === 'year' && (
                            <p className="text-xs text-green-600 font-medium mb-4">
                                Save ${proPlan.monthlyPrice * 12 - proPlan.yearlyPrice} vs monthly
                            </p>
                        )}
                        <ul className="space-y-2 flex-1 mb-6 mt-2">
                            {proPlan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                    <CheckIcon className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={handleGetPro}
                            disabled={signingIn}
                            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-60"
                        >
                            {signingIn ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    <GoogleIcon />
                                    Get {proPlan.name}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 mb-16">
                    Secure payment via Paddle · Cancel anytime · No hidden fees
                </p>

                {/* FAQ */}
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Frequently asked questions</h2>
                    <div className="space-y-6">
                        {faqs.map(({ q, a }) => (
                            <div key={q} className="border-b border-slate-100 pb-6 last:border-0">
                                <h3 className="font-semibold text-slate-800 mb-2">{q}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-100 py-8 mt-8">
                <div className="max-w-5xl mx-auto px-6 flex flex-wrap gap-4 justify-center text-sm text-slate-400">
                    <Link href="/" className="hover:text-slate-600">Home</Link>
                    <Link href="/editor" className="hover:text-slate-600">Editor</Link>
                    <Link href="/terms" className="hover:text-slate-600">Terms</Link>
                    <Link href="/privacy" className="hover:text-slate-600">Privacy</Link>
                    <a href="mailto:support@wktstudio.com" className="hover:text-slate-600">Support</a>
                </div>
            </footer>
        </div>
    );
}
