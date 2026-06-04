import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export const metadata: Metadata = {
  title: 'REST API Documentation — Spatial Data API',
  description: 'WKT Studio REST API: read and write GeoJSON features and layers via HTTP. Authenticate with an API key. Free plan includes 10 requests/month; Pro includes 1,000.',
  openGraph: {
    title: 'WKT Studio REST API Documentation',
    description: 'Integrate spatial data into your app with the WKT Studio REST API. GeoJSON, layers, and features endpoints.',
  },
};

const BASE = 'https://wktstudio.com';

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
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-semibold text-slate-800">API Reference</h1>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-slate-400 hidden sm:inline">v1 · REST · GeoJSON</span>
                        <a
                            href="/openapi.json"
                            download="wktstudio-openapi.json"
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-colors bg-white hover:bg-indigo-50"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            OpenAPI
                        </a>
                        <a
                            href={`https://www.postman.com/run-collection?url=${encodeURIComponent('https://wktstudio.com/openapi.json')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#FF6C37] hover:bg-[#e55a26] px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.48 17.28l-3.72-3.72 5.52-5.52-1.8 9.24zm-1.44-9.84l-5.52 5.52 3.72 3.72-9.24 1.8 1.8-9.24 5.52-5.52 3.72 3.72z"/></svg>
                            Run in Postman
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

                {/* Intro */}
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">WKT Studio REST API</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Programmatically read and write geographic features from your projects. Available on the Pro plan.
                        All responses are <strong>GeoJSON</strong> or JSON. All requests must include an <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">Authorization: Bearer &lt;api-key&gt;</code> header.
                    </p>
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800">
                        Manage your API keys from{' '}
                        <Link href="/settings" className="font-semibold underline">Settings → API Keys</Link>.
                    </div>
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
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">The <code className="bg-slate-100 px-1 rounded">X-Rate-Limit-Remaining</code> header is included on every response. Counter resets on your billing date each month.</p>
                </section>

                {/* Endpoints */}
                <section className="space-y-8">
                    <h3 className="text-lg font-semibold text-slate-800">Endpoints</h3>

                    {/* Projects */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Projects</h4>
                        <div className="space-y-6">

                            <Endpoint method="POST" path="/api/v1/projects" description="Create a new project. Returns the project ID immediately — use it with the layers and features endpoints.">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request body</p>
                                    <CodeBlock lang="json">
{`{
  "name": "My project",
  "isPublic": false
}`}
                                    </CodeBlock>
                                    <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden mt-3">
                                        <thead className="bg-slate-100 text-slate-600">
                                            <tr>
                                                <th className="px-3 py-1.5 text-left font-semibold">Field</th>
                                                <th className="px-3 py-1.5 text-left font-semibold">Type</th>
                                                <th className="px-3 py-1.5 text-left font-semibold">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100 font-mono">
                                            <tr><td className="px-3 py-1.5">name</td><td className="px-3 py-1.5">string</td><td className="px-3 py-1.5 font-sans">Required. Project display name.</td></tr>
                                            <tr><td className="px-3 py-1.5">isPublic</td><td className="px-3 py-1.5">boolean</td><td className="px-3 py-1.5 font-sans">Optional. Default <code className="bg-slate-100 px-1 rounded">false</code>. If true, the project is visible on your public profile.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <CodeBlock lang="curl">
{`curl -X POST "${BASE}/api/v1/projects" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx" \\
     -H "Content-Type: application/json" \\
     -d '{"name":"Lima boundaries","isPublic":false}'`}
                                </CodeBlock>
                                <CodeBlock lang="response">
{`{
  "id": "vDiwpjtwJ4Ci4LspDjFF",
  "name": "Lima boundaries",
  "ownerId": "uid_1234",
  "isPublic": false,
  "createdAt": "2026-06-03T22:00:00.000Z"
}`}
                                </CodeBlock>
                                <p className="text-xs text-slate-400">The new project comes with one empty default layer. Use <code className="bg-slate-100 px-1 rounded">POST /api/v1/projects/{'{id}'}/layers</code> to add more layers or populate them with features.</p>
                            </Endpoint>

                        </div>
                    </div>

                    {/* Layers */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Layers</h4>
                        <div className="space-y-6">

                            <Endpoint method="GET" path="/api/v1/projects/{projectId}/layers" description="List all layers in the project (metadata only, no features).">
                                <CodeBlock lang="curl">
{`curl "${BASE}/api/v1/projects/abc123/layers" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx"`}
                                </CodeBlock>
                                <CodeBlock lang="response">
{`{
  "layers": [
    {
      "id": "layer_1748000000000",
      "name": "Lima polygons",
      "visible": true
    }
  ]
}`}
                                </CodeBlock>
                            </Endpoint>

                            <Endpoint method="POST" path="/api/v1/projects/{projectId}/layers" description="Create a new layer in a project. Optionally include features to populate the features subcollection immediately.">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request body</p>
                                    <CodeBlock lang="json">
{`{
  "name": "My layer",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[...]] },
      "properties": { 
        "name": "Zone A",
        "color": "#6366f1"
      }
    }
  ]
}`}
                                    </CodeBlock>
                                    <p className="text-xs text-slate-400 mt-2"><code className="bg-slate-100 px-1 rounded">features</code> is optional — omit it to create an empty layer.</p>
                                </div>
                                <CodeBlock lang="curl">
{`curl -X POST "${BASE}/api/v1/projects/abc123/layers" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx" \\
     -H "Content-Type: application/json" \\
     -d '{
       "name": "Lima polygons",
       "features": [
         {
           "type": "Feature",
           "geometry": {
             "type": "Polygon",
             "coordinates": [[[-77.0428,-12.0464],[-77.0328,-12.0464],[-77.0328,-12.0364],[-77.0428,-12.0364],[-77.0428,-12.0464]]]
           },
           "properties": { 
             "name": "Plaza Mayor",
             "color": "#ff5733"
           }
         }
       ]
     }'`}
                                </CodeBlock>
                                <CodeBlock lang="response">
{`{ "layerId": "layer_1748000000000", "name": "Lima polygons", "featuresAdded": 1 }`}
                                </CodeBlock>
                            </Endpoint>

                        </div>
                    </div>

                    {/* Features */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Features</h4>
                        <div className="space-y-6">

                            <Endpoint method="GET" path="/api/v1/projects/{projectId}/features" description="Returns all features in a project as a GeoJSON FeatureCollection with query filters.">
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
                                            <tr><td className="px-3 py-1.5">limit</td><td className="px-3 py-1.5">number</td><td className="px-3 py-1.5 font-sans">Max results (default 100, max 1,000)</td></tr>
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
      "id": "fid_1234567890abcdef",
      "geometry": { "type": "Polygon", "coordinates": [[...]] },
      "properties": {
        "name": "Zona 1",
        "_layerId": "layer_1234",
        "_layerName": "Lima polygons",
        "_wkt": "POLYGON((-77.03 -12.04, ...))"
      }
    }
  ],
  "meta": { "total": 42, "limit": 50, "offset": 0, "hasMore": false, "projectId": "abc123", "projectName": "My Project" }
}`}
                                </CodeBlock>
                            </Endpoint>

                            <Endpoint method="POST" path="/api/v1/projects/{projectId}/features" description="Append features to an existing layer. Does not replace existing features.">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request body</p>
                                    <CodeBlock lang="json">
{`{
  "layerId": "layer_1234",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-77.03, -12.04] },
      "properties": { 
        "name": "Lima Centro",
        "color": "#ff5733"
      }
    }
  ]
}`}
                                    </CodeBlock>
                                </div>
                                <CodeBlock lang="curl">
{`curl -X POST "${BASE}/api/v1/projects/abc123/features" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx" \\
     -H "Content-Type: application/json" \\
     -d '{"layerId":"layer_1234","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-77.03,-12.04]},"properties":{"name":"Lima Centro","color":"#ff5733"}}]}'`}
                                </CodeBlock>
                                <CodeBlock lang="response">
{`{ "added": 1, "total": 43, "featureIds": ["fid_1234567890abcdef"] }`}
                                </CodeBlock>
                            </Endpoint>

                            <Endpoint method="DELETE" path="/api/v1/projects/{projectId}/features" description="Delete a single feature by featureId (recommended) or index (deprecated).">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request body</p>
                                    <CodeBlock lang="json">
{`{
  "layerId": "layer_1234",
  "featureId": "fid_1234567890abcdef",
  "featureIndex": 0
}`}
                                    </CodeBlock>
                                    <p className="text-xs text-slate-400 mt-2"><code className="bg-slate-100 px-1 rounded">featureId</code> is the recommended identifier. If using <code className="bg-slate-100 px-1 rounded">featureIndex</code>, it is zero-based and deprecated.</p>
                                </div>
                                <CodeBlock lang="curl">
{`curl -X DELETE "${BASE}/api/v1/projects/abc123/features" \\
     -H "Authorization: Bearer wkt_live_xxxxxxxx" \\
     -H "Content-Type: application/json" \\
     -d '{"layerId":"layer_1234","featureId":"fid_1234567890abcdef"}'`}
                                </CodeBlock>
                                <CodeBlock lang="response">
{`{ "deleted": true, "featureId": "fid_1234567890abcdef" }`}
                                </CodeBlock>
                            </Endpoint>

                        </div>
                    </div>
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
                        <Link href="/?upgrade=api" className="text-indigo-600 font-medium hover:underline">Upgrade to Pro →</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
