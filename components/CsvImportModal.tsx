"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";

export interface CsvImportConfig {
    importType: 'wkt' | 'latlng';
    geoCol?: string;
    nameCol: string | null;
    latCol?: string;
    lngCol?: string;
}

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: CsvImportConfig) => void;
    fileName: string;
    headers: string[];
    previewRows: string[][];
    importType: 'wkt' | 'latlng';
}

function autoDetect(headers: string[], previewRows: string[][], importType: 'wkt' | 'latlng') {
    const lower = headers.map(h => h.toLowerCase().trim());

    const geoCol = (() => {
        // Check by column name
        const byName = lower.findIndex(h =>
            ['wkt', 'geom', 'geometry', 'shape', 'the_geom', 'wkb_geometry'].some(k => h.includes(k))
        );
        if (byName !== -1) return headers[byName];
        // Check by value content
        const byValue = lower.findIndex((_, i) => {
            const val = (previewRows[0]?.[i] ?? '').trim().toUpperCase();
            return val.startsWith('POLYGON') || val.startsWith('POINT') ||
                val.startsWith('LINESTRING') || val.startsWith('MULTI');
        });
        return byValue !== -1 ? headers[byValue] : headers[0] ?? null;
    })();

    const nameCol = (() => {
        const idx = lower.findIndex(h =>
            ['name', 'nombre', 'label', 'title', 'titulo'].includes(h)
        );
        return idx !== -1 ? headers[idx] : null;
    })();

    const latCol = (() => {
        const idx = lower.findIndex(h =>
            ['lat', 'latitude', 'latitud', 'y'].includes(h)
        );
        return idx !== -1 ? headers[idx] : null;
    })();

    const lngCol = (() => {
        const idx = lower.findIndex(h =>
            ['lon', 'lng', 'longitude', 'longitud', 'x'].includes(h)
        );
        return idx !== -1 ? headers[idx] : null;
    })();

    return { geoCol, nameCol, latCol, lngCol };
}

export default function CsvImportModal({
    isOpen, onClose, onConfirm, fileName, headers, previewRows, importType
}: CsvImportModalProps) {
    const detected = autoDetect(headers, previewRows, importType);

    const [geoCol, setGeoCol] = useState<string>(detected.geoCol ?? headers[0] ?? '');
    const [nameCol, setNameCol] = useState<string>(detected.nameCol ?? '');
    const [latCol, setLatCol] = useState<string>(detected.latCol ?? '');
    const [lngCol, setLngCol] = useState<string>(detected.lngCol ?? '');

    // Reset state when modal opens with new data
    useEffect(() => {
        if (isOpen) {
            const d = autoDetect(headers, previewRows, importType);
            setGeoCol(d.geoCol ?? headers[0] ?? '');
            setNameCol(d.nameCol ?? '');
            setLatCol(d.latCol ?? '');
            setLngCol(d.lngCol ?? '');
        }
    }, [isOpen, headers, previewRows, importType]);

    const canImport = importType === 'wkt'
        ? !!geoCol
        : !!latCol && !!lngCol;

    const handleConfirm = () => {
        if (!canImport) return;
        onConfirm({
            importType,
            geoCol: importType === 'wkt' ? geoCol : undefined,
            nameCol: nameCol || null,
            latCol: importType === 'latlng' ? latCol : undefined,
            lngCol: importType === 'latlng' ? lngCol : undefined,
        });
    };

    // Limit preview columns to 5 to avoid overflow
    const displayHeaders = headers.slice(0, 6);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Import CSV — ${fileName}`}
            footer={
                <>
                    <button onClick={onClose} className="btn-outline">Cancel</button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canImport}
                        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Import →
                    </button>
                </>
            }
        >
            <div className="space-y-5">
                {/* Preview table */}
                {previewRows.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Preview</p>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="text-xs w-full">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {displayHeaders.map(h => (
                                            <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-600 whitespace-nowrap max-w-[120px] truncate">
                                                {h}
                                            </th>
                                        ))}
                                        {headers.length > 6 && (
                                            <th className="px-2 py-1.5 text-slate-400 font-normal">+{headers.length - 6} more</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.slice(0, 3).map((row, ri) => (
                                        <tr key={ri} className="border-b border-slate-100 last:border-0">
                                            {displayHeaders.map((_, ci) => {
                                                const val = row[ci] ?? '';
                                                const truncated = val.length > 22 ? val.slice(0, 20) + '…' : val;
                                                return (
                                                    <td key={ci} className="px-2 py-1.5 text-slate-600 font-mono whitespace-nowrap" title={val}>
                                                        {truncated}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Column mapping */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Column mapping</p>

                    {importType === 'wkt' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Geometry column <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={geoCol}
                                    onChange={e => setGeoCol(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    {headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Name column</label>
                                <select
                                    value={nameCol}
                                    onChange={e => setNameCol(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">— None —</option>
                                    {headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {importType === 'latlng' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Latitude column <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={latCol}
                                    onChange={e => setLatCol(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">— Select —</option>
                                    {headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Longitude column <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={lngCol}
                                    onChange={e => setLngCol(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">— Select —</option>
                                    {headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-700 mb-1">Name column</label>
                                <select
                                    value={nameCol}
                                    onChange={e => setNameCol(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">— None —</option>
                                    {headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {!canImport && (
                    <p className="text-xs text-red-500">
                        {importType === 'wkt'
                            ? 'Select a geometry column to continue.'
                            : 'Select both latitude and longitude columns to continue.'}
                    </p>
                )}
            </div>
        </Modal>
    );
}
