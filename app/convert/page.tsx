"use client";

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, ClipboardDocumentIcon, CheckIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

type TabId = 'wkt-geojson' | 'geojson-wkt' | 'wkt-wkb' | 'wkb-wkt' | 'batch';

const TABS: { id: TabId; label: string; inputPlaceholder: string; outputLabel: string }[] = [
    { id: 'wkt-geojson', label: 'WKT → GeoJSON', inputPlaceholder: 'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))', outputLabel: 'GeoJSON' },
    { id: 'geojson-wkt', label: 'GeoJSON → WKT', inputPlaceholder: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}', outputLabel: 'WKT' },
    { id: 'wkt-wkb', label: 'WKT → WKB', inputPlaceholder: 'POINT(1 2)', outputLabel: 'WKB hex' },
    { id: 'wkb-wkt', label: 'WKB → WKT', inputPlaceholder: '0101000000000000000000F03F0000000000000040', outputLabel: 'WKT' },
    { id: 'batch', label: 'Batch WKT', inputPlaceholder: 'POINT(1 2)\nLINESTRING(0 0, 1 1)\nPOLYGON((0 0,1 0,1 1,0 0))', outputLabel: 'GeoJSON array' },
];

function convertWktToGeojson(input: string): { result?: string; error?: string } {
    try {
        const { parse } = require('wellknown');
        const geom = parse(input.trim());
        if (!geom) return { error: 'WKT inválido o no soportado' };
        return { result: JSON.stringify(geom, null, 2) };
    } catch (e: any) {
        return { error: e.message ?? 'Error de conversión' };
    }
}

function convertGeojsonToWkt(input: string): { result?: string; error?: string } {
    try {
        const { stringify } = require('wellknown');
        const parsed = JSON.parse(input.trim());
        const geom = parsed.type === 'Feature' ? parsed.geometry : parsed;
        const wkt = stringify(geom);
        if (!wkt) return { error: 'No se pudo convertir a WKT' };
        return { result: wkt };
    } catch (e: any) {
        return { error: e.message ?? 'JSON inválido' };
    }
}

function convertWktToWkb(input: string): { result?: string; error?: string } {
    try {
        // Dynamic require to avoid SSR issues
        const wkx = require('wkx');
        const geom = wkx.Geometry.parse(input.trim());
        const buf = geom.toWkb();
        return { result: buf.toString('hex').toUpperCase() };
    } catch (e: any) {
        return { error: e.message ?? 'WKT inválido' };
    }
}

function convertWkbToWkt(input: string): { result?: string; error?: string } {
    try {
        const wkx = require('wkx');
        const buf = Buffer.from(input.trim().replace(/\s/g, ''), 'hex');
        const geom = wkx.Geometry.parse(buf);
        const wkt = geom.toWkt();
        return { result: wkt };
    } catch (e: any) {
        return { error: e.message ?? 'WKB hex inválido' };
    }
}

function convertBatch(input: string): { result?: string; error?: string } {
    try {
        const { parse } = require('wellknown');
        const lines = input.trim().split('\n').filter(l => l.trim());
        const features = lines.map((line, i) => {
            try {
                const geom = parse(line.trim());
                return { type: 'Feature', geometry: geom, properties: { index: i } };
            } catch {
                return null;
            }
        }).filter(Boolean);

        if (features.length === 0) return { error: 'No se encontraron WKTs válidos' };

        return { result: JSON.stringify({ type: 'FeatureCollection', features }, null, 2) };
    } catch (e: any) {
        return { error: e.message ?? 'Error de conversión' };
    }
}

function convert(tab: TabId, input: string): { result?: string; error?: string } {
    if (!input.trim()) return {};
    switch (tab) {
        case 'wkt-geojson': return convertWktToGeojson(input);
        case 'geojson-wkt': return convertGeojsonToWkt(input);
        case 'wkt-wkb': return convertWktToWkb(input);
        case 'wkb-wkt': return convertWkbToWkt(input);
        case 'batch': return convertBatch(input);
    }
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
            {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
        </button>
    );
}

