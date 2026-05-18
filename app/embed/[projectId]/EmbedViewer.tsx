"use client";
import dynamic from 'next/dynamic';
import { Project } from '@/lib/firebase';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100">Cargando...</div>
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
                    className="absolute bottom-2 right-2 z-[9999] pointer-events-auto"
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
            <div className="absolute top-3 left-3 z-[9999] pointer-events-none">
                <div className="bg-white bg-opacity-90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow text-sm font-semibold text-gray-800 border border-gray-200">
                    {project.name}
                </div>
            </div>
        </div>
    );
}
