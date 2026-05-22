import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Refund policy for WKT Studio subscriptions.',
};

export default function RefundPage() {
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
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Refund Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: May 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">14-Day Money-Back Guarantee</h2>
            <p>
              If you are not satisfied with your WKT Studio Pro subscription, you may request a full refund within <strong>14 days</strong> of your initial purchase — no questions asked.
            </p>
            <p className="mt-2">
              This guarantee applies to first-time purchases of the Pro plan (monthly or yearly). It does not apply to renewal charges after the initial billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">How to Request a Refund</h2>
            <p>To request a refund, email us at <a href="mailto:support@wktstudio.com" className="text-indigo-600 hover:underline">support@wktstudio.com</a> with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>The email address associated with your account</li>
              <li>Your order or transaction ID (found in your Paddle receipt)</li>
            </ul>
            <p className="mt-2">We will process your refund within 5 business days. The amount will be returned to your original payment method.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">Renewals</h2>
            <p>
              Subscriptions renew automatically at the end of each billing period. Renewal charges are non-refundable. To avoid being charged for a renewal, cancel your subscription at least 24 hours before the renewal date from your customer portal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">Cancellation</h2>
            <p>
              You may cancel your subscription at any time from your account settings. Upon cancellation, you retain access to Pro features until the end of your current billing period. No further charges will be made after cancellation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">Contact</h2>
            <p>
              For refund requests or billing questions, contact us at{' '}
              <a href="mailto:support@wktstudio.com" className="text-indigo-600 hover:underline">support@wktstudio.com</a>.
              We typically respond within 1 business day.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex gap-4 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600">Home</Link>
          <Link href="/terms" className="hover:text-slate-600">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-slate-600">Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
