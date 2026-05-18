import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Cómo WKT Map Creator recopila, usa y protege tus datos.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-100 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 w-fit">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          WKT Map Creator
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Política de Privacidad</h1>
        <p className="text-slate-400 text-sm mb-10">Última actualización: mayo 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Datos que recopilamos</h2>
            <p>Cuando usas WKT Map Creator recopilamos:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Datos de cuenta:</strong> nombre, dirección de correo electrónico y foto de perfil proporcionados por Google al autenticarte.</li>
              <li><strong>Datos de uso:</strong> proyectos, capas y geometrías WKT que creas y guardas en el Servicio.</li>
              <li><strong>Datos de facturación:</strong> gestionados directamente por Lemon Squeezy. No almacenamos datos de tarjetas de crédito.</li>
              <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y registros de acceso necesarios para operar el Servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Cómo usamos tus datos</h2>
            <p>Usamos tus datos para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Proveer, mantener y mejorar el Servicio</li>
              <li>Gestionar tu cuenta y suscripción</li>
              <li>Enviarte comunicaciones transaccionales (confirmación de pago, renovación, etc.)</li>
              <li>Prevenir fraude y garantizar la seguridad del Servicio</li>
            </ul>
            <p className="mt-2">No vendemos tus datos personales a terceros.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Proveedores de servicios</h2>
            <p>Compartimos datos con los siguientes proveedores necesarios para operar el Servicio:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Google Firebase</strong> — autenticación y base de datos (almacenamiento en EE.UU.)</li>
              <li><strong>Lemon Squeezy</strong> — procesamiento de pagos y gestión de suscripciones</li>
              <li><strong>Mapbox</strong> — renderizado de mapas interactivos</li>
            </ul>
            <p className="mt-2">Cada proveedor está sujeto a sus propias políticas de privacidad y compromisos de seguridad.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Cookies y rastreo</h2>
            <p>Usamos cookies esenciales para la autenticación y el funcionamiento del Servicio. No usamos cookies de rastreo de terceros con fines publicitarios.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Retención de datos</h2>
            <p>Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, borraremos tus datos personales en un plazo de 30 días, salvo que la ley nos obligue a retenerlos por más tiempo.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">6. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Acceder a los datos personales que tenemos sobre ti</li>
              <li>Solicitar la corrección de datos incorrectos</li>
              <li>Solicitar la eliminación de tu cuenta y datos</li>
              <li>Exportar tus proyectos en cualquier momento (CSV, GeoJSON)</li>
            </ul>
            <p className="mt-2">Para ejercer estos derechos, contáctanos en <a href="mailto:soporte@wktmap.com" className="text-indigo-600 hover:underline">soporte@wktmap.com</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">7. Seguridad</h2>
            <p>Implementamos medidas técnicas y organizativas razonables para proteger tus datos contra acceso no autorizado, pérdida o destrucción. Sin embargo, ningún sistema es 100% seguro y no podemos garantizar seguridad absoluta.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">8. Transferencias internacionales</h2>
            <p>Tus datos pueden ser procesados en servidores ubicados fuera de tu país de residencia. Al usar el Servicio, consientes esta transferencia internacional de datos.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">9. Menores de edad</h2>
            <p>El Servicio no está dirigido a menores de 13 años. No recopilamos intencionalmente datos de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">10. Cambios a esta política</h2>
            <p>Podemos actualizar esta Política periódicamente. Te notificaremos cambios significativos por correo. La fecha de la última actualización siempre estará indicada al inicio de este documento.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">11. Contacto</h2>
            <p>Para preguntas sobre privacidad: <a href="mailto:soporte@wktmap.com" className="text-indigo-600 hover:underline">soporte@wktmap.com</a></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600">Inicio</Link>
          <Link href="/terms" className="hover:text-slate-600">Términos de Servicio</Link>
        </div>
      </main>
    </div>
  );
}
