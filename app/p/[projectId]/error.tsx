"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Editor error]", error);
  }, [error]);

  return (
    <div className="h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-full mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Failed to load the editor</h2>
        <p className="text-slate-500 mb-2 text-sm">
          Something went wrong loading this project. Your data is safe in the cloud.
        </p>
        {error?.message && (
          <p className="text-xs text-slate-400 font-mono bg-slate-50 rounded-lg px-3 py-2 mb-6 text-left break-all">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-xl transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
