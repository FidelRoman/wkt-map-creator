"use client";
import { useState, useMemo, useCallback } from 'react';
import { XMarkIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, ArrowDownTrayIcon, SparklesIcon } from '@heroicons/react/24/outline';
import * as turf from '@turf/turf';
import { stringify } from 'wellknown';
import type { Layer } from '@/lib/firebase';
import type { PlanId } from '@/lib/plans';
import { hasFeature } from '@/lib/plans';

interface AttributeTableProps {
    layer: Layer | null;
    onUpdateLayer: (layerId: string, features: any) => void;
    onFocusFeature: (feature: any) => void;
    selectedIndices: Set<number>;
    onToggleSelection: (index: number, multi: boolean) => void;
    plan: PlanId;
    onUpgradeRequired?: () => void;
    onClose: () => void;
}

type SortDir = 'asc' | 'desc' | null;

const formatArea = (m2: number) => m2 >= 1_000_000 ? `${(m2 / 1_000_000).toFixed(2)} km²` : `${(m2 / 10_000).toFixed(2)} ha`;
const formatLength = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;

export default function AttributeTable({
    layer,
    onUpdateLayer,
    onFocusFeature,
    selectedIndices,
    onToggleSelection,
    plan,
    onUpgradeRequired,
    onClose,
}: AttributeTableProps) {
    const [sortCol, setSortCol] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>(null);
    const [search, setSearch] = useState('');
    const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    const isPro = hasFeature(plan, 'hasVersionHistory'); // proxy for pro/business

    const features: any[] = useMemo(() => layer?.features?.features ?? [], [layer]);

    const customCols = useMemo(() => {
        const keys = new Set<string>();
        features.forEach(f => {
            Object.keys(f.properties ?? {}).forEach(k => {
                if (!['name', 'color'].includes(k)) keys.add(k);
            });
        });
        return Array.from(keys);
    }, [features]);

    const rows = useMemo(() => {
        return features.map((f, i) => {
            const geomType = f.geometry?.type ?? 'Unknown';
            let area = 0;
            let perimeter = 0;
            try {
                if (geomType.includes('Polygon')) {
                    area = turf.area(f);
                    perimeter = turf.length(f, { units: 'meters' });
                }
            } catch { /* ignore */ }
            return { index: i, name: f.properties?.name ?? `Objeto ${i + 1}`, color: f.properties?.color ?? '#888', geomType, area, perimeter, feature: f };
        });
    }, [features]);

    const filtered = useMemo(() => {
        let result = rows;
        if (search) result = result.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
        if (sortCol && sortDir) {
            result = [...result].sort((a: any, b: any) => {
                const av = a[sortCol] ?? '';
                const bv = b[sortCol] ?? '';
                const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [rows, search, sortCol, sortDir]);

    const toggleSort = (col: string) => {
        if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
        else if (sortDir === 'asc') setSortDir('desc');
        else { setSortCol(null); setSortDir(null); }
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortCol !== col) return <ChevronUpIcon className="w-3 h-3 opacity-20" />;
        return sortDir === 'asc' ? <ChevronUpIcon className="w-3 h-3 text-blue-600" /> : <ChevronDownIcon className="w-3 h-3 text-blue-600" />;
    };

    const startEdit = (row: number, col: string, value: string) => {
        setEditingCell({ row, col });
        setEditValue(value);
    };

    const saveEdit = () => {
        if (!editingCell || !layer) return;
        const { row, col } = editingCell;
        const actualIndex = filtered[row].index;
        const newFeatures = [...features];
        newFeatures[actualIndex] = {
            ...newFeatures[actualIndex],
            properties: { ...newFeatures[actualIndex].properties, [col]: editValue }
        };
        onUpdateLayer(layer.id, { ...layer.features, features: newFeatures });
        setEditingCell(null);
    };

    const addColumn = () => {
        const name = prompt('Nombre de la nueva columna:');
        if (!name?.trim() || !layer) return;
        const newFeatures = features.map(f => ({
            ...f,
            properties: { ...f.properties, [name.trim()]: '' }
        }));
        onUpdateLayer(layer.id, { ...layer.features, features: newFeatures });
    };

    const exportCsv = () => {
        if (!layer) return;
        const headers = ['id', 'name', 'color', 'type', 'area', 'perimeter', ...customCols, 'WKT'];
        let csv = headers.join(',') + '\n';
        filtered.forEach(r => {
            const wkt = (() => { try { return stringify(r.feature.geometry); } catch { return ''; } })();
            const customVals = customCols.map(c => `"${(r.feature.properties?.[c] ?? '').toString().replace(/"/g, '""')}"`);
            csv += [r.index, `"${r.name.replace(/"/g, '""')}"`, r.color, r.geomType, r.area.toFixed(2), r.perimeter.toFixed(2), ...customVals, `"${wkt}"`].join(',') + '\n';
        });
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `${layer.name}_tabla.csv`;
        a.click();
    };

    if (!isPro) {
        return (
            <div className="h-48 bg-white border-t border-slate-200 flex flex-col items-center justify-center gap-3 text-center px-6">
                <SparklesIcon className="w-8 h-8 text-indigo-400" />
                <div>
                    <p className="text-sm font-semibold text-slate-800">Attribute Table — Plan Pro</p>
                    <p className="text-xs text-slate-500 mt-1">Visualiza y edita todas las propiedades de tus features en formato spreadsheet.</p>
                </div>
                <button onClick={onUpgradeRequired} className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                    Upgrade a Pro
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-white border-t border-slate-200" style={{ height: '240px' }}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 flex-shrink-0">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {layer?.name ?? 'Sin capa'} — {filtered.length} features
                </span>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="ml-2 text-xs px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex-1" />
                <button onClick={addColumn} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50" title="Agregar columna">
                    <PlusIcon className="w-3.5 h-3.5" /> Columna
                </button>
                <button onClick={exportCsv} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50" title="Exportar CSV">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-700 ml-1">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
                <table className="text-xs w-full border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr>
                            <th className="w-8 px-2 py-1.5 border-b border-slate-200 text-left text-slate-400">#</th>
                            {['name', 'geomType', 'area', 'perimeter', ...customCols].map(col => (
                                <th key={col} className="px-3 py-1.5 border-b border-slate-200 text-left text-slate-600 font-semibold cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => toggleSort(col)}>
                                    <div className="flex items-center gap-1">
                                        {col === 'name' ? 'Nombre' : col === 'geomType' ? 'Tipo' : col === 'area' ? 'Área' : col === 'perimeter' ? 'Perímetro' : col}
                                        <SortIcon col={col} />
                                    </div>
                                </th>
                            ))}
                            <th className="px-3 py-1.5 border-b border-slate-200 text-left text-slate-400 w-6" />
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((row, i) => (
                            <tr
                                key={row.index}
                                className={`border-b border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors ${selectedIndices.has(row.index) ? 'bg-blue-50' : ''}`}
                                onClick={() => { onToggleSelection(row.index, false); onFocusFeature(row.feature); }}
                            >
                                <td className="px-2 py-1 text-slate-400">{row.index + 1}</td>

                                {/* Name — editable */}
                                <td className="px-3 py-1" onClick={e => { e.stopPropagation(); startEdit(i, 'name', row.name); }}>
                                    {editingCell?.row === i && editingCell.col === 'name' ? (
                                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 focus:outline-none" onClick={e => e.stopPropagation()} />
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: row.color }} />
                                            <span className="truncate max-w-[140px]" title={row.name}>{row.name}</span>
                                        </div>
                                    )}
                                </td>

                                <td className="px-3 py-1 text-slate-500">{row.geomType}</td>
                                <td className="px-3 py-1 text-slate-500 tabular-nums">{row.area > 0 ? formatArea(row.area) : '—'}</td>
                                <td className="px-3 py-1 text-slate-500 tabular-nums">{row.perimeter > 0 ? formatLength(row.perimeter) : '—'}</td>

                                {/* Custom columns — editable */}
                                {customCols.map(col => (
                                    <td key={col} className="px-3 py-1" onClick={e => { e.stopPropagation(); startEdit(i, col, row.feature.properties?.[col] ?? ''); }}>
                                        {editingCell?.row === i && editingCell.col === col ? (
                                            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 focus:outline-none" onClick={e => e.stopPropagation()} />
                                        ) : (
                                            <span className="text-slate-600">{row.feature.properties?.[col] ?? ''}</span>
                                        )}
                                    </td>
                                ))}

                                <td className="px-2 py-1" />
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={5 + customCols.length} className="text-center text-slate-400 py-6">Sin features en esta capa</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
