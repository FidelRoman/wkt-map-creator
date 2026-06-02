import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, doc, updateDoc, getDoc, deleteDoc, setDoc, onSnapshot, writeBatch, type Unsubscribe } from "firebase/firestore";
import type { PlanId } from './plans';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };

// Firestore Helpers

const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    plan: PlanId;
    paddleCustomerId: string | null;
    paddleSubscriptionId: string | null;
    subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | null;
    currentPeriodEnd: any | null;
    usageCounters: {
        projectCount: number;
        apiCallsThisMonth: number;
        apiCallsResetAt: any;
    };
    hasCompletedOnboarding: boolean;
    apiKeys: Array<{ key: string; name: string; createdAt: any; lastUsed: any | null }>;
    createdAt: any;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const docRef = doc(db, USERS_COLLECTION, uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { uid, ...docSnap.data() } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

export async function createUserProfile(uid: string, email: string, displayName: string): Promise<UserProfile> {
    const profile: Omit<UserProfile, 'uid'> = {
        email,
        displayName,
        plan: 'free',
        paddleCustomerId: null,
        paddleSubscriptionId: null,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        usageCounters: {
            projectCount: 0,
            apiCallsThisMonth: 0,
            apiCallsResetAt: serverTimestamp(),
        },
        hasCompletedOnboarding: false,
        apiKeys: [],
        createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, USERS_COLLECTION, uid), profile);
    return { uid, ...profile };
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRef, updates as Record<string, unknown>);
}

// ── API key index (O(1) lookup) ────────────────────────────────────────────────
// Each document in `apiKeyIndex` has the API key as its ID and stores { uid }.
// This avoids scanning all users when verifying a key server-side.

export async function addApiKeyToIndex(key: string, uid: string): Promise<void> {
    await setDoc(doc(db, 'apiKeyIndex', key), { uid, createdAt: serverTimestamp() });
}

export async function removeApiKeyFromIndex(key: string): Promise<void> {
    await deleteDoc(doc(db, 'apiKeyIndex', key));
}

export async function incrementProjectCount(uid: string, delta: number): Promise<void> {
    try {
        const profile = await getUserProfile(uid);
        if (!profile) return;
        const newCount = Math.max(0, (profile.usageCounters?.projectCount ?? 0) + delta);
        await updateDoc(doc(db, USERS_COLLECTION, uid), {
            'usageCounters.projectCount': newCount
        });
    } catch (error) {
        console.error("Error updating project count:", error);
    }
}

export interface Snapshot {
    id?: string;
    projectId: string;
    ownerId: string;
    name: string;
    layers: any[];
    createdAt: any;
}

