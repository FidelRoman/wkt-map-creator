import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import admin from 'firebase-admin';
import { computeBbox, newFeatureId } from '../lib/map-utils';

// Initialize Firebase Admin
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

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const projectIdIndex = args.indexOf('--project');
const targetProjectId = projectIdIndex !== -1 ? args[projectIdIndex + 1] : null;

if (dryRun) {
  console.log('=== DRY RUN MODE - No writes will be committed ===\n');
}

async function migrateProject(projectId: string) {
  console.log(`\n--------------------------------------------------`);
  console.log(`Processing project: ${projectId}`);
  
  const projectRef = db.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();
  
  if (!projectSnap.exists) {
    console.error(`Error: Project ${projectId} not found.`);
    return { success: false, reason: 'not_found' };
  }
  
  const projectData = projectSnap.data()!;
  
  if (projectData.schemaVersion === 2 && !force) {
    console.log(`Skipping: Project ${projectId} is already schemaVersion 2.`);
    return { success: true, skipped: true };
  }
  
  console.log(`Project Name: "${projectData.name}"`);
  console.log(`Current schemaVersion: ${projectData.schemaVersion || 1}`);
  
  const legacyLayers = projectData.layers || [];
  let legacyFeaturesToMigrate: any[] = [];
  const indexMap: Record<string, string> = {}; // key: "layerId:index" -> value: featureId
  
  // 1. Parse legacy features from layers array
  for (const layer of legacyLayers) {
    let layerFeatures: any[] = [];
    if (layer.features) {
      if (typeof layer.features === 'string') {
        try {
          const parsed = JSON.parse(layer.features);
          layerFeatures = parsed.features || [];
        } catch (e: any) {
          console.error(`Warning: Failed to parse features JSON for layer ${layer.id}: ${e.message}`);
          return { success: false, reason: 'malformed_json_layers', error: e };
        }
      } else if (layer.features.features) {
        layerFeatures = layer.features.features;
      }
    }
    
    console.log(`Layer "${layer.name}" (${layer.id}) has ${layerFeatures.length} legacy features.`);
    
    layerFeatures.forEach((feat, index) => {
      // Ensure feature has an ID
      const fid = feat.id || newFeatureId();
      feat.id = fid;
      feat.__layerId = layer.id;
      feat.__index = index;
      legacyFeaturesToMigrate.push(feat);
      indexMap[`${layer.id}:${index}`] = fid;
    });
  }
  
  // 2. Fetch existing subcollection features (to handle hybrid projects safely)
  const featuresColl = projectRef.collection('features');
  const existingFeaturesSnap = await featuresColl.get();
  const existingFeatures = existingFeaturesSnap.docs.map(doc => {
    const raw = doc.data();
    let geometry = null;
    let properties = {};
    try { geometry = typeof raw.geometry === 'string' ? JSON.parse(raw.geometry) : raw.geometry; } catch {}
    try { properties = typeof raw.properties === 'string' ? JSON.parse(raw.properties) : raw.properties; } catch {}
    return {
      id: doc.id,
      geometry,
      properties,
      layerId: raw.layerId,
      order: raw.order
    };
  });
  
  console.log(`Subcollection 'features' currently has ${existingFeatures.length} features.`);
  
  const existingIds = new Set(existingFeatures.map(f => f.id));
  
  // Filter out legacy features that are already in the subcollection (by ID)
  const newFeaturesToInsert = legacyFeaturesToMigrate.filter(lf => !existingIds.has(lf.id));
  console.log(`Legacy features not yet in subcollection: ${newFeaturesToInsert.length}`);
  
  // 3. Prepare batches for new features
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let opCount = 0;
  
  const addToBatch = (operation: (batch: admin.firestore.WriteBatch) => void) => {
    operation(currentBatch);
    opCount++;
    if (opCount >= 400) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      opCount = 0;
    }
  };
  
  // Add sets for new features
  newFeaturesToInsert.forEach((f) => {
    const featRef = featuresColl.doc(f.id);
    addToBatch((b) => {
      b.set(featRef, {
        layerId: f.__layerId,
        geometry: JSON.stringify(f.geometry ?? null),
        properties: JSON.stringify(f.properties ?? {}),
        order: (f.__index + 1) * 1024,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'backfill',
      });
    });
  });
  
  // 4. Remap Comments (from featureIndex to featureId)
  const commentsColl = projectRef.collection('comments');
  const commentsSnap = await commentsColl.get();
  let commentsUpdated = 0;
  
  commentsSnap.docs.forEach((commentDoc) => {
    const comment = commentDoc.data();
    if (typeof comment.featureIndex === 'number' && !comment.featureId) {
      const fid = indexMap[`${comment.layerId}:${comment.featureIndex}`];
      if (fid) {
        commentsUpdated++;
        addToBatch((b) => {
          b.update(commentDoc.ref, {
            featureId: fid,
            featureIndex: admin.firestore.FieldValue.delete(), // clean up deprecated property
          });
        });
      } else {
        console.log(`Warning: Could not resolve featureId for comment ${commentDoc.id} (layerId: ${comment.layerId}, index: ${comment.featureIndex})`);
      }
    }
  });
  if (commentsUpdated > 0) {
    console.log(`Remapping ${commentsUpdated} comments from featureIndex to featureId.`);
  }
  
  // 5. Build clean layer metadata (no features strings)
  const cleanLayers = legacyLayers.map((l: any) => {
    const { features, ...rest } = l;
    return rest;
  });
  
  // 6. Compute combined metadata (migrated + existing)
  const allFeatures = [
    ...existingFeatures,
    ...newFeaturesToInsert.map(f => ({
      id: f.id,
      geometry: f.geometry,
      properties: f.properties,
      layerId: f.__layerId
    }))
  ];
  
  const bbox = computeBbox(allFeatures);
  const totalFeatureCount = allFeatures.length;
  
  const layerFeatureCounts: Record<string, number> = {};
  allFeatures.forEach(f => {
    if (f.layerId) {
      layerFeatureCounts[f.layerId] = (layerFeatureCounts[f.layerId] || 0) + 1;
    }
  });
  
  // 7. Update project document
  addToBatch((b) => {
    b.update(projectRef, {
      layers: cleanLayers,
      schemaVersion: 2,
      bbox: bbox ?? null,
      featureCount: totalFeatureCount,
      layerFeatureCounts: layerFeatureCounts,
      _legacyFeatures: legacyLayers, // safety backup of original layers
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  
  if (opCount > 0) {
    batches.push(currentBatch);
  }
  
  // 8. Commit
  if (!dryRun) {
    console.log(`Committing ${batches.length} batch(es) for project ${projectId}...`);
    for (const b of batches) {
      await b.commit();
    }
    console.log(`✓ Project ${projectId} migrated successfully.`);
  } else {
    console.log(`[DRY RUN] Would commit ${batches.length} batch(es) containing ${newFeaturesToInsert.length} feature sets, ${commentsUpdated} comment updates, and 1 project update.`);
    console.log(`[DRY RUN] Expected metadata:`);
    console.log(`    featureCount: ${totalFeatureCount}`);
    console.log(`    layerFeatureCounts:`, layerFeatureCounts);
    console.log(`    bbox:`, bbox);
  }
  
  return { success: true };
}

async function run() {
  if (targetProjectId) {
    await migrateProject(targetProjectId);
  } else {
    console.log('Querying all projects...');
    // Scan all projects
    const projectsSnap = await db.collection('projects').get();
    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    for (const doc of projectsSnap.docs) {
      try {
        const res = await migrateProject(doc.id);
        if (res.success) {
          if (res.skipped) skippedCount++;
          else migratedCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        console.error(`Error migrating project ${doc.id}:`, e);
        failedCount++;
      }
    }
    
    console.log(`\nMigration Summary:`);
    console.log(`- Migrated: ${migratedCount}`);
    console.log(`- Skipped (already v2): ${skippedCount}`);
    console.log(`- Failed: ${failedCount}`);
  }
}

run().catch(console.error).finally(() => process.exit(0));
