import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const projectId = 'zSZcvJiq0LedbYarAnUL';

async function inspect() {
  console.log('--- Inspecting Project in Firestore ---');
  const projectRef = db.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();
  
  if (!projectSnap.exists) {
    console.error('Project not found!');
    return;
  }
  
  const data = projectSnap.data()!;
  console.log(`Project Name: ${data.name}`);
  console.log(`Owner ID: ${data.ownerId}`);
  console.log(`featureCount (meta): ${data.featureCount}`);
  console.log(`layerFeatureCounts (meta):`, data.layerFeatureCounts);
  
  // Inspect layers array
  const layers = data.layers || [];
  console.log(`Layers metadata (from project doc) has ${layers.length} layers:`);
  for (const layer of layers) {
    console.log(`- Layer ID: ${layer.id}, Name: ${layer.name}`);
    // Check if there is an inlined features string or array in the legacy layer object
    if (layer.features) {
      if (typeof layer.features === 'string') {
        try {
          const parsed = JSON.parse(layer.features);
          const count = parsed.features?.length ?? 0;
          console.log(`  -> LEGACY features string present with ${count} features.`);
        } catch (e: any) {
          console.log(`  -> LEGACY features string present but malformed JSON: ${e.message}`);
        }
      } else {
        console.log(`  -> LEGACY features object present of type: ${typeof layer.features}`);
      }
    } else {
      console.log('  -> No legacy features field on this layer object.');
    }
  }

  // Inspect features subcollection
  console.log('\n--- Inspecting Features Subcollection ---');
  const subcollRef = projectRef.collection('features');
  const subcollSnap = await subcollRef.orderBy('order', 'asc').get();
  console.log(`Subcollection 'features' has ${subcollSnap.docs.length} documents:`);
  subcollSnap.docs.forEach((docSnap, index) => {
    const feat = docSnap.data();
    let geomType = 'unknown';
    let featName = 'unnamed';
    
    try {
      const geom = typeof feat.geometry === 'string' ? JSON.parse(feat.geometry) : feat.geometry;
      geomType = geom?.type || 'unknown';
    } catch {}
    
    try {
      const props = typeof feat.properties === 'string' ? JSON.parse(feat.properties) : feat.properties;
      featName = props?.name || 'unnamed';
    } catch {}

    console.log(`[${index}] Doc ID: ${docSnap.id}`);
    console.log(`    layerId: ${feat.layerId}`);
    console.log(`    order: ${feat.order}`);
    console.log(`    geomType: ${geomType}`);
    console.log(`    name: ${featName}`);
  });
}

inspect().catch(console.error);
