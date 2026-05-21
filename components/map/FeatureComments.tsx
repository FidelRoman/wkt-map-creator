"use client";

import { useState, useEffect, useRef } from "react";
import { XMarkIcon, CheckCircleIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import {
    addComment,
    resolveComment,
    subscribeToComments,
    type FeatureComment
} from "@/lib/firebase";
import { useAuth } from "@/components/AuthWrapper";

interface Props {
    projectId: string;
    layerId: string;
    featureIndex: number;
    featureName: string;
    onClose: () => void;
    canWrite: boolean;
}

function timeAgo(ts: any): string {
    try {
        const date = ts?.toDate ? ts.toDate() : new Date(ts?.seconds ? ts.seconds * 1000 : ts);
        const diff = (Date.now() - date.getTime()) / 1000;
        if (diff < 60) return 'ahora';
        if (diff < 3600) return `${Math.floor(diff / 60)}min`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
    } catch { return ''; }
}

export default function FeatureComments({ projectId, layerId, featureIndex, featureName, onClose, canWrite }: Props) {
    const { user } = useAuth();
    const [comments, setComments] = useState<FeatureComment[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = subscribeToComments(projectId, layerId, featureIndex, setComments);
        return unsub;
    }, [projectId, layerId, featureIndex]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const handleSend = async () => {
        if (!text.trim() || !user || sending) return;
        setSending(true);
        try {
            await addComment({
                projectId,
                layerId,
                featureIndex,
                text: text.trim(),
                authorId: user.uid,
                authorName: user.displayName ?? 'Usuario',
                authorPhoto: user.photoURL,
                resolved: false,
            });
            setText('');
        } finally {
            setSending(false);
        }
    };

    const handleResolve = async (id: string) => {
        await resolveComment(projectId, id);
    };

    const open = comments.filter(c => !c.resolved);
    const resolved = comments.filter(c => c.resolved);

    return (
        <div className="fixed right-3 top-14 z-[600] bg-white rounded-xl shadow-xl border border-slate-200 w-64 flex flex-col overflow-hidden" style={{ maxHeight: '60vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <ChatBubbleLeftIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{featureName}</p>
                        <p className="text-[10px] text-slate-400">{open.length} abierto{open.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 shrink-0">
                    <XMarkIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {comments.length === 0 && (
                    <div className="text-center py-5">
                        <ChatBubbleLeftIcon className="w-6 h-6 text-slate-200 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-400">Sin comentarios aún.</p>
                    </div>
                )}

                {open.map(c => (
                    <CommentItem key={c.id} comment={c} canResolve={canWrite} onResolve={() => handleResolve(c.id!)} />
                ))}

                {resolved.length > 0 && (
                    <>
                        <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mt-3">Resueltos ({resolved.length})</p>
                        {resolved.map(c => (
                            <CommentItem key={c.id} comment={c} canResolve={false} onResolve={() => {}} />
                        ))}
                    </>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            {canWrite && user ? (
                <div className="px-3 py-2 border-t border-slate-100 shrink-0">
                    <div className="flex gap-1.5 items-end">
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Comentar... (Enter)"
                            rows={2}
                            className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-300"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!text.trim() || sending}
                            className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                        >
                            {sending ? (
                                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="px-3 py-2 border-t border-slate-100 shrink-0">
                    <p className="text-[10px] text-slate-400 text-center">Solo colaboradores pueden comentar.</p>
                </div>
            )}
        </div>
    );
}

function CommentItem({ comment, canResolve, onResolve }: { comment: FeatureComment; canResolve: boolean; onResolve: () => void }) {
    const initials = comment.authorName?.charAt(0)?.toUpperCase() ?? '?';

    return (
        <div className={`flex gap-2 group ${comment.resolved ? 'opacity-50' : ''}`}>
            {comment.authorPhoto ? (
                <img src={comment.authorPhoto} alt={comment.authorName} className="w-6 h-6 rounded-full shrink-0 object-cover mt-0.5" />
            ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{initials}</div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1">
                    <span className="text-[11px] font-semibold text-slate-700 truncate">{comment.authorName}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(comment.createdAt)}</span>
                    {comment.resolved && <CheckCircleSolid className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                </div>
                <p className={`text-[11px] text-slate-600 mt-0.5 leading-relaxed ${comment.resolved ? 'line-through text-slate-400' : ''}`}>{comment.text}</p>
                {!comment.resolved && canResolve && (
                    <button
                        onClick={onResolve}
                        className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <CheckCircleIcon className="w-2.5 h-2.5" /> Resolver
                    </button>
                )}
            </div>
        </div>
    );
}