export async function createSnapshot(projectId: string, ownerId: string, name: string, layers: Layer[]): Promise<string> {
    const serializedLayers = layers.map(l => ({
        ...l,
        features: typeof l.features === 'string' ? l.features : JSON.stringify(l.features)
    }));
    const docRef = await addDoc(collection(db, 'snapshots'), {
        projectId,
        ownerId,
        name,
        layers: serializedLayers,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function getSnapshots(projectId: string, ownerId: string, limitCount: number = 20): Promise<Snapshot[]> {
    try {
        // Query by ownerId and projectId.
        // Multiple equality filters do not require a composite index in Firestore (index merging handles it).
        // This keeps the request highly performant and secure.
        const q = query(
            collection(db, 'snapshots'),
            where('ownerId', '==', ownerId),
            where('projectId', '==', projectId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }) as Snapshot)
            .sort((a, b) => {
                const tsA = a.createdAt?.seconds ?? 0;
                const tsB = b.createdAt?.seconds ?? 0;
                return tsB - tsA; // desc
            })
            .slice(0, limitCount);
    } catch (error) {
        console.error("Error fetching snapshots:", error);
        return [];
    }
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
    await deleteDoc(doc(db, 'snapshots', snapshotId));
}

export interface LayerStyle {
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    pointRadius?: number;
}

export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    features: any; // GeoJSON FeatureCollection or similar
    style?: LayerStyle;
}

// ── Feature subcollection model ────────────────────────────────────────────────
// Each feature is an independent Firestore document under
// projects/{id}/features/{featureId}.  The `id` field mirrors the doc id and
// is also stored as Feature.id in the in-memory GeoJSON so the diff can track
// it across undo/redo cycles.  geometry/properties are stored as JSON strings
// because Firestore rejects nested arrays (GeoJSON coordinates).

export interface FeatureDoc {
    layerId: string;
    geometry: any;
    properties: Record<string, any>;
    order: number;              // append-only integer; tie-break: createdAt + id
    createdAt: any;
    updatedAt: any;
    createdBy: string;          // uid | 'api' | 'import' | 'fork'
}

export type LayerMeta = Pick<Layer, 'id' | 'name' | 'visible' | 'style'> & { order?: number };

export interface Project {
    id?: string;
    name: string;
    ownerId: string;
    ownerName?: string;
    ownerEmail?: string;
    createdAt?: any;
    updatedAt?: any;
    layers: Layer[];
    isPublic: boolean;
    collaborators: string[];
    roles?: Record<string, 'editor' | 'viewer'>;
    // Subcollection metadata (kept on the project doc)
    bbox?: [number, number, number, number] | null;
    featureCount?: number;
    layerFeatureCounts?: Record<string, number>;
}

// Create a new project — features live in the projects/{id}/features subcollection
export async function createProject(name: string, ownerId: string, ownerName: string, ownerEmail: string): Promise<{ id: string; name: string }> {
    try {
        const defaultLayerId = 'layer_' + Date.now();
        const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
            name,
            ownerId,
            ownerName,
            ownerEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // Layers: metadata only, no features blob
            layers: [{ id: defaultLayerId, name: 'Capa 1', visible: true }],
            isPublic: false,
            collaborators: [],
            featureCount: 0,
            layerFeatureCounts: { [defaultLayerId]: 0 },
            bbox: null,
        });
        await incrementProjectCount(ownerId, 1);
        return { id: docRef.id, name };
    } catch (error) {
        console.error("Error creating project:", error);
        throw error;
    }
}

// Helper to parse layers — also backfills feature ids in memory (idempotent)
const parseLayers = (layers: any[]): Layer[] => {
    // Import inline to avoid a module-level cycle (map-utils → firebase is fine,
    // but we keep the import lazy so tests can mock it easily).
    const { ensureFeatureIds } = require('@/lib/map-utils');
    return layers.map(l => {
        const fc = (typeof l.features === 'string') ? JSON.parse(l.features) : l.features;
        return { ...l, features: ensureFeatureIds(fc) };
    });
};

// Get user's projects
export async function getUserProjects(userId: string): Promise<Project[]> {
    try {
        const q = query(
            collection(db, PROJECTS_COLLECTION),
            where('ownerId', '==', userId),
        );
        const snapshot = await getDocs(q);

        return snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    layers: data.layers ? parseLayers(data.layers) : []
                } as Project;
            })
            .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
    } catch (error) {
        console.error("Error fetching projects:", error);
        return [];
    }
}

// Get projects shared with user
export async function getSharedProjects(userEmail: string): Promise<Project[]> {
    try {
        const q = query(
            collection(db, PROJECTS_COLLECTION),
            where('collaborators', 'array-contains', userEmail),
            orderBy('updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                layers: data.layers ? parseLayers(data.layers) : []
            } as Project;
        });
    } catch (error) {
        console.error("Error fetching shared projects:", error);
        return [];
    }
}

