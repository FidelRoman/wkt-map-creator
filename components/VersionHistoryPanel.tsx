"use client";
import { useState, useEffect } from 'react';
import { ClockIcon, TrashIcon, ArrowUturnLeftIcon, PlusIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { createSnapshot, getSnapshots, deleteSnapshot, type Snapshot, type Layer } from '@/lib/firebase';
import { analytics } from '@/lib/analytics';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  ownerId: string;
  layers: Layer[];
  onRestore: (layers: Layer[]) => void;
  plan: 'free' | 'pro';
  onUpgradeRequired?: () => void;
}

export default function VersionHistoryPanel({
  isOpen,
  onClose,
  projectId,
  ownerId,
  layers,
  onRestore,
  plan,
  onUpgradeRequired,
}: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && plan === 'pro') {
      loadSnapshots();
    }
    if (!isOpen) {
      setConfirmRestoreId(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen, plan]);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const snaps = await getSnapshots(projectId, ownerId);
      setSnapshots(snaps);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    const name = snapshotName.trim() || `Snapshot — ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    setCreating(true);
    try {
      await createSnapshot(projectId, ownerId, name, layers);
      analytics.snapshotCreated();
      setSnapshotName('');
      await loadSnapshots();
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = (snapshot: Snapshot) => {
    const parsedLayers = snapshot.layers.map((l: any) => ({
      ...l,
      features: typeof l.features === 'string' ? JSON.parse(l.features) : l.features,
    }));
    onRestore(parsedLayers);
    analytics.snapshotRestored();
    onClose();
  };

  const handleDelete = async (snapshotId: string) => {
    await deleteSnapshot(snapshotId);
    setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    setConfirmDeleteId(null);
  };

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const ms = ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
    return new Date(ms).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Version History</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {plan !== 'pro' ? (
        /* Upsell for free users */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <SparklesIcon className="w-10 h-10 text-indigo-300 dark:text-indigo-400 mb-3" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Version History is a Pro feature</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Save and restore named snapshots of your project at any time.</p>
          <button
            onClick={onUpgradeRequired}
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
          >
            Upgrade to Pro →
          </button>
        </div>
      ) : (
        <>
          {/* Create snapshot */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium uppercase tracking-wide">Save current state</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Snapshot name (optional)"
                className="flex-1 text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 dark:placeholder:text-slate-500"
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 shrink-0"
              >
                {creating ? (
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <PlusIcon className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </div>

          {/* Snapshot list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <svg className="animate-spin w-6 h-6 text-indigo-400 dark:text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-10 px-4">
                <ClockIcon className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">No snapshots yet.</p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Save a snapshot to be able to restore your project to this point.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {snapshots.map(snap => (
                  <li key={snap.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{snap.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(snap.createdAt)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{snap.layers?.length ?? 0} layers</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmRestoreId === snap.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Restore?</span>
                            <button onClick={() => handleRestore(snap)} className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Yes</button>
                            <button onClick={() => setConfirmRestoreId(null)} className="text-xs text-slate-400 dark:text-slate-500 hover:underline">No</button>
                          </div>
                        ) : confirmDeleteId === snap.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Delete?</span>
                            <button onClick={() => handleDelete(snap.id!)} className="text-xs text-red-500 dark:text-red-400 font-semibold hover:underline">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-400 dark:text-slate-500 hover:underline">No</button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setConfirmRestoreId(snap.id!)}
                              title="Restore this snapshot"
                              className="p-1.5 rounded-lg text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                            >
                              <ArrowUturnLeftIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(snap.id!)}
                              title="Delete snapshot"
                              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
