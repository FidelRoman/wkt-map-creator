import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How WKT Studio collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-100 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 w-fit">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          WKT Studio
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: May 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Data We Collect</h2>
            <p>When you use WKT Studio we collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account data:</strong> your name, email address, and profile photo provided by Google when you authenticate.</li>
              <li><strong>Usage data:</strong> projects, layers, and WKT geometries you create and save in the Service.</li>
              <li><strong>Billing data:</strong> managed directly by Paddle. We do not store credit card numbers.</li>
              <li><strong>Technical data:</strong> IP address, browser type, and access logs necessary to operate the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Manage your account and subscription</li>
              <li>Send transactional communications (payment confirmation, renewal notices, etc.)</li>
              <li>Prevent fraud and ensure the security of the Service</li>
            </ul>
            <p className="mt-2">We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Service Providers</h2>
            <p>We share data with the following providers necessary to operate the Service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Google Firebase</strong> — authentication and database (hosted in the US)</li>
              <li><strong>Paddle</strong> — payment processing and subscription management</li>
              <li><strong>Mapbox</strong> — interactive map rendering</li>
            </ul>
            <p className="mt-2">Each provider is subject to their own privacy policies and security commitments.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Cookies and Tracking</h2>
            <p>We use essential cookies for authentication and the operation of the Service. We do not use third-party tracking cookies for advertising purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, unless we are required by law to retain it longer.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your projects at any time (CSV, GeoJSON, KML)</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:support@wktstudio.com" className="text-indigo-600 hover:underline">support@wktstudio.com</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">7. Security</h2>
            <p>We implement reasonable technical and organizational measures to protect your data against unauthorized access, loss, or destruction. However, no system is 100% secure and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">8. International Transfers</h2>
            <p>Your data may be processed on servers located outside your country of residence. By using the Service, you consent to this international transfer of data.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">9. Minors</h2>
            <p>The Service is not directed at children under 13 years of age. We do not knowingly collect data from minors. If we discover that we have collected data from a minor, we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">10. Changes to This Policy</h2>
            <p>We may update this Policy periodically. We will notify you of significant changes by email. The date of the last update is always shown at the top of this document.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">11. Contact</h2>
            <p>For privacy questions: <a href="mailto:support@wktstudio.com" className="text-indigo-600 hover:underline">support@wktstudio.com</a></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600">Home</Link>
          <Link href="/terms" className="hover:text-slate-600">Terms of Service</Link>
        </div>
      </main>
    </div>
  );
}
