"use client";
import { useState } from 'react';
import { LockClosedIcon } from '@heroicons/react/24/outline';

interface Props {
    projectId: string;
    onUnlocked: () => void;
}

export default function PasswordGate({ projectId, onUnlocked }: Props) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/projects/${projectId}/verify-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                sessionStorage.setItem(`pw-unlocked-${projectId}`, '1');
                onUnlocked();
            } else {
                setError('Incorrect password. Please try again.');
            }
        } catch {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 flex flex-col items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                    <LockClosedIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-center">
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Password required</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This map is password-protected.</p>
                </div>
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
                    <input
                        type="password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        placeholder="Enter password"
                        autoFocus
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading || !password.trim()}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
                    >
                        {loading ? 'Verifying…' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    );
}
