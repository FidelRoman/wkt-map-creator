"use client";
import { useState, useMemo, useCallback, useRef } from 'react';
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
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColName, setNewColName] = useState('');

    const isPro = hasFeature(plan, 'hasVersionHistory'); // proxy for pro/business

    const geomCache = useRef(new WeakMap<any, { area: number; perimeter: number }>());

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
            const geom = f.geometry;
            const geomType = geom?.type ?? 'Unknown';
            let area = 0;
            let perimeter = 0;

            if (geom) {
                let cached = geomCache.current.get(geom);
                if (!cached) {
                    try {
                        if (geomType.includes('Polygon')) {
                            area = turf.area(f);
                            perimeter = turf.length(f, { units: 'meters' });
                        }
                    } catch { /* ignore */ }
                    cached = { area, perimeter };
                    geomCache.current.set(geom, cached);
                } else {
                    area = cached.area;
                    perimeter = cached.perimeter;
                }
            }

            return { index: i, name: f.properties?.name ?? `Feature ${i + 1}`, color: f.properties?.color ?? '#888', geomType, area, perimeter, feature: f };
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
        return sortDir === 'asc' ? <ChevronUpIcon className="w-3 h-3 text-indigo-600" /> : <ChevronDownIcon className="w-3 h-3 text-indigo-600" />;
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

    const confirmAddColumn = () => {
        if (!newColName.trim() || !layer) { setAddingColumn(false); setNewColName(''); return; }
        const name = newColName.trim();
        const newFeatures = features.map(f => ({
            ...f,
            properties: { ...f.properties, [name]: '' }
        }));
        onUpdateLayer(layer.id, { ...layer.features, features: newFeatures });
        setAddingColumn(false);
        setNewColName('');
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
            <div className="h-48 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 text-center px-6">
                <SparklesIcon className="w-8 h-8 text-indigo-400" />
                <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Attribute Table — Pro Plan</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">View and edit all feature properties in spreadsheet format.</p>
                </div>
                <button onClick={onUpgradeRequired} className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                    Upgrade a Pro
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700" style={{ height: '240px' }}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {layer?.name ?? 'No layer'} — {filtered.length} features
                </span>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="ml-2 text-xs px-2 py-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <div className="flex-1" />
                {addingColumn ? (
                    <input
                        autoFocus
                        value={newColName}
                        onChange={e => setNewColName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmAddColumn(); if (e.key === 'Escape') { setAddingColumn(false); setNewColName(''); } }}
                        onBlur={confirmAddColumn}
                        placeholder="Column name"
                        className="text-xs px-2 py-1 border border-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 w-36"
                    />
                ) : (
                    <button onClick={() => setAddingColumn(true)} className="text-xs flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700" title="Add column">
                        <PlusIcon className="w-3.5 h-3.5" /> Column
                    </button>
                )}
                <button onClick={exportCsv} className="text-xs flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700" title="Export CSV">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-700 ml-1">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
                <table className="text-xs w-full border-collapse">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                        <tr>
                            <th className="w-8 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 text-left text-slate-400 dark:text-slate-500">#</th>
                            {['name', 'geomType', 'area', 'perimeter', ...customCols].map(col => (
                                <th key={col} className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 text-left text-slate-600 dark:text-slate-300 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => toggleSort(col)}>
                                    <div className="flex items-center gap-1">
                                        {col === 'name' ? 'Name' : col === 'geomType' ? 'Type' : col === 'area' ? 'Area' : col === 'perimeter' ? 'Perimeter' : col}
                                        <SortIcon col={col} />
                                    </div>
                                </th>
                            ))}
                            <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 text-left text-slate-400 w-6" />
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((row, i) => (
                            <tr
                                key={row.index}
                                className={`border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${selectedIndices.has(row.index) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                onClick={() => { onToggleSelection(row.index, false); onFocusFeature(row.feature); }}
                            >
                                <td className="px-2 py-1 text-slate-400 dark:text-slate-500">{row.index + 1}</td>

                                {/* Name — editable */}
                                <td className="px-3 py-1" onClick={e => { e.stopPropagation(); startEdit(i, 'name', row.name); }}>
                                    {editingCell?.row === i && editingCell.col === 'name' ? (
                                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="w-full text-xs border border-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 focus:outline-none" onClick={e => e.stopPropagation()} />
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: row.color }} />
                                            <span className="truncate max-w-[140px]" title={row.name}>{row.name}</span>
                                        </div>
                                    )}
                                </td>

                                <td className="px-3 py-1 text-slate-500 dark:text-slate-400">{row.geomType}</td>
                                <td className="px-3 py-1 text-slate-500 dark:text-slate-400 tabular-nums">{row.area > 0 ? formatArea(row.area) : '—'}</td>
                                <td className="px-3 py-1 text-slate-500 dark:text-slate-400 tabular-nums">{row.perimeter > 0 ? formatLength(row.perimeter) : '—'}</td>

                                {/* Custom columns — editable */}
                                {customCols.map(col => (
                                    <td key={col} className="px-3 py-1" onClick={e => { e.stopPropagation(); startEdit(i, col, row.feature.properties?.[col] ?? ''); }}>
                                        {editingCell?.row === i && editingCell.col === col ? (
                                            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="w-full text-xs border border-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 focus:outline-none" onClick={e => e.stopPropagation()} />
                                        ) : (
                                            <span className="text-slate-600 dark:text-slate-300">{row.feature.properties?.[col] ?? ''}</span>
                                        )}
                                    </td>
                                ))}

                                <td className="px-2 py-1" />
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={5 + customCols.length} className="text-center text-slate-400 dark:text-slate-500 py-6">No features in this layer</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
