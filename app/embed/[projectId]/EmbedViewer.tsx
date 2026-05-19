"use client";
import dynamic from 'next/dynamic';
import { Project } from '@/lib/firebase';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
            <div className="relative flex items-center justify-center w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <svg className="absolute w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <p className="text-slate-500 font-medium text-sm animate-pulse">Cargando mapa...</p>
        </div>
    )
});

interface EmbedViewerProps {
    project: Project;
    hideWatermark?: boolean;
}

export default function EmbedViewer({ project, hideWatermark = false }: EmbedViewerProps) {
    const layers = project.layers ?? [];
    const firstLayerId = layers[0]?.id ?? null;

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <Map
                layers={layers}
                activeLayerId={null}
                onUpdateLayer={() => {}}
                plan="free"
            />

            {/* Read-only overlay — disable all interactions from the embed */}
            <div className="absolute inset-0 pointer-events-none" />

            {!hideWatermark && (
                <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 z-9999 pointer-events-auto"
                >
                    <div className="flex items-center gap-1.5 bg-white bg-opacity-90 backdrop-blur-sm text-xs text-gray-600 px-2.5 py-1.5 rounded-full shadow border border-gray-200 hover:bg-opacity-100 transition-all">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={2.5}>
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                        </svg>
                        <span>WKT Map Creator</span>
                    </div>
                </a>
            )}

            {/* Project name overlay */}
            <div className="absolute top-3 left-3 z-9999 pointer-events-none">
                <div className="bg-white bg-opacity-90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow text-sm font-semibold text-gray-800 border border-gray-200">
                    {project.name}
                </div>
            </div>
        </div>
    );
}
