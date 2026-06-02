import { parse, stringify } from 'wellknown';
import * as turf from '@turf/turf';

// ─── Feature identity ──────────────────────────────────────────────────────────
// IDs use the same 20-char alphabet as Firestore auto-IDs so they can be used
// directly as document IDs when the subcollection migration is activated.

const FIRESTORE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function newFeatureId(): string {
    let id = '';
    for (let i = 0; i < 20; i++) {
        id += FIRESTORE_CHARS.charAt(Math.floor(Math.random() * FIRESTORE_CHARS.length));
    }
    return id;
}

// Idempotent: assigns an id to every feature that lacks one.
// IMPORTANT: duplicating a feature must call this on the copy with a fresh id,
// NOT reuse the original's id.
export function ensureFeatureIds(fc: any): any {
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return fc;
    let changed = false;
    const features = fc.features.map((f: any) => {
        if (f && !f.id) {
            changed = true;
            return { ...f, id: newFeatureId() };
        }
        return f;
    });
    return changed ? { ...fc, features } : fc;
}

// Produces the minimal changeset between a previous snapshot and the new state.
// Both arguments are flat Feature arrays (already have ids).
export type FeatureChangeset = {
    creates: any[];                          // features to create (with id)
    updates: { id: string; geometry?: any; properties?: any }[];
    deletes: string[];                       // ids to delete
};

export function diffFeatures(prev: any[], next: any[]): FeatureChangeset {
    const prevById = new Map<string, any>(prev.map(f => [f.id, f]));
    const cs: FeatureChangeset = { creates: [], updates: [], deletes: [] };
    const nextIds = new Set<string>();

    for (const f of next) {
        if (!f.id) continue;
        nextIds.add(f.id);
        const p = prevById.get(f.id);
        if (!p) {
            cs.creates.push(f);
        } else {
            const geomChanged = JSON.stringify(p.geometry) !== JSON.stringify(f.geometry);
            const propsChanged = JSON.stringify(p.properties) !== JSON.stringify(f.properties);
            if (geomChanged || propsChanged) {
                cs.updates.push({ id: f.id, geometry: f.geometry, properties: f.properties });
            }
        }
    }
    for (const id of prevById.keys()) {
        if (!nextIds.has(id)) cs.deletes.push(id);
    }
    return cs;
}

// Computes the bounding box of a flat Feature array; returns null if no coords.
export function computeBbox(features: any[]): [number, number, number, number] | null {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    const visit = (c: any): void => {
        if (!Array.isArray(c)) return;
        if (typeof c[0] === 'number') {
            const [lng, lat] = c;
            if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        } else c.forEach(visit);
    };
    for (const f of features) visit(f?.geometry?.coordinates ?? []);
    return isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}

// ─── Existing utilities ────────────────────────────────────────────────────────

export function stringifyWKT(geojson: any) {
    try {
        return stringify(geojson);
    } catch (e) {
        console.error("Error stringifying WKT:", e);
        return "";
    }
}

export function generateColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

export function parseWKT(wkt: string) {
    try {
        const geojson = parse(wkt);
        if (geojson) {
            return geojson;
        } else {
            throw new Error("Invalid WKT");
        }
    } catch (e) {
        console.error("Error parsing WKT:", e);
        return null;
    }
}

export function subtractPolygons(subjectFeature: any, clipFeature: any) {
    try {
        // Turf difference expects GeoJSON polygons
        const diff = turf.difference(turf.featureCollection([subjectFeature, clipFeature]));
        return diff; // Returns Feature or null
    } catch (e) {
        console.error("Error in subtraction:", e);
        return null;
    }
}
