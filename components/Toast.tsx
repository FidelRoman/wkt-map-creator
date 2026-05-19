"use client";
import { useEffect } from "react";
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
}

const STYLES: Record<ToastType, { bg: string; Icon: React.ElementType }> = {
    success: { bg: 'bg-emerald-600', Icon: CheckCircleIcon },
    error:   { bg: 'bg-red-600',     Icon: XCircleIcon },
    warning: { bg: 'bg-amber-500',   Icon: ExclamationTriangleIcon },
    info:    { bg: 'bg-slate-800',   Icon: InformationCircleIcon },
};

export default function Toast({ message, type = 'info', onClose, duration = 3500 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const { bg, Icon } = STYLES[type];

    return (
        <div className={`fixed bottom-5 right-5 ${bg} text-white pl-3 pr-2 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 z-[99999] animate-fade-in-up max-w-sm`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{message}</span>
            <button
                onClick={onClose}
                className="ml-1 p-0.5 rounded hover:bg-white/20 transition-colors flex-shrink-0"
                aria-label="Cerrar notificación"
            >
                <XMarkIcon className="w-4 h-4" />
            </button>
        </div>
    );
}
