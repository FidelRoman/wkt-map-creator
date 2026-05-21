import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using WKT Studio.',
};

export default function TermsPage() {
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
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: May 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using WKT Studio (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Description of Service</h2>
            <p>WKT Studio is a web-based GIS map editor and spatial data platform for developers. It allows users to paste, import, visualize, edit, and export geospatial data in WKT, GeoJSON, Shapefile, CSV, KML, and PostGIS SQL formats. The Service is offered on a freemium basis with optional paid plans.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. User Accounts</h2>
            <p>To access features that require an account, you must authenticate via Google. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your session. You must notify us immediately of any unauthorized use of your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Free Plan and Paid Plans</h2>
            <p>The free plan is subject to the limits published on the pricing page. Paid plans are processed through Lemon Squeezy and are subject to their billing terms. Subscriptions renew automatically and you may cancel at any time from your customer portal. Prices are listed in USD and may change with 30 days&apos; notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Refund Policy</h2>
            <p>We offer a full refund within the first 14 days of purchasing any paid plan, no questions asked. After that period, refunds are not issued for partial billing periods. To request a refund, contact our support team.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">6. Acceptable Use</h2>
            <p>You may not use the Service to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Engage in illegal activities or violate third-party rights</li>
              <li>Distribute malware or harmful content</li>
              <li>Overload, attack, or disrupt the Service infrastructure</li>
              <li>Resell the Service without written authorization</li>
              <li>Attempt to reverse-engineer or extract source code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">7. Intellectual Property</h2>
            <p>The geospatial data you upload and create remains your property. By using the Service, you grant us a limited license to store and process that data solely for the purpose of providing the Service to you. We make no claim of ownership over your content.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">8. Limitation of Liability</h2>
            <p>The Service is provided &quot;as is&quot; without warranties of any kind. In no event shall WKT Studio be liable for indirect, incidental, special, or consequential damages arising from the use of or inability to use the Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">9. Modifications</h2>
            <p>We may update these Terms at any time. We will notify you of significant changes by email or via a prominent notice in the Service. Continued use after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">10. Contact</h2>
            <p>For questions about these Terms, contact us at: <a href="mailto:support@wktstudio.com" className="text-indigo-600 hover:underline">support@wktstudio.com</a></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600">Home</Link>
          <Link href="/privacy" className="hover:text-slate-600">Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