// Replace a project's layers + features (subcollection) in one shot.
// Used when seeding a project from a template, the anonymous editor, or a fork.
// Writes layer metadata to the project doc and every feature to the subcollection.
export async function saveProjectWithFeatures(projectId: string, layers: Layer[]) {
    if (!projectId) return;
    const { ensureFeatureIds, computeBbox } = require('@/lib/map-utils');

    const layersMeta = layers.map((l, i) => ({
        id: l.id, name: l.name, visible: l.visible ?? true, style: l.style ?? null, order: i,
    }));

    const batch = writeBatch(db);
    const allFeatures: any[] = [];
    const layerFeatureCounts: Record<string, number> = {};

    for (const l of layers) {
        const fc = ensureFeatureIds(typeof l.features === 'string' ? JSON.parse(l.features) : l.features);
        const feats: any[] = fc?.features ?? [];
        layerFeatureCounts[l.id] = feats.length;
        feats.forEach((f: any, i: number) => {
            allFeatures.push(f);
            batch.set(featureDocRef(projectId, f.id), {
                layerId: l.id,
                geometry: JSON.stringify(f.geometry ?? null),
                properties: JSON.stringify(f.properties ?? {}),
                order: (i + 1) * 1024,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: 'seed',
            });
        });
    }

    batch.update(doc(db, PROJECTS_COLLECTION, projectId), {
        layers: layersMeta,
        featureCount: allFeatures.length,
        layerFeatureCounts,
        bbox: computeBbox(allFeatures) ?? null,
        updatedAt: serverTimestamp(),
    });

    await batch.commit();
}

// Update sharing settings
export async function updateProjectSharing(projectId: string, isPublic: boolean, collaborators: string[] = [], roles: Record<string, 'editor' | 'viewer'> = {}) {
    try {
        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(projectRef, {
            isPublic: isPublic,
            collaborators: collaborators,
            roles: roles
        });
    } catch (error) {
        console.error("Error updating sharing:", error);
        throw error;
    }
}

// Rename Project
export async function updateProjectName(projectId: string, newName: string) {
    try {
        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(projectRef, {
            name: newName,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error renaming project:", error);
        throw error;
    }
}

// Delete Project
export async function deleteProject(projectId: string, ownerId?: string) {
    try {
        await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
        if (ownerId) await incrementProjectCount(ownerId, -1);
    } catch (error) {
        console.error("Error deleting project:", error);
        throw error;
    }
}

export async function getPublicProjects(limitCount = 24): Promise<Project[]> {
    try {
        const q = query(
            collection(db, PROJECTS_COLLECTION),
            where('isPublic', '==', true),
            orderBy('updatedAt', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, layers: data.layers ? parseLayers(data.layers) : [] } as Project;
        });
    } catch (error) {
        console.error("Error fetching public projects:", error);
        return [];
    }
}

export async function forkProject(sourceProjectId: string, targetUserId: string, targetUserName: string, targetUserEmail: string): Promise<string> {
    const source = await getProjectWithFeatures(sourceProjectId);
    if (!source) throw new Error('Source project not found');
    // Create the empty project doc, then seed its features subcollection
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
        name: `${source.name} (copia)`,
        ownerId: targetUserId,
        ownerName: targetUserName,
        ownerEmail: targetUserEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        layers: [],
        isPublic: false,
        collaborators: [],
        featureCount: 0,
        layerFeatureCounts: {},
        bbox: null,
    });
    await saveProjectWithFeatures(docRef.id, source.layers ?? []);
    await incrementProjectCount(targetUserId, 1);
    return docRef.id;
}

export interface FeatureComment {
    id?: string;
    projectId: string;
    layerId: string;
    featureIndex: number;
    text: string;
    authorId: string;
    authorName: string;
    authorPhoto: string | null;
    createdAt: any;
    resolved: boolean;
}

export async function addComment(comment: Omit<FeatureComment, 'id' | 'createdAt'>): Promise<string> {
    const ref = await addDoc(collection(db, 'projects', comment.projectId, 'comments'), {
        ...comment,
        createdAt: serverTimestamp(),
        resolved: false,
    });
    return ref.id;
}

export function subscribeToComments(
    projectId: string,
    layerId: string,
    featureIndex: number,
    callback: (comments: FeatureComment[]) => void
): Unsubscribe {
    // No orderBy to avoid composite index requirement; sort client-side
    const q = query(
        collection(db, 'projects', projectId, 'comments'),
        where('layerId', '==', layerId),
        where('featureIndex', '==', featureIndex)
    );
    return onSnapshot(q, snapshot => {
        const comments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeatureComment));
        comments.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
        callback(comments);
    });
}

