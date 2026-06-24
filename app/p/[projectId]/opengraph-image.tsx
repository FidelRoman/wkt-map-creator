import { ImageResponse } from 'next/og';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const alt = 'WKT Studio — Interactive GIS Map';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Cache for 24 h — regenerates only when Next.js revalidates
export const revalidate = 86400;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktstudio.com';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

async function getProject(projectId: string) {
    try {
        const db = getAdminDb();
        const doc = await db.collection('projects').doc(projectId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as any;
    } catch {
        return null;
    }
}

function mapboxUrl(bbox: [number, number, number, number] | null): string | null {
    if (!bbox || !MAPBOX_TOKEN) return null;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const pad = Math.max((maxLng - minLng) * 0.15, 0.001);
    return `https://api.mapbox.com/styles/v1/mapbox/light-v10/static/[${minLng - pad},${minLat - pad},${maxLng + pad},${maxLat + pad}]/1200x630@2x?padding=60&access_token=${MAPBOX_TOKEN}`;
}

export default async function Image({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const project = await getProject(projectId);

    const name: string = project?.name ?? 'Untitled Map';
    const featureCount: number = project?.featureCount ?? 0;
    const isPublic: boolean = project?.isPublic ?? false;
    const mapUrl = isPublic ? mapboxUrl(project?.bbox ?? null) : null;

    return new ImageResponse(
        (
            <div
                style={{
                    width: 1200,
                    height: 630,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#f8fafc',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Map background */}
                {mapUrl ? (
                    <img
                        src={mapUrl}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                    />
                ) : (
                    /* Gradient fallback when no map */
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 50%, #f0fdf4 100%)',
                    }} />
                )}

                {/* Overlay gradient for text legibility */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.2) 55%, transparent 100%)',
                }} />

                {/* Top badge */}
                <div style={{
                    position: 'absolute', top: 36, left: 44,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(255,255,255,0.92)', borderRadius: 12,
                    padding: '8px 18px',
                }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>WKT Studio</span>
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: '#7c3aed',
                        background: '#ede9fe', borderRadius: 20, padding: '2px 8px',
                        letterSpacing: '0.5px', textTransform: 'uppercase',
                    }}>GIS</span>
                </div>

                {/* Bottom content */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '28px 44px 36px',
                    display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                    <div style={{ fontSize: 44, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1.15, maxWidth: 900 }}>
                        {name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 4 }}>
                        {featureCount > 0 && (
                            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                                {featureCount.toLocaleString()} feature{featureCount !== 1 ? 's' : ''}
                            </span>
                        )}
                        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)' }}>
                            {APP_URL.replace('https://', '')}
                        </span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
