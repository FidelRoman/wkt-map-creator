"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, GlobeAltIcon, MapIcon, SquaresPlusIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { getPublicProjects, forkProject, type Project } from '@/lib/firebase';
import { useAuth } from '@/components/AuthWrapper';
import { useDarkMode } from '@/lib/useDarkMode';

function timeAgo(ts: any): string {
    try {
        const date = ts?.toDate ? ts.toDate() : new Date(ts?.seconds ? ts.seconds * 1000 : ts);
        const diff = (Date.now() - date.getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    } catch { return ''; }
}

function featureCount(project: Project): number {
    return (project.layers ?? []).reduce((acc, l) => {
        const fc = l.features;
        return acc + (fc?.features?.length ?? 0);
    }, 0);
}

function ProjectCard({ project, onFork, isForking }: { project: Project; onFork: (id: string) => void; isForking: boolean }) {
    const layers = project.layers ?? [];
    const features = featureCount(project);
    const color = layers[0]?.features?.features?.[0]?.properties?.color ?? '#6366f1';

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
            <div className="h-32 flex items-center justify-center relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
                <GlobeAltIcon className="w-10 h-10 opacity-20" style={{ color }} />
                <div className="absolute bottom-2 right-2 flex gap-1">
                    {layers.slice(0, 3).map((l, i) => (
                        <div key={i} className="w-2 h-2 rounded-full border border-white/50" style={{ background: l.features?.features?.[0]?.properties?.color ?? '#6366f1' }} />
                    ))}
                </div>
            </div>

            <div className="p-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate" title={project.name}>{project.name}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{project.ownerName || 'Anonymous'}</p>

                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><MapIcon className="w-3.5 h-3.5" />{layers.length} {layers.length === 1 ? 'layer' : 'layers'}</span>
                    <span className="flex items-center gap-1"><SquaresPlusIcon className="w-3.5 h-3.5" />{features} features</span>
                    <span className="ml-auto text-slate-400 dark:text-slate-500">{timeAgo(project.updatedAt)}</span>
                </div>

                <div className="flex gap-2 mt-3">
                    <Link
                        href={`/${project.id}`}
                        className="flex-1 text-center text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                        View map →
                    </Link>
                    <button
                        onClick={() => onFork(project.id!)}
                        disabled={isForking}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        title="Duplicate to my account"
                    >
                        {isForking ? '…' : 'Fork'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ExplorePage() {
    const { user } = useAuth();
    const { dark, toggle: toggleDark } = useDarkMode();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [forkingId, setForkingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        getPublicProjects(48).then(p => { setProjects(p); setLoading(false); });
    }, []);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleFork = async (projectId: string) => {
        if (!user) {
            showToast('Sign in to fork projects', 'error');
            return;
        }
        setForkingId(projectId);
        try {
            const newId = await forkProject(projectId, user.uid, user.displayName ?? 'User', user.email ?? '');
            showToast('Project forked. Opening…', 'success');
            setTimeout(() => { window.location.href = `/${newId}`; }, 1200);
        } catch {
            showToast('Error forking project', 'error');
        } finally {
            setForkingId(null);
        }
    };

    const filtered = projects.filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.ownerName?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <GlobeAltIcon className="w-5 h-5 text-indigo-600" />
                        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Explore public maps</h1>
                    </div>
                    <input
                        type="search"
                        placeholder="Search maps…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="ml-auto w-52 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden animate-pulse">
                                <div className="h-32 bg-slate-100 dark:bg-slate-700" />
                                <div className="p-4 space-y-2">
                                    <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <GlobeAltIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            {search ? 'No results for your search' : 'No public projects yet'}
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                            {search ? 'Try a different term.' : 'Be the first to share a public project.'}
                        </p>
                        <Link href="/" className="mt-4 inline-block text-sm text-indigo-600 font-medium hover:underline">
                            Create a project →
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{filtered.length} public project{filtered.length !== 1 ? 's' : ''}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filtered.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onFork={handleFork}
                                    isForking={forkingId === project.id}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg z-50 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}
