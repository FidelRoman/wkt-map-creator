"use client";
import { useEffect, useState } from "react";

interface ToastProps {
    message: string;
    onClose: () => void;
    duration?: number;
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className="fixed bottom-5 right-5 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-[9999] animate-fade-in-up">
            <span>{message}</span>
        </div>
    );
}
