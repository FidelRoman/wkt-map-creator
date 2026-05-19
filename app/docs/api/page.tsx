"use client";

import Link from 'next/link';
import { ArrowLeftIcon, CommandLineIcon, KeyIcon, CodeBracketSquareIcon } from '@heroicons/react/24/outline';

export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <h1 className="text-base font-semibold text-slate-800">Documentación de la API</h1>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-6 py-10 space-y-12">
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                            <CommandLineIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold">Introducción</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                        La API REST de WKT Map Creator te permite extraer los datos geográficos de tus proyectos en tiempo real. 
                        Nuestra API responde utilizando el formato estándar <strong>GeoJSON</strong>, y adicionalmente inyecta el formato 
                        <strong> WKT (Well-Known Text)</strong> dentro de las propiedades de cada objeto para que sea compatible con cualquier base de datos espacial como PostGIS, BigQuery o tu propio frontend.
                    </p>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                            <KeyIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">1. Autenticación</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-4">
                        Todas las peticiones a la API deben estar autenticadas mediante un Bearer Token utilizando tu <strong>API Key</strong>.
                        Puedes generar tus llaves en la página de Configuración de tu cuenta.
                    </p>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                        <pre className="text-sm font-mono text-slate-300">
<span className="text-pink-400">Authorization</span>: Bearer wk_1234567890abcdef1234567890abcdef
                        </pre>
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <CodeBracketSquareIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">2. Obtener objetos de un proyecto</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-4">
                        Para obtener los datos, realiza una petición <code>GET</code> a la siguiente ruta utilizando el ID de tu proyecto.
                    </p>
                    
                    <div className="mb-6 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-200 border-b border-slate-300 flex items-center gap-2">
                            <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
                            <code className="text-sm font-mono text-slate-700">/api/v1/projects/{"{projectId}"}/features</code>
                        </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-3">Parámetros (Query)</h3>
                    <div className="overflow-hidden border border-slate-200 rounded-xl mb-6">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Parámetro</th>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Descripción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">layer</td>
                                    <td className="px-4 py-3 text-slate-600">ID de la capa a filtrar.</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">name</td>
                                    <td className="px-4 py-3 text-slate-600">Filtro de búsqueda por nombre del objeto (case-insensitive).</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">bbox</td>
                                    <td className="px-4 py-3 text-slate-600">Filtro geográfico. Formato: <code>minLng,minLat,maxLng,maxLat</code></td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">limit</td>
                                    <td className="px-4 py-3 text-slate-600">Límite de resultados (Paginación). Default: 100.</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 font-mono text-indigo-600">offset</td>
                                    <td className="px-4 py-3 text-slate-600">Resultados a omitir (Paginación). Default: 0.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="text-lg font-semibold mb-3">Ejemplo en Node.js (fetch)</h3>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto mb-6 text-sm font-mono text-slate-300">
<pre>
<span className="text-blue-400">const</span> response = <span className="text-blue-400">await</span> <span className="text-yellow-200">fetch</span>(<span className="text-green-300">'https://wktmap.com/api/v1/projects/my_project_123/features?limit=50'</span>, {'{'}
    <span className="text-blue-300">headers</span>: {'{'}
        <span className="text-green-300">'Authorization'</span>: <span className="text-green-300">'Bearer wk_tuaPiKeyAqi...'</span>
    {'}'}
{'}'});

<span className="text-blue-400">const</span> data = <span className="text-blue-400">await</span> response.<span className="text-yellow-200">json</span>();
<span className="text-blue-200">console</span>.<span className="text-yellow-200">log</span>(data.<span className="text-blue-300">features</span>);
</pre>
                    </div>

                    <h3 className="text-lg font-semibold mb-3">Ejemplo de Respuesta</h3>
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
    "projectName": "Mi Proyecto de Logística"
  },
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-77.03, -12.04], [-77.02, -12.05], [-77.01, -12.04], [-77.03, -12.04]]]
      },
      "properties": {
        "name": "Zona de Reparto A",
        "color": "#6366f1",
        "_layerId": "layer_12345",
        "_layerName": "Capa 1",
        "_wkt": "POLYGON ((-77.03 -12.04, -77.02 -12.05, -77.01 -12.04, -77.03 -12.04))"
      }
    }
  ]
}`}
</pre>
                    </div>
                </section>
                
                <div className="py-8 text-center text-slate-500 text-sm border-t border-slate-200 mt-12">
                    Si tienes dudas sobre la integración, contáctanos a soporte@wktmap.com
                </div>
            </main>
        </div>
    );
}
