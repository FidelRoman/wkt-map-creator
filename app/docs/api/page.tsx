"use client";

import Link from 'next/link';
import { ArrowLeftIcon, CommandLineIcon, KeyIcon, CodeBracketSquareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-semibold text-slate-800">API Documentation</h1>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-6 py-10 space-y-12">
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                            <CommandLineIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold">Introduction</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                        The WKT Studio REST API lets you extract geographic data from your projects in real time.
                        The API responds in standard <strong>GeoJSON</strong> format and injects a
                        <strong> WKT (Well-Known Text)</strong> string into each feature&apos;s properties for
                        compatibility with spatial databases like PostGIS, BigQuery, or your own frontend.
                    </p>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                            <KeyIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">1. Authentication</h2>
                    </div>

                    <h3 className="text-base font-semibold text-slate-700 mb-2">Step 1 — Get your API key</h3>
                    <p className="text-slate-600 leading-relaxed mb-3">
                        API keys are managed exclusively from your account&apos;s{' '}
                        <Link href="/settings" className="text-indigo-600 hover:underline">Settings page</Link>.
                        There is no programmatic endpoint to create or revoke keys — you must use the UI.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 text-sm mb-6 ml-1">
                        <li>Log in and open <Link href="/settings" className="text-indigo-600 hover:underline">Settings → API Keys</Link>.</li>
                        <li>Click <strong>Generate new key</strong>.</li>
                        <li>Copy the key immediately — it is only shown once.</li>
                        <li>Store it securely (environment variable, secrets manager, etc.).</li>
                    </ol>

                    <h3 className="text-base font-semibold text-slate-700 mb-2">Step 2 — Send the key in every request</h3>
                    <p className="text-slate-600 leading-relaxed mb-3">
                        Pass the key as a <code className="bg-slate-100 px-1 rounded">Bearer</code> token in the{' '}
                        <code className="bg-slate-100 px-1 rounded">Authorization</code> header:
                    </p>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto mb-6">
                        <pre className="text-sm font-mono text-slate-300">
<span className="text-pink-400">Authorization</span>: Bearer wk_1234567890abcdef1234567890abcdef
                        </pre>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-700 space-y-1">
                            <p className="font-semibold">Common errors</p>
                            <p><code className="bg-red-100 px-1 rounded">401 Unauthorized</code> — missing or invalid API key.</p>
                            <p><code className="bg-red-100 px-1 rounded">403 Forbidden</code> — key is valid but does not have access to this project.</p>
                            <p><code className="bg-red-100 px-1 rounded">429 Too Many Requests</code> — monthly API call limit reached. Resets on your next billing date.</p>
                        </div>
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <CodeBracketSquareIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">2. Get features from a project</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-4">
                        Make a <code>GET</code> request to the following endpoint using your project ID.
                    </p>

                    <div className="mb-6 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-200 border-b border-slate-300 flex items-center gap-2">
                            <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
                            <code className="text-sm font-mono text-slate-700">/api/v1/projects/{"{projectId}"}/features</code>
                        </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-3">Query parameters</h3>
                    <div className="overflow-hidden border border-slate-200 rounded-xl mb-6">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Parameter</th>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">layer</td>
                                    <td className="px-4 py-3 text-slate-600">Filter by layer ID.</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">name</td>
                                    <td className="px-4 py-3 text-slate-600">Filter by feature name (case-insensitive substring match).</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">bbox</td>
                                    <td className="px-4 py-3 text-slate-600">Geographic bounding box filter. Format: <code>minLng,minLat,maxLng,maxLat</code></td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">limit</td>
                                    <td className="px-4 py-3 text-slate-600">Max results per page (pagination). Default: 100.</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">offset</td>
                                    <td className="px-4 py-3 text-slate-600">Number of results to skip (pagination). Default: 0.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="text-lg font-semibold mb-3">Node.js example (fetch)</h3>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto mb-6 text-sm font-mono text-slate-300">
<pre>
<span className="text-blue-400">const</span> response = <span className="text-blue-400">await</span> <span className="text-yellow-200">fetch</span>(<span className="text-green-300">&apos;https://wktstudio.com/api/v1/projects/my_project_123/features?limit=50&apos;</span>, {'{'}
    <span className="text-blue-300">headers</span>: {'{'}
        <span className="text-green-300">&apos;Authorization&apos;</span>: <span className="text-green-300">&apos;Bearer wk_yourApiKeyHere...&apos;</span>
    {'}'}
{'}'});

<span className="text-blue-400">const</span> data = <span className="text-blue-400">await</span> response.<span className="text-yellow-200">json</span>();
<span className="text-blue-200">console</span>.<span className="text-yellow-200">log</span>(data.<span className="text-blue-300">features</span>);
</pre>
                    </div>

                    <h3 className="text-lg font-semibold mb-3">Example response</h3>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm font-mono text-slate-300">
<pre>
{`{
  "type": "FeatureCollection",
  "meta": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true,
    "projectId": "my_project_123",
    "projectName": "My Logistics Project"
  },
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-77.03, -12.04], [-77.02, -12.05], [-77.01, -12.04], [-77.03, -12.04]]]
      },
      "properties": {
        "name": "Delivery Zone A",
        "color": "#6366f1",
        "_layerId": "layer_12345",
        "_layerName": "Layer 1",
        "_wkt": "POLYGON ((-77.03 -12.04, -77.02 -12.05, -77.01 -12.04, -77.03 -12.04))"
      }
    }
  ]
}`}
</pre>
                    </div>
                </section>

                <div className="py-8 text-center text-slate-500 text-sm border-t border-slate-200 mt-12">
                    Questions about the integration? Contact us at <a href="mailto:support@wktstudio.com" className="text-indigo-600 hover:underline">support@wktstudio.com</a>
                </div>
            </main>
        </div>
    );
}
