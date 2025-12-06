
import * as turf from '@turf/turf';

console.log("Turf version:", turf.packageVersion || "unknown");

const poly1 = turf.polygon([
    [
        [128, 0],
        [129, 0],
        [129, 1],
        [128, 1],
        [128, 0]
    ]
], { name: 'poly1' });

const poly2 = turf.polygon([
    [
        [128.5, 0.5],
        [129.5, 0.5],
        [129.5, 1.5],
        [128.5, 1.5],
        [128.5, 0.5]
    ]
], { name: 'poly2' });

console.log("Poly1 type:", poly1.type);
console.log("Poly2 type:", poly2.type);

try {
    // Test v7 syntax
    console.log("Attempting difference with featureCollection...");
    const diff = turf.difference(turf.featureCollection([poly1, poly2]));
    console.log("Difference result:", diff ? diff.geometry.type : "null");
} catch (e) {
    console.error("Error with featureCollection syntax:", e.message);
}

try {
    // Test v6 syntax (just in case)
    console.log("Attempting difference with arguments...");
    const diffOld = turf.difference(poly1, poly2);
    console.log("Difference result (args):", diffOld ? diffOld.geometry.type : "null");
} catch (e) {
    console.error("Error with arguments syntax:", e.message);
}
