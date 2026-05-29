"use client";

import { useState, useEffect, useRef } from "react";
import { XMarkIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

interface Props {
    featureName: string;
    featureNote: string;
    onClose: () => void;
    onSaveNote: (note: string) => void;
    canWrite: boolean;
}

export default function FeatureComments({ featureName, featureNote, onClose, onSaveNote, canWrite }: Props) {
    const [text, setText] = useState(featureNote);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setText(featureNote);
    }, [featureNote]);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleBlur = () => {
        if (text !== featureNote) onSaveNote(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { handleBlur(); onClose(); }
    };

    return (
        <div className="fixed right-3 top-14 z-[600] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-64 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <PencilSquareIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{featureName}</p>
                </div>
                <button onClick={() => { handleBlur(); onClose(); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0">
                    <XMarkIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="p-3">
                {canWrite ? (
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="Add a note for this feature…"
                        rows={4}
                        className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-300 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700"
                    />
                ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {featureNote || <span className="text-slate-300 dark:text-slate-600 italic">No annotation.</span>}
                    </p>
                )}
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1.5">Saved automatically on close</p>
            </div>
        </div>
    );
}
