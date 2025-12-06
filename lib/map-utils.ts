import { parse, stringify } from 'wellknown';
import * as turf from '@turf/turf';

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

export function calculateStats(layers: any[]) {
    let count = 0;
    let area = 0;

    layers.forEach(layer => {
        if (!layer.visible || !layer.features) return;

        turf.flatten(layer.features).features.forEach((f) => {
            count++;
            const a = turf.area(f);
            area += a;
        });
    });

    // Convert area to hectares if > 10000, else m2
    // actually, let's just return raw meters and format in UI
    return { count, area };
}
