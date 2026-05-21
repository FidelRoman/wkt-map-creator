import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const BASE = 'https://wktmap.com';

interface CodeBlockProps {
    lang: string;
    children: string;
}

function CodeBlock({ lang, children }: CodeBlockProps) {
    return (
        <div className="relative">
            <span className="absolute top-2 right-3 text-[10px] font-mono text-slate-500 uppercase">{lang}</span>
            <pre className="bg-slate-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto font-mono whitespace-pre">{children.trim()}</pre>
        </div>
    );
}

function Endpoint({ method, path, description, children }: { method: string; path: string; description: string; children?: React.ReactNode }) {
    const colors: Record<string, string> = { GET: 'bg-emerald-100 text-emerald-700', POST: 'bg-blue-100 text-blue-700', DELETE: 'bg-red-100 text-red-700' };
    return (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-white">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${colors[method] ?? 'bg-slate-100 text-slate-600'}`}>{method}</span>
                    <code className="text-sm text-slate-800 font-mono break-all">{path}</code>
                </div>
                <p className="text-sm text-slate-500 mt-1">{description}</p>
            </div>
            {children && <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4 bg-slate-50">{children}</div>}
        </div>
    );
}

export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-semibold text-slate-800">API Reference</h1>
                    <span className="ml-auto text-xs text-slate-400">v1 · REST · GeoJSON</span>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

                {/* Intro */}
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">WKT Studio REST API</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Programmatically read and write geographic features from your projects. Available on Pro and Business plans.
                        All responses are <strong>GeoJSON</strong> or JSON. All requests must include an <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">Authorization: Bearer &lt;api-key&gt;</code> header.
                    </p>
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800">
                        Manage your API keys from{' '}
                        <Link href="/settings" className="font-semibold underline">Settings → API Keys</Link>.
                    </div>
                </section>

                {/* Auth */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Authentication</h3>
                    <CodeBlock lang="bash">
{`curl -H "Authorization: Bearer wkt_live_xxxxxxxx" \\
     "${BASE}/api/v1/projects/{projectId}/features"`}
                    </CodeBlock>
                </section>

                {/* Rate limits */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Rate Limits</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                            <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Plan</th>
                                    <th className="px-4 py-2 text-left font-semibold">Calls / month</th>
                                    <th className="px-4 py-2 text-left font-semibold">Max features / call</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                <tr><td className="px-4 py-2">Pro</td><td className="px-4 py-2">1,000</td><td className="px-4 py-2">1,000</td></tr>
                                <tr><td className="px-4 py-2">Business</td><td className="px-4 py-2">10,000</td><td className="px-4 py-2">10,000</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">The <code className="bg-slate-100 px-1 rounded">X-Rate-Limit-Remaining</code> header is included on every GET response.</p>
                </section>

                {/* Endpoints */}
                <section className="space-y-6">
                    <h3 className="text-lg font-semibold text-slate-800">Endpoints</h3>

                    <Endpoint method="GET" path="/api/v1/projects/{projectId}/features" description="Returns all features in a project as a GeoJSON FeatureCollection.">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Query parameters</p>
                            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="px-3 py-1.5 text-left font-semibold">Param</th>
                                        <th className="px-3 py-1.5 text-left font-semibold">Type</th>
                                        <th className="px-3 py-1.5 text-left font-semibold">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100 font-mono">
                                    <tr><td className="px-3 py-1.5">layer</td><td className="px-3 py-1.5">string</td><td className="px-3 py-1.5 font-sans">Filter by layer ID</td></tr>
                                    <tr><td className="px-3 py-1.5">name</td><td className="px-3 py-1.5">string</td><td className="px-3 py-1.5 font-sans">Filter features by name (contains)</td></tr>
                                    <tr><td className="px-3 py-1.5">bbox</td><td className="px-3 py-1.5">string</td><td className="px-3 py-1.5 font-sans">Bounding box: minLng,minLat,maxLng,maxLat</td></tr>
                                    <tr><td className="px-3 py-1.5">limit</td><td className="px-3 py-1.5">number</td><td className="px-3 py-1.5 font-sans">Max results (default 100, max 1000/10000)</td></tr>
                                    <tr><td className="px-3 py-1.5">offset</td><td className="px-3 py-1.5">number</td><td className="px-3 py-1.5 font-sans">Pagination offset (default 0)</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <CodeBlock lang="curl">
{`curl "${BASE}/api/v1/projects/abc123/features?bbox=-77.1,-12.1,-76.9,-11.9&limit=50" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx"`}
                        </CodeBlock>
                        <CodeBlock lang="response">
{`{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[...]] },
      "properties": {
        "name": "Zona 1",
        "color": "#6366f1",
        "_layerId": "layer_1234",
        "_layerName": "Polígonos",
        "_wkt": "POLYGON((-77.03 -12.04, ...))"
      }
    }
  ],
  "meta": { "total": 42, "limit": 50, "offset": 0, "hasMore": false }
}`}
                        </CodeBlock>
                    </Endpoint>

                    <Endpoint method="POST" path="/api/v1/projects/{projectId}/features" description="Add features to an existing layer.">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request body</p>
                            <CodeBlock lang="json">
{`{
  "layerId": "layer_1234",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-77.03, -12.04] },
      "properties": { "name": "Lima Centro", "category": "capital" }
    }
  ]
}`}
                            </CodeBlock>
                        </div>
                        <CodeBlock lang="curl">
{`curl -X POST "${BASE}/api/v1/projects/abc123/features" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx" \\
     -H "Content-Type: application/json" \\
     -d '{"layerId":"layer_1234","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-77.03,-12.04]},"properties":{"name":"Lima Centro"}}]}'`}
                        </CodeBlock>
                        <CodeBlock lang="response">
{`{ "added": 1, "total": 43 }`}
                        </CodeBlock>
                    </Endpoint>

                    <Endpoint method="DELETE" path="/api/v1/projects/{projectId}/features" description="Delete a feature by index from a layer. Only the project owner can delete.">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request body</p>
                            <CodeBlock lang="json">
{`{
  "layerId": "layer_1234",
  "featureIndex": 0
}`}
                            </CodeBlock>
                        </div>
                        <CodeBlock lang="curl">
{`curl -X DELETE "${BASE}/api/v1/projects/abc123/features" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx" \\
     -H "Content-Type: application/json" \\
     -d '{"layerId":"layer_1234","featureIndex":0}'`}
                        </CodeBlock>
                        <CodeBlock lang="response">
{`{ "deleted": true, "remaining": 42 }`}
                        </CodeBlock>
                    </Endpoint>
                </section>

                {/* Errors */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Error codes</h3>
                    <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold">Status</th>
                                <th className="px-4 py-2 text-left font-semibold">Meaning</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {[
                                [401, 'Missing or malformed Authorization header'],
                                [403, 'Invalid API key, wrong plan, or no access to project'],
                                [404, 'Project or layer not found'],
                                [422, 'Feature limit exceeded or invalid featureIndex'],
                                [429, 'Monthly API call limit reached'],
                            ].map(([code, msg]) => (
                                <tr key={code}><td className="px-4 py-2 font-mono text-red-600">{code}</td><td className="px-4 py-2 text-slate-600">{msg}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <div className="text-center pt-4">
                    <p className="text-sm text-slate-500">
                        Need higher limits?{' '}
                        <Link href="/?upgrade=api" className="text-indigo-600 font-medium hover:underline">Upgrade to Business →</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