export async function resolveComment(projectId: string, commentId: string): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId, 'comments', commentId), { resolved: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE SUBCOLLECTION API
// All projects store their features under projects/{id}/features.
// ══════════════════════════════════════════════════════════════════════════════

const FEATURES_SUBCOLL = 'features';

// ── Helpers ──────────────────────────────────────────────────────────────────

function featuresRef(projectId: string) {
    return collection(db, PROJECTS_COLLECTION, projectId, FEATURES_SUBCOLL);
}

function featureDocRef(projectId: string, featureId: string) {
    return doc(db, PROJECTS_COLLECTION, projectId, FEATURES_SUBCOLL, featureId);
}

// Deserialize a feature doc from Firestore (geometry and properties are stored as JSON strings)
function deserializeFeatureDoc(id: string, raw: any): any {
    let geometry: any = null;
    let properties: any = {};
    try { geometry = typeof raw.geometry === 'string' ? JSON.parse(raw.geometry) : raw.geometry; } catch { /* malformed */ }
    try { properties = typeof raw.properties === 'string' ? JSON.parse(raw.properties) : (raw.properties ?? {}); } catch { /* malformed */ }
    return { type: 'Feature', id, geometry, properties };
}

/** Read the project doc + all feature docs, reconstructing Layer[].features grouped by layerId. */
export async function getProjectWithFeatures(projectId: string): Promise<Project | null> {
    const projectSnap = await getDoc(doc(db, PROJECTS_COLLECTION, projectId));
    if (!projectSnap.exists()) return null;
    const data = projectSnap.data();

    const featureSnap = await getDocs(query(featuresRef(projectId), orderBy('order', 'asc')));
    const byLayer: Record<string, any[]> = {};
    featureSnap.docs.forEach(d => {
        const f = d.data();
        if (!byLayer[f.layerId]) byLayer[f.layerId] = [];
        byLayer[f.layerId].push(deserializeFeatureDoc(d.id, f));
    });

    const layers: Layer[] = (data.layers ?? []).map((l: any) => ({
        ...l,
        features: { type: 'FeatureCollection', features: byLayer[l.id] ?? [] }
    }));

    return { id: projectSnap.id, ...data, layers } as Project;
}

/** Real-time listener over the features subcollection.
 *  The first snapshot serves as the initial load (no separate getDocs needed).
 *  Uses metadata.hasPendingWrites to skip echoing our own writes. */
export function subscribeToProjectFeatures(
    projectId: string,
    cb: (features: { id: string; data: FeatureDoc }[], fromCache: boolean, hasPendingWrites: boolean) => void
): Unsubscribe {
    const q = query(featuresRef(projectId), orderBy('order', 'asc'));
    return onSnapshot(q, { includeMetadataChanges: true }, snap => {
        // Deserialize geometry/properties from JSON strings
        cb(
            snap.docs.map(d => {
                const raw = d.data();
                return {
                    id: d.id,
                    data: {
                        ...raw,
                        geometry: typeof raw.geometry === 'string' ? JSON.parse(raw.geometry) : raw.geometry,
                        properties: typeof raw.properties === 'string' ? JSON.parse(raw.properties) : (raw.properties ?? {}),
                    } as FeatureDoc
                };
            }),
            snap.metadata.fromCache,
            snap.metadata.hasPendingWrites
        );
    });
}

// ── Single-feature writes ─────────────────────────────────────────────────────

export async function createFeature(
    projectId: string,
    featureId: string,
    doc_: FeatureDoc
): Promise<void> {
    await setDoc(featureDocRef(projectId, featureId), {
        ...doc_,
        geometry: JSON.stringify(doc_.geometry ?? null),
        properties: JSON.stringify(doc_.properties ?? {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function updateFeature(
    projectId: string,
    featureId: string,
    patch: Partial<Pick<FeatureDoc, 'geometry' | 'properties' | 'layerId' | 'order'>>
): Promise<void> {
    await updateDoc(featureDocRef(projectId, featureId), {
        ...(patch.geometry !== undefined ? { geometry: JSON.stringify(patch.geometry) } : {}),
        ...(patch.properties !== undefined ? { properties: JSON.stringify(patch.properties) } : {}),
        ...(patch.layerId !== undefined ? { layerId: patch.layerId } : {}),
        ...(patch.order !== undefined ? { order: patch.order } : {}),
        updatedAt: serverTimestamp(),
    });
}

export async function deleteFeature(projectId: string, featureId: string): Promise<void> {
    await deleteDoc(featureDocRef(projectId, featureId));
}

// ── Bulk changeset write (≤500 ops, batched) ──────────────────────────────────

import type { FeatureChangeset } from '@/lib/map-utils';
import { computeBbox } from '@/lib/map-utils';

export async function bulkWriteChangeset(
    projectId: string,
    cs: FeatureChangeset,
    layerOrderMap: Record<string, number>, // layerId → base order (for creates)
    createdBy = 'editor'
): Promise<void> {
    if (!cs.creates.length && !cs.updates.length && !cs.deletes.length) return;

    const OPS_PER_BATCH = 450;
    let batch = writeBatch(db);
    let opCount = 0;

    const flush = async () => { await batch.commit(); batch = writeBatch(db); opCount = 0; };
    const tick = async () => { opCount++; if (opCount >= OPS_PER_BATCH) await flush(); };

    for (const f of cs.creates) {
        const order = (layerOrderMap[f.__layerId] ?? 0) + (Date.now() % 1_000_000);
        // Serialize geometry/properties to JSON strings (Firestore rejects nested arrays)
        batch.set(featureDocRef(projectId, f.id), {
            layerId: f.__layerId ?? '',
            geometry: JSON.stringify(f.geometry ?? null),
            properties: JSON.stringify(f.properties ?? {}),
            order,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy,
        });
        await tick();
    }
    for (const u of cs.updates) {
        batch.update(featureDocRef(projectId, u.id), {
            ...(u.geometry ? { geometry: JSON.stringify(u.geometry) } : {}),
            ...(u.properties ? { properties: JSON.stringify(u.properties) } : {}),
            updatedAt: serverTimestamp(),
        });
        await tick();
    }
    for (const id of cs.deletes) {
        batch.delete(featureDocRef(projectId, id));
        await tick();
    }
    if (opCount > 0) await flush();

    // Bump project metadata (updatedAt, bbox, featureCount)
    // Computed from the full current feature set — done async, best-effort
    _bumpProjectMeta(projectId).catch(e => console.error('[bulkWriteChangeset] meta update failed', e));
}

async function _bumpProjectMeta(projectId: string): Promise<void> {
    const snap = await getDocs(featuresRef(projectId));
    const features = snap.docs.map(d => {
        const raw = d.data();
        let geometry: any = null;
        try { geometry = typeof raw.geometry === 'string' ? JSON.parse(raw.geometry) : raw.geometry; } catch { /* ignore */ }
        return { id: d.id, geometry, layerId: raw.layerId };
    });
    const bbox = computeBbox(features);
    const byLayer: Record<string, number> = {};
    features.forEach((f: any) => { byLayer[f.layerId] = (byLayer[f.layerId] ?? 0) + 1; });
    await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
        bbox: bbox ?? null,
        featureCount: features.length,
        layerFeatureCounts: byLayer,
        updatedAt: serverTimestamp(),
    });
}

// ── Layer metadata write (no features) ───────────────────────────────────────

export async function saveLayersMeta(projectId: string, layers: LayerMeta[]): Promise<void> {
    await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
        layers,
        updatedAt: serverTimestamp(),
    });
}

// ── Cascade deletes ───────────────────────────────────────────────────────────

/** Delete all features belonging to a layer in batches (≤500). */
export async function deleteLayerCascade(projectId: string, layerId: string): Promise<void> {
    const q = query(featuresRef(projectId), where('layerId', '==', layerId));
    const snap = await getDocs(q);
    const OPS = 450;
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count >= OPS) { await batch.commit(); batch = writeBatch(db); count = 0; }
    }
    if (count > 0) await batch.commit();
    // Update counts
    await _bumpProjectMeta(projectId).catch(console.error);
}

/** Delete all features of a project (call before deleteProject). */
export async function deleteProjectFeaturesCascade(projectId: string): Promise<void> {
    const snap = await getDocs(featuresRef(projectId));
    const OPS = 450;
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count >= OPS) { await batch.commit(); batch = writeBatch(db); count = 0; }
    }
    if (count > 0) await batch.commit();
}
