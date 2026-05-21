"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import { Project, getUserProjects, getSharedProjects, createProject, deleteProject, updateProjectName } from '@/lib/firebase';
import Modal from '@/components/Modal';
import ShareModal from '@/components/ShareModal';
import UpgradeModal from '@/components/UpgradeModal';
import { PLANS, PLAN_LIMITS, checkLimit, type LimitKey, type FeatureKey, type PlanId } from '@/lib/plans';
import {
  PlusIcon, UserCircleIcon, EllipsisVerticalIcon, TrashIcon,
  PencilIcon, ShareIcon, CheckIcon, SparklesIcon, XMarkIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import Toast, { type ToastType } from '@/components/Toast';

type UpgradeReason =
  | { type: 'limit'; limitKey: LimitKey; current: number; limit: number; requiredPlan: PlanId }
  | { type: 'feature'; featureKey: FeatureKey; requiredPlan: PlanId }
  | undefined;

// ─── Google icon ─────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Landing Page (unauthenticated) ──────────────────────────────────────────

function LandingPage() {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setSigningIn(false);
    }
  };

  const freePlan = PLANS.find(p => p.id === 'free')!;
  const proPlan = PLANS.find(p => p.id === 'pro')!;

  const comparisons: [string, boolean | string, boolean | string, boolean | string][] = [
    ['Native WKT input/output', true, false, 'Scripts only'],
    ['REST API per project', true, false, 'Expensive'],
    ['Visual Attribute Table', true, false, true],
    ['Spatial analysis (Buffer, Union)', true, false, true],
    ['Import GeoJSON / Shapefile', true, false, true],
    ['Team comments & collaboration', true, false, 'Paid add-on'],
    ['Affordable pricing', true, 'Free*', false],
  ];

  const checkCell = (val: boolean | string) => {
    if (val === true) return <span className="text-green-600 font-bold">✓</span>;
    if (val === false) return <span className="text-red-400">✗</span>;
    return <span className="text-slate-500 text-xs">{val}</span>;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            WKT Studio
          </div>
          <div className="flex items-center gap-3">
            <Link href="/explore" className="text-sm text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors hidden md:block">
              Explore
            </Link>
            <Link href="/convert" className="text-sm text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors hidden md:block">
              Converter
            </Link>
            <Link href="/editor" className="text-sm text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              Try free
            </Link>
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="flex items-center gap-2 text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              <GoogleIcon />
              {signingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-indigo-100">
          <SparklesIcon className="w-3.5 h-3.5" />
          For GIS Developers &amp; Data Engineers
        </div>
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-5 leading-tight">
          The GIS Map Editor<br />
          <span className="text-indigo-600">Built for Developers</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-3">
          Paste WKT from PostGIS, import GeoJSON &amp; Shapefiles, run spatial analysis, export PostGIS SQL, and collaborate with your team — all in one tool.
        </p>
        <p className="text-sm text-slate-400 max-w-xl mx-auto mb-8">
          Supports POLYGON · MULTIPOLYGON · LINESTRING · MULTILINESTRING · POINT · GEOMETRYCOLLECTION
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/editor"
            className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Open editor — free, no signup
          </Link>
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <GoogleIcon />
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-4">Free forever · No credit card required · Upgrade anytime</p>
      </section>

      {/* Code preview */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-slate-900 rounded-2xl p-6 font-mono shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-500 text-xs ml-2">PostGIS query</span>
          </div>
          <pre className="text-green-400 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">{`SELECT ST_AsText(geom) FROM parcelas WHERE id = 42;

-- POLYGON ((-77.03 -12.04, -77.02 -12.04,
--           -77.02 -12.03, -77.03 -12.03, -77.03 -12.04))

-- Paste that WKT into WKT Studio → visualize instantly ✓`}</pre>
        </div>
      </section>

      {/* Features grid */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-3">
            Built for the real GIS workflow
          </h2>
          <p className="text-slate-500 text-center mb-12">Everything you need from data ingestion to production — in one tool.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: '🗺️',
                title: 'Native WKT Support',
                desc: 'Paste POLYGON, MULTIPOLYGON, LINESTRING directly from PostGIS, Shapely, or GDAL. No format conversion. No friction.',
              },
              {
                icon: '📂',
                title: 'Import Everything',
                desc: 'Import GeoJSON, Shapefile (.shp + .dbf), CSV with WKT column, or CSV with lat/lng columns. Drop a file and it\'s on the map.',
              },
              {
                icon: '💾',
                title: 'Export & SQL',
                desc: 'Export to CSV, KML, GeoJSON, or generate PostGIS SQL INSERT statements ready to run in psql or any PostgreSQL client.',
              },
              {
                icon: '⚡',
                title: 'REST API per Project',
                desc: 'Every project exposes GET, POST, and DELETE endpoints. Integrate with Python, R, Node.js, or any HTTP client using your API key.',
              },
              {
                icon: '🎨',
                title: 'Layer Style Editor',
                desc: 'Set fill color, stroke color, opacity, and point radius per layer. Live preview on the map. Make your data presentation-ready.',
              },
              {
                icon: '💬',
                title: 'Team Collaboration',
                desc: 'Add comments to specific features, resolve threads, and invite collaborators with editor or viewer roles. Real-time updates.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left py-3 px-5 text-slate-500 font-medium">Feature</th>
                  <th className="text-center py-3 px-4 font-bold text-indigo-700">WKT Studio</th>
                  <th className="text-center py-3 px-4 text-slate-500 font-medium">Google My Maps</th>
                  <th className="text-center py-3 px-4 text-slate-500 font-medium">ArcGIS Online</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map(([feature, ours, gmm, arcgis], i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-5 text-slate-700">{feature}</td>
                    <td className="py-3 px-4 text-center">{checkCell(ours)}</td>
                    <td className="py-3 px-4 text-center">{checkCell(gmm)}</td>
                    <td className="py-3 px-4 text-center">{checkCell(arcgis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 px-5 py-3">* Google My Maps has severe feature limits and no programmatic API access</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-3">Simple, transparent pricing</h2>
          <p className="text-slate-500 text-center mb-10">Start free. Upgrade when you need more.</p>

          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
              <button
                onClick={() => setBillingInterval('month')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingInterval === 'month' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('year')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${billingInterval === 'year' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
              >
                Yearly
                <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">−30%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="rounded-2xl border-2 border-slate-200 p-6 flex flex-col">
              <h3 className="text-xl font-bold text-slate-900 mb-1">{freePlan.name}</h3>
              <p className="text-slate-500 text-sm mb-4">{freePlan.description}</p>
              <div className="text-4xl font-extrabold text-slate-900 mb-6">$0</div>
              <ul className="space-y-2 flex-1 mb-6">
                {freePlan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/editor"
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-center bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all"
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border-2 border-indigo-500 p-6 flex flex-col shadow-lg shadow-indigo-50">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Most popular</div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">{proPlan.name}</h3>
              <p className="text-slate-500 text-sm mb-4">{proPlan.description}</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  ${billingInterval === 'month' ? proPlan.monthlyPrice : proPlan.yearlyPrice}
                </span>
                <span className="text-slate-500 text-sm mb-1">/{billingInterval === 'month' ? 'mo' : 'yr'}</span>
              </div>
              {billingInterval === 'year' && (
                <p className="text-xs text-green-600 font-medium mb-4">
                  Save ${proPlan.monthlyPrice * 12 - proPlan.yearlyPrice} vs monthly
                </p>
              )}
              <ul className="space-y-2 flex-1 mb-6 mt-2">
                {proPlan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckIcon className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {signingIn ? 'Signing in...' : `Get ${proPlan.name}`}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Secure payment via Lemon Squeezy · Cancel anytime · No hidden fees
          </p>
        </div>
      </section>

      {/* How it works + FAQ */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">
            How WKT Studio works
          </h2>
          <p className="text-slate-500 text-center text-sm mb-10">
            From raw geometry to a shareable, styled map in minutes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                step: '1',
                title: 'Paste WKT or import a file',
                desc: 'Run ST_AsText() in PostGIS, call .wkt on a Shapely geometry, or import GeoJSON, Shapefile, CSV, or Excel. Any source works.',
                code: 'SELECT ST_AsText(geom) FROM parcelas;',
              },
              {
                step: '2',
                title: 'Edit, style, and analyze',
                desc: 'Draw new features, run Buffer or Union, edit the Attribute Table, and style each layer with custom colors and opacity.',
                code: 'Buffer(500m) · Union · Subtract · Style',
              },
              {
                step: '3',
                title: 'Export or call the API',
                desc: 'Export as CSV, KML, GeoJSON, or PostGIS SQL. Or push features programmatically via the REST API with your API key.',
                code: 'POST /api/v1/projects/{id}/features',
              },
              {
                step: '4',
                title: 'Share or collaborate',
                desc: 'Make the project public, embed as an iframe, or invite collaborators. Add comments to specific features and resolve them as a team.',
                code: 'Share link · Embed iframe · Invite team',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
                    <p className="text-slate-500 text-sm mb-3 leading-relaxed">{item.desc}</p>
                    <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">{item.code}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mt-12 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Frequently asked questions</h3>
            {[
              {
                q: 'What is WKT Studio?',
                a: 'WKT Studio is a full-featured GIS map editor and spatial data platform for developers. It lets you paste WKT geometry, import GeoJSON/Shapefiles, run spatial analysis (Buffer, Union, Subtract), export PostGIS SQL, access a REST API, and collaborate with your team — all from the browser.',
              },
              {
                q: 'What file formats can I import?',
                a: 'WKT Studio supports GeoJSON (.geojson), Shapefile (.shp + .dbf), CSV with a WKT column, and CSV with latitude/longitude columns. All imports create a new layer in your project.',
              },
              {
                q: 'What WKT geometry types are supported?',
                a: 'WKT Studio supports the full OGC WKT standard: POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON, and GEOMETRYCOLLECTION.',
              },
              {
                q: 'Can I use WKT Studio with PostGIS?',
                a: 'Yes. Run SELECT ST_AsText(your_geom) in PostgreSQL/PostGIS, copy the result, and paste it into WKT Studio. You can also use the REST API to push geometries directly from your SQL pipeline.',
              },
              {
                q: 'What is the REST API?',
                a: 'Every project exposes GET, POST, and DELETE endpoints. You can list features, add new ones, or remove them programmatically using a Bearer API key generated in your account Settings. See the API Docs for curl examples and rate limits by plan.',
              },
              {
                q: 'Is WKT Studio free?',
                a: 'Yes. The free plan gives you 3 projects, up to 200 features per layer, WKT paste, GeoJSON import, and CSV/KML export. The Pro plan adds unlimited projects, REST API access, layer style editor, feature comments, and more.',
              },
            ].map((item, i) => (
              <details key={i} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm group">
                <summary className="font-semibold text-slate-800 cursor-pointer list-none flex items-center justify-between">
                  {item.q}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform text-lg">+</span>
                </summary>
                <p className="text-slate-500 text-sm mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="font-medium text-slate-500">WKT Studio</span>
            <span className="text-slate-300 hidden md:inline">·</span>
            <span className="hidden md:inline">© 2025 WKT Studio. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            <Link href="/convert" className="hover:text-slate-600 transition-colors">WKT / GeoJSON Converter</Link>
            <Link href="/explore" className="hover:text-slate-600 transition-colors">Explore maps</Link>
            <Link href="/templates" className="hover:text-slate-600 transition-colors">Templates</Link>
            <Link href="/api-docs" className="hover:text-slate-600 transition-colors">API Docs</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Dashboard (authenticated) ────────────────────────────────────────────────

function Dashboard() {
  const { user, userProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);

  const [creating, setCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [actionProject, setActionProject] = useState<Project | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>(undefined);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = (message: string, type: ToastType = 'info') => setToast({ message, type });

  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (user) loadProjects();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      setUpgradeSuccess(true);
      refreshProfile();
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const loadProjects = async () => {
    if (!user || !user.email) return;
    const pros = await getUserProjects(user.uid);
    setProjects(pros);
    const shared = await getSharedProjects(user.email);
    setSharedProjects(shared);
  };

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;

    if (userProfile) {
      const check = checkLimit(userProfile.plan, 'maxProjects', projects.length);
      if (!check.allowed) {
        setIsModalOpen(false);
        setUpgradeReason({
          type: 'limit',
          limitKey: 'maxProjects',
          current: check.current,
          limit: check.limit!,
          requiredPlan: check.upgradeRequired!,
        });
        setShowUpgrade(true);
        return;
      }
    }

    setCreating(true);
    try {
      const { id } = await createProject(
        newProjectName,
        user.uid,
        user.displayName || "Usuario",
        user.email || ""
      );
      router.push(`/${id}`);
    } catch (e) {
      console.error(e);
      showToast('Error creating project. Please try again.', 'error');
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!actionProject || !renameValue.trim()) return;
    setActionLoading(true);
    try {
      await updateProjectName(actionProject.id!, renameValue);
      setRenameModalOpen(false);
      loadProjects();
    } catch (e) {
      console.error(e);
      showToast('Error renaming project. Please try again.', 'error');
    } finally {
      setActionLoading(false);
      setActionProject(null);
    }
  };

  const handleDelete = async () => {
    if (!actionProject) return;
    setActionLoading(true);
    try {
      await deleteProject(actionProject.id!);
      setDeleteModalOpen(false);
      loadProjects();
    } catch (e) {
      console.error(e);
      showToast('Error deleting project. Please try again.', 'error');
    } finally {
      setActionLoading(false);
      setActionProject(null);
    }
  };

  const plan = userProfile?.plan ?? 'free';
  const maxProjects = PLAN_LIMITS[plan].maxProjects;

  return (
    <div className="min-h-screen bg-slate-50">
      {userProfile?.subscriptionStatus === 'past_due' && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-red-700">
            ⚠️ There is a problem with your payment. Your Pro plan will be deactivated soon.
          </span>
          {userProfile.lsCustomerPortalUrl && (
            <a href={userProfile.lsCustomerPortalUrl} className="text-sm font-semibold text-red-600 hover:underline ml-4 flex-shrink-0">
              Update payment method →
            </a>
          )}
        </div>
      )}

      {upgradeSuccess && (
        <div className="bg-indigo-600 text-white px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold">🎉 Pro plan activated! You now have access to all Pro features.</span>
          <button onClick={() => setUpgradeSuccess(false)} className="text-white/70 hover:text-white ml-4 flex-shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 w-full">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          WKT Studio
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-100 rounded-full pl-1.5 pr-3 py-1.5">
            {user?.photoURL ? (
              <img src={user.photoURL} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt={user.displayName ?? 'Foto de perfil'} />
            ) : (
              <UserCircleIcon className="w-7 h-7 text-slate-400 flex-shrink-0" />
            )}
            <span className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">{user?.displayName}</span>
            <button
              onClick={() => { if (plan === 'free') setShowUpgrade(true); }}
              title={plan === 'free' ? 'Upgrade to Pro' : `Plan ${plan}`}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-bold flex-shrink-0 ${plan === 'free' ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
              style={{ background: plan === 'pro' ? '#6366f1' : plan === 'business' ? '#f59e0b' : '#6b7280' }}
            >
              {plan !== 'free' && <SparklesIcon className="w-3 h-3" />}
              {plan === 'pro' ? 'Pro' : plan === 'business' ? 'Business' : 'Free'}
            </button>
          </div>
          <Link href="/settings" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Settings">
            <Cog6ToothIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick links */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { href: '/templates', label: '⚡ Templates', desc: 'Start with real data' },
            { href: '/explore', label: '🌍 Explore', desc: 'Public maps' },
            { href: '/convert', label: '⇄ Converter', desc: 'WKT · GeoJSON · WKB' },
            { href: '/api-docs', label: '</> API Docs', desc: 'Integrate with your stack' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="flex flex-col px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 hover:bg-indigo-50 transition-colors group">
              <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700">{l.label}</span>
              <span className="text-xs text-slate-400">{l.desc}</span>
            </Link>
          ))}
        </div>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">My Projects</h2>
            {plan === 'free' && maxProjects !== null && (
              <div className="flex items-center gap-2 mt-2">
                <div className="h-1.5 w-28 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (projects.length / maxProjects) * 100)}%`,
                      background: projects.length >= maxProjects ? '#ef4444' : '#6366f1',
                    }}
                  />
                </div>
                <span className="text-sm text-slate-500">
                  {projects.length} of {maxProjects} projects ·{' '}
                  <button onClick={() => setShowUpgrade(true)} className="text-indigo-600 hover:underline font-medium">
                    Upgrade for unlimited
                  </button>
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => { setNewProjectName(""); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm shadow-indigo-200"
          >
            <PlusIcon className="w-5 h-5" />
            New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
            <div className="inline-flex bg-slate-50 p-4 rounded-full mb-4">
              <PlusIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">No projects yet</h3>
            <p className="text-slate-500 mt-1 mb-6">Create your first project to start mapping</p>
            <button
              onClick={() => { setNewProjectName(""); setIsModalOpen(true); }}
              className="text-indigo-600 font-medium hover:underline"
            >
              Create a project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id} className="relative group">
                <Link
                  href={`/${project.id}`}
                  className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col h-48"
                >
                  <div className="flex justify-between items-start mb-2 pr-8">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                      {project.updatedAt ? new Date(project.updatedAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 mb-1 pr-6">{project.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 flex-1">
                    {project.layers?.length || 0} layers &bull; {project.layers?.reduce((acc, l) => acc + (l.features?.features?.length || 0), 0) || 0} features
                  </p>
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center text-sm text-indigo-600 font-medium">
                    Open Project &rarr;
                  </div>
                </Link>

                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === project.id ? null : project.id!);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <EllipsisVerticalIcon className="w-6 h-6" />
                  </button>

                  {menuOpenId === project.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-20">
                      <button
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setActionProject(project);
                          setRenameValue(project.name);
                          setRenameModalOpen(true);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setActionProject(project);
                          setShareModalOpen(true);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                      >
                        <ShareIcon className="w-4 h-4" />
                        Share
                      </button>
                      <div className="h-px bg-slate-100 my-1" />
                      <button
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setActionProject(project);
                          setDeleteModalOpen(true);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {sharedProjects.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Shared with Me</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedProjects.map(project => (
                <Link
                  href={`/${project.id}`}
                  key={project.id}
                  className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-green-300 hover:shadow-md transition-all cursor-pointer flex flex-col h-48"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-green-50 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                      {project.updatedAt ? new Date(project.updatedAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-green-600 mb-1">{project.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 flex-1">
                    By: {project.ownerName ? `${project.ownerName} (${project.ownerEmail})` : (project.ownerEmail || project.ownerId)}
                  </p>
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center text-sm text-green-600 font-medium">
                    Open Shared &rarr;
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creating}
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {creating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : 'Create Project'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Project Name</label>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Crop Map 2024"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
          />
        </div>
      </Modal>

      <Modal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Rename project"
        footer={
          <>
            <button onClick={() => setRenameModalOpen(false)} className="btn-outline">Cancel</button>
            <button onClick={handleRename} disabled={actionLoading} className="btn-primary">
              {actionLoading ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <input
          type="text"
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Project"
        footer={
          <>
            <button onClick={() => setDeleteModalOpen(false)} className="btn-outline">Cancel</button>
            <button onClick={handleDelete} disabled={actionLoading} className="btn-primary bg-red-600 hover:bg-red-700">
              {actionLoading ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-slate-600">
          Are you sure you want to delete <b>{actionProject?.name}</b>? This action cannot be undone.
        </p>
      </Modal>

      {actionProject && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          project={actionProject}
          onUpdate={() => loadProjects()}
          onShowToast={showToast}
        />
      )}

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} reason={upgradeReason} onShowToast={showToast} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

function PageContent() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-500 text-sm">Loading...</div>
    </div>
  );
  if (!user) return <LandingPage />;
  return <Dashboard />;
}

export default function Page() {
  return (
    <AuthWrapper>
      <PageContent />
    </AuthWrapper>
  );
}
