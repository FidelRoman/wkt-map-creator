"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, MapIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { TEMPLATES, type Template } from '@/lib/templates';
import { createProject } from '@/lib/firebase';
import { useAuth } from '@/components/AuthWrapper';
import AuthWrapper from '@/components/AuthWrapper';
import { checkLimit } from '@/lib/plans';

const TAG_COLORS: Record<string, string> = {
    'puntos': 'bg-blue-50 text-blue-600',
    'polígonos': 'bg-emerald-50 text-emerald-600',
    'líneas': 'bg-amber-50 text-amber-600',
    'mundial': 'bg-indigo-50 text-indigo-600',
    'latinoamérica': 'bg-green-50 text-green-600',
    'usa': 'bg-red-50 text-red-600',
    'ciudades': 'bg-purple-50 text-purple-600',
    'rutas': 'bg-orange-50 text-orange-600',
    'zonas': 'bg-pink-50 text-pink-600',
    'países': 'bg-teal-50 text-teal-600',
    'estados': 'bg-sky-50 text-sky-600',
    'transporte': 'bg-yellow-50 text-yellow-600',
    'entrega': 'bg-rose-50 text-rose-600',
};

function TemplateCard({ template, onUse, isUsing }: { template: Template; onUse: (t: Template) => void; isUsing: boolean }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            {/* Visual preview */}
            <div className="h-28 flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${template.color}18, ${template.color}35)` }}>
                <div className="text-5xl opacity-30" style={{ color: template.color }}>
                    {template.tags.includes('puntos') ? '·' : template.tags.includes('líneas') ? '~' : '□'}
                </div>
                <div className="absolute top-3 right-3 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border" style={{ color: template.color, borderColor: `${template.color}40`, background: `${template.color}12` }}>
                    {template.featureCount} objetos
                </div>
            </div>

            <div className="p-4">
                <h3 className="font-semibold text-slate-800 text-sm mb-1">{template.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">{template.description}</p>

                <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.map(tag => (
                        <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag] ?? 'bg-slate-100 text-slate-500'}`}>{tag}</span>
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
                    {isUsing ? 'Creando...' : 'Usar template'}
                </button>
            </div>
        </div>
    );
}

function TemplatesApp() {
    const { user, userProfile } = useAuth();
    const plan = userProfile?.plan ?? 'free';
    const [usingId, setUsingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleUseTemplate = async (template: Template) => {
        if (!user) {
            showToast('Inicia sesión para usar templates', 'error');
            return;
        }

        const projectCount = userProfile?.usageCounters?.projectCount ?? 0;
        const check = checkLimit(plan, 'maxProjects', projectCount);
        if (!check.allowed) {
            showToast(`Límite de proyectos alcanzado. Actualiza a Pro para crear más.`, 'error');
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

            const { id } = await createProject(template.name, user.uid, user.displayName ?? 'Usuario', user.email ?? '');
            // We need to immediately update the project with the template layer
            const { saveProjectLayers } = await import('@/lib/firebase');
            await saveProjectLayers(id, [{
                id: 'layer_' + Date.now(),
                name: template.layerName,
                visible: true,
                features: layerFeatures,
            }]);

            showToast(`Proyecto "${template.name}" creado. Abriendo...`, 'success');
            setTimeout(() => { window.location.href = `/${id}`; }, 1000);
        } catch (e) {
            console.error(e);
            showToast('Error al crear el proyecto con template', 'error');
            setUsingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-indigo-600" />
                        <h1 className="text-base font-semibold text-slate-800">Templates de Mapas</h1>
                    </div>
                    <span className="ml-auto text-xs text-slate-400">{TEMPLATES.length} templates disponibles</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Empieza con datos reales</h2>
                    <p className="text-slate-500 mt-1 text-sm">Crea un proyecto pre-cargado con datos geográficos en un solo clic. Los templates cuentan hacia tu límite de proyectos.</p>
                </div>

                {!user && (
                    <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800">
                        <strong>Inicia sesión</strong> para usar templates y guardar proyectos.{' '}
                        <Link href="/" className="underline font-medium">Ir al inicio →</Link>
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
                        ¿Quieres explorar mapas de otros usuarios?{' '}
                        <Link href="/explore" className="text-indigo-600 font-medium hover:underline">Explorar galería pública →</Link>
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
