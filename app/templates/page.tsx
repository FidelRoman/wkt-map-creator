"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, MapIcon, SparklesIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { TEMPLATES, type Template } from '@/lib/templates';
import { createProject } from '@/lib/firebase';
import { useAuth } from '@/components/AuthWrapper';
import AuthWrapper from '@/components/AuthWrapper';
import { checkLimit } from '@/lib/plans';
import { useDarkMode } from '@/lib/useDarkMode';

const TAG_COLORS: Record<string, string> = {
    'points': 'bg-blue-50 text-blue-600',
    'polygons': 'bg-emerald-50 text-emerald-600',
    'lines': 'bg-amber-50 text-amber-600',
    'world': 'bg-indigo-50 text-indigo-600',
    'latin-america': 'bg-green-50 text-green-600',
    'usa': 'bg-red-50 text-red-600',
    'cities': 'bg-purple-50 text-purple-600',
    'routes': 'bg-orange-50 text-orange-600',
    'zones': 'bg-pink-50 text-pink-600',
    'countries': 'bg-teal-50 text-teal-600',
    'states': 'bg-sky-50 text-sky-600',
    'transport': 'bg-yellow-50 text-yellow-600',
    'delivery': 'bg-rose-50 text-rose-600',
};

function TemplateCard({ template, onUse, isUsing }: { template: Template; onUse: (t: Template) => void; isUsing: boolean }) {
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-28 flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${template.color}18, ${template.color}35)` }}>
                <div className="text-5xl opacity-30" style={{ color: template.color }}>
                    {template.tags.includes('points') ? '·' : template.tags.includes('lines') ? '~' : '□'}
                </div>
                <div className="absolute top-3 right-3 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border" style={{ color: template.color, borderColor: `${template.color}40`, background: `${template.color}12` }}>
                    {template.featureCount} features
                </div>
            </div>

            <div className="p-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-1">{template.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{template.description}</p>

                <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.map(tag => (
                        <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>{tag}</span>
                    ))}
                </div>

                <button
                    onClick={() => onUse(template)}
                    disabled={isUsing}
                    className="w-full text-sm font-semibold py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                    {isUsing ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : <MapIcon className="w-4 h-4" />}
                    {isUsing ? 'Creating…' : 'Use template'}
                </button>
            </div>
        </div>
    );
}

function TemplatesApp() {
    const { user, userProfile } = useAuth();
    const { dark, toggle: toggleDark } = useDarkMode();
    const plan = userProfile?.plan ?? 'free';
    const [usingId, setUsingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleUseTemplate = async (template: Template) => {
        if (!user) {
            showToast('Sign in to use templates', 'error');
            return;
        }

        const projectCount = userProfile?.usageCounters?.projectCount ?? 0;
        const check = checkLimit(plan, 'maxProjects', projectCount);
        if (!check.allowed) {
            showToast('Project limit reached. Upgrade to Pro to create more.', 'error');
            return;
        }

        setUsingId(template.id);
        try {
            const data = await template.getData();
            const layerFeatures = {
                type: 'FeatureCollection' as const,
                features: data.features.map(f => ({
                    ...f,
                    properties: { ...f.properties, color: f.properties?.color ?? template.color }
                }))
            };

            const { id } = await createProject(template.name, user.uid, user.displayName ?? 'User', user.email ?? '');
            const { saveProjectWithFeatures } = await import('@/lib/firebase');
            await saveProjectWithFeatures(id, [{
                id: 'layer_' + Date.now(),
                name: template.layerName,
                visible: true,
                features: layerFeatures,
            }]);

            showToast(`Project "${template.name}" created. Opening…`, 'success');
            setTimeout(() => { window.location.href = `/p/${id}`; }, 1000);
        } catch (e) {
            console.error(e);
            showToast('Error creating project from template', 'error');
            setUsingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-indigo-600" />
                        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Map Templates</h1>
                    </div>
                    <span className="ml-auto text-xs text-slate-400">{TEMPLATES.length} templates available</span>
                    <button onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Start with real data</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Create a project pre-loaded with geographic data in one click. Templates count toward your project limit.</p>
                </div>

                {!user && (
                    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl text-sm text-indigo-800 dark:text-indigo-300">
                        <strong>Sign in</strong> to use templates and save projects.{' '}
                        <Link href="/" className="underline font-medium">Go to home →</Link>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {TEMPLATES.map(template => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            onUse={handleUseTemplate}
                            isUsing={usingId === template.id}
                        />
                    ))}
                </div>

                <div className="mt-10 text-center">
                    <p className="text-sm text-slate-500">
                        Want to explore maps from other users?{' '}
                        <Link href="/explore" className="text-indigo-600 font-medium hover:underline">Browse public gallery →</Link>
                    </p>
                </div>
            </div>

            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg z-50 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}

export default function TemplatesPage() {
    return (
        <AuthWrapper>
            <TemplatesApp />
        </AuthWrapper>
    );
}