export default function ConvertPage() {
    const [activeTab, setActiveTab] = useState<TabId>('wkt-geojson');
    const [input, setInput] = useState('');

    const tab = TABS.find(t => t.id === activeTab)!;
    const { result, error } = convert(activeTab, input);

    const handleTabChange = (id: TabId) => {
        setActiveTab(id);
        setInput('');
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <ArrowsRightLeftIcon className="w-5 h-5 text-indigo-600" />
                        <h1 className="text-base font-semibold text-slate-800">Conversor de Geometrías</h1>
                    </div>
                    <span className="ml-auto text-xs text-slate-400">100% cliente — sin enviar datos al servidor</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* SEO heading */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">WKT to GeoJSON Converter — Free Online Tool</h2>
                    <p className="text-slate-500 mt-1 text-sm">
                        Convert WKT (Well-Known Text) to GeoJSON, WKB hex, and back. Supports POLYGON, POINT, LINESTRING, MULTIPOLYGON and all OGC geometry types from PostGIS, Shapely, GDAL.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 flex-wrap">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => handleTabChange(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Editor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Input */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Entrada</span>
                            {input && <CopyButton text={input} />}
                        </div>
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={tab.inputPlaceholder}
                            spellCheck={false}
                            className="w-full h-72 px-4 py-3 text-sm font-mono text-slate-800 resize-none focus:outline-none placeholder:text-slate-300"
                        />
                    </div>

                    {/* Output */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{tab.outputLabel}</span>
                            {result && <CopyButton text={result} />}
                        </div>
                        {error ? (
                            <div className="px-4 py-3">
                                <p className="text-sm text-red-600 font-medium">Error</p>
                                <p className="text-xs text-red-500 mt-1 font-mono">{error}</p>
                            </div>
                        ) : (
                            <textarea
                                value={result ?? ''}
                                readOnly
                                placeholder={input ? 'Procesando...' : 'El resultado aparecerá aquí'}
                                spellCheck={false}
                                className="w-full h-72 px-4 py-3 text-sm font-mono text-slate-800 resize-none focus:outline-none bg-slate-50 placeholder:text-slate-300"
                            />
                        )}
                    </div>
                </div>

                {/* Quick reference */}
                <section className="mt-10 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Ejemplos de WKT</h3>
                    </div>
                    <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                        {[
                            ['POINT', 'POINT(13.4050 52.5200)'],
                            ['LINESTRING', 'LINESTRING(0 0, 1 1, 2 0)'],
                            ['POLYGON', 'POLYGON((-77.04 -12.04, -77.02 -12.06, -77.00 -12.04, -77.04 -12.04))'],
                            ['MULTIPOINT', 'MULTIPOINT((0 0), (1 1), (2 2))'],
                            ['MULTILINESTRING', 'MULTILINESTRING((0 0, 1 1),(2 2, 3 3))'],
                            ['MULTIPOLYGON', 'MULTIPOLYGON(((0 0,1 0,1 1,0 0)),((2 2,3 2,3 3,2 2)))'],
                        ].map(([type, wkt]) => (
                            <div key={type} className="group">
                                <p className="text-[10px] text-slate-400 font-sans font-semibold uppercase mb-1">{type}</p>
                                <button
                                    onClick={() => { setActiveTab('wkt-geojson'); setInput(wkt); }}
                                    className="text-left text-slate-600 hover:text-indigo-600 transition-colors break-all"
                                >
                                    {wkt}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* FAQ for SEO */}
                <section className="mt-6 space-y-3">
                    {[
                        { q: 'What is WKT (Well-Known Text)?', a: 'WKT is a text markup language for representing vector geometry objects. It is used in PostGIS (PostgreSQL), Shapely (Python), GDAL, and most GIS tools. Examples: POINT(lng lat), POLYGON((x1 y1, x2 y2, ...)).' },
                        { q: 'What is the difference between WKT and GeoJSON?', a: 'WKT is a compact text format common in databases (PostGIS). GeoJSON is a JSON-based format used in web mapping (Leaflet, Mapbox, D3). Both represent the same geometries — this tool converts between them instantly.' },
                        { q: 'What is WKB (Well-Known Binary)?', a: 'WKB is the binary equivalent of WKT, typically stored as a hex string. PostGIS returns WKB by default (e.g., 0101000000...). Use ST_AsText() to get WKT, or paste the hex here to convert.' },
                        { q: 'How to convert PostGIS geometry to GeoJSON?', a: 'Run: SELECT ST_AsText(geom) FROM your_table. Paste the result here and select "WKT → GeoJSON". Or use ST_AsGeoJSON(geom) directly in PostgreSQL.' },
                    ].map(({ q, a }) => (
                        <details key={q} className="bg-white border border-slate-200 rounded-xl">
                            <summary className="px-5 py-4 text-sm font-medium text-slate-800 cursor-pointer list-none flex items-center justify-between">
                                {q}
                                <span className="text-slate-400 text-lg leading-none">+</span>
                            </summary>
                            <p className="px-5 pb-4 text-sm text-slate-500">{a}</p>
                        </details>
                    ))}
                </section>

                <div className="mt-8 text-center">
                    <p className="text-sm text-slate-500">
                        ¿Quieres visualizar tus geometrías en un mapa?{' '}
                        <Link href="/" className="text-indigo-600 font-medium hover:underline">
                            Try WKT Studio →
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
