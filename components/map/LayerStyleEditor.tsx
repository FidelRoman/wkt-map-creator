"use client";

import { useState } from "react";
import type { Layer, LayerStyle } from "@/lib/firebase";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface Props {
    layer: Layer;
    onUpdate: (style: LayerStyle) => void;
    onClose: () => void;
}

const PRESET_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
    '#64748b', '#1e293b',
];

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-600 w-24 shrink-0">{label}</span>
            <div className="flex items-center gap-1.5 flex-1">
                {PRESET_COLORS.map(c => (
                    <button
                        key={c}
                        onClick={() => onChange(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 shrink-0 ${value === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                        style={{ background: c }}
                    />
                ))}
                <input
                    type="color"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                    title="Color personalizado"
                />
            </div>
        </div>
    );
}

function SliderRow({ label, value, min, max, step, onChange, format }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; format?: (v: number) => string;
}) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-24 shrink-0">{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="flex-1 accent-indigo-600"
            />
            <span className="text-xs text-slate-500 w-10 text-right tabular-nums">{format ? format(value) : value}</span>
        </div>
    );
}

export default function LayerStyleEditor({ layer, onUpdate, onClose }: Props) {
    const s = layer.style ?? {};
    const [fillColor, setFillColor] = useState(s.fillColor ?? '#6366f1');
    const [fillOpacity, setFillOpacity] = useState(s.fillOpacity ?? 0.4);
    const [strokeColor, setStrokeColor] = useState(s.strokeColor ?? '#6366f1');
    const [strokeWidth, setStrokeWidth] = useState(s.strokeWidth ?? 2);
    const [strokeOpacity, setStrokeOpacity] = useState(s.strokeOpacity ?? 1);
    const [pointRadius, setPointRadius] = useState(s.pointRadius ?? 6);

    const apply = (patch: Partial<LayerStyle>) => {
        onUpdate({ fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity, pointRadius, ...patch });
    };

    const field = <K extends keyof LayerStyle>(key: K, setter: (v: any) => void) => (v: any) => {
        setter(v);
        apply({ [key]: v });
    };

    return (
        <div className="fixed right-4 top-4 z-[600] bg-white rounded-2xl shadow-xl border border-slate-200 w-80 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                    <p className="text-sm font-semibold text-slate-800">Estilo de capa</p>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">{layer.name}</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>

            <div className="px-4 py-4 space-y-4">
                <div className="space-y-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Relleno</p>
                    <ColorRow label="Color" value={fillColor} onChange={field('fillColor', setFillColor)} />
                    <SliderRow label="Opacidad" value={fillOpacity} min={0} max={1} step={0.05} onChange={field('fillOpacity', setFillOpacity)} format={v => `${Math.round(v * 100)}%`} />
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Borde</p>
                    <ColorRow label="Color" value={strokeColor} onChange={field('strokeColor', setStrokeColor)} />
                    <SliderRow label="Grosor" value={strokeWidth} min={0} max={10} step={0.5} onChange={field('strokeWidth', setStrokeWidth)} format={v => `${v}px`} />
                    <SliderRow label="Opacidad" value={strokeOpacity} min={0} max={1} step={0.05} onChange={field('strokeOpacity', setStrokeOpacity)} format={v => `${Math.round(v * 100)}%`} />
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Points</p>
                    <SliderRow label="Radius" value={pointRadius} min={2} max={20} step={1} onChange={field('pointRadius', setPointRadius)} format={v => `${v}px`} />
                </div>
            </div>
        </div>
    );
}
