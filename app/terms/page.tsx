import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de Servicio',
  description: 'Términos y condiciones de uso de WKT Map Creator.',
};

export default function TermsPage() {
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
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Términos de Servicio</h1>
        <p className="text-slate-400 text-sm mb-10">Última actualización: mayo 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Aceptación de los términos</h2>
            <p>Al acceder o usar WKT Map Creator (&quot;el Servicio&quot;), aceptas quedar vinculado por estos Términos de Servicio. Si no estás de acuerdo con alguna parte de estos términos, no puedes usar el Servicio.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Descripción del servicio</h2>
            <p>WKT Map Creator es una plataforma web de visualización y edición de geometrías geoespaciales en formato WKT (Well-Known Text). El Servicio se ofrece en modalidad freemium con planes de pago opcionales.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Cuentas de usuario</h2>
            <p>Para acceder a funciones que requieren cuenta, debes autenticarte a través de Google. Eres responsable de mantener la confidencialidad de tu cuenta y de todas las actividades que ocurran bajo tu sesión.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Plan gratuito y planes de pago</h2>
            <p>El plan gratuito está sujeto a los límites publicados en la página de precios. Los planes de pago se gestionan a través de Lemon Squeezy y están sujetos a sus propios términos de facturación. Las suscripciones se renuevan automáticamente y puedes cancelar en cualquier momento desde tu portal de cliente.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Política de reembolsos</h2>
            <p>Ofrecemos reembolso completo dentro de los primeros 14 días desde la contratación de cualquier plan de pago, sin preguntas. Pasado ese plazo, no se emiten reembolsos por periodos parciales. Para solicitar un reembolso, contacta a nuestro soporte.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">6. Uso aceptable</h2>
            <p>No puedes usar el Servicio para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Actividades ilegales o que violen derechos de terceros</li>
              <li>Distribuir malware o contenido dañino</li>
              <li>Sobrecargar o atacar la infraestructura del Servicio</li>
              <li>Revender el Servicio sin autorización escrita</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">7. Propiedad intelectual</h2>
            <p>Los datos geoespaciales que subes y creas son de tu propiedad. Al usar el Servicio, nos otorgas una licencia limitada para almacenar y procesar esos datos con el fin de prestarte el Servicio. No reclamamos propiedad sobre tu contenido.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">8. Limitación de responsabilidad</h2>
            <p>El Servicio se proporciona &quot;tal cual&quot;, sin garantías de ningún tipo. En ningún caso seremos responsables por daños indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de usar el Servicio.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">9. Modificaciones</h2>
            <p>Podemos actualizar estos Términos en cualquier momento. Te notificaremos cambios significativos por correo electrónico o mediante un aviso prominente en el Servicio. El uso continuado después de los cambios constituye aceptación.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">10. Contacto</h2>
            <p>Para preguntas sobre estos Términos, contáctanos en: <a href="mailto:soporte@wktmap.com" className="text-indigo-600 hover:underline">soporte@wktmap.com</a></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600">Inicio</Link>
          <Link href="/privacy" className="hover:text-slate-600">Política de Privacidad</Link>
        </div>
      </main>
    </div>
  );
}
