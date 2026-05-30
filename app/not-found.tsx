"use client";

import Link from 'next/link';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useDarkMode } from '@/lib/useDarkMode';

export default function NotFound() {
  const { dark, toggle: toggleDark } = useDarkMode();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <button onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
      </div>
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full mb-8">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-4">404 — Page not found</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">The page you&apos;re looking for doesn&apos;t exist, has been moved, or is temporarily unavailable.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-sm dark:shadow-none"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
