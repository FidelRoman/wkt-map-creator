import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc, getDoc, deleteDoc, setDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
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
        // Query by ownerId (matches the security rule) + filter projectId client-side.
        // This avoids needing a composite index and satisfies the Firestore rule:
        // "allow read: if request.auth.uid == resource.data.ownerId"
        const q = query(
            collection(db, 'snapshots'),
            where('ownerId', '==', ownerId)
            // No orderBy — avoids composite index requirement; we sort client-side below
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }) as Snapshot)
            .filter(s => s.projectId === projectId)
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
}

// Create a new project
export async function createProject(name: string, ownerId: string, ownerName: string, ownerEmail: string): Promise<{ id: string; name: string }> {
    try {
        const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
            name: name,
            ownerId: ownerId,
            ownerName: ownerName,
            ownerEmail: ownerEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            layers: [
                {
                    id: 'layer_' + Date.now(),
                    name: 'Capa 1',
                    visible: true,
                    features: JSON.stringify({ type: "FeatureCollection", features: [] })
                }
            ],
            isPublic: false,
            collaborators: []
        });
        await incrementProjectCount(ownerId, 1);
        return { id: docRef.id, name };
    } catch (error) {
        console.error("Error creating project:", error);
        throw error;
    }
}

// Helper to parse layers
const parseLayers = (layers: any[]): Layer[] => {
    return layers.map(l => ({
        ...l,
        features: (typeof l.features === 'string') ? JSON.parse(l.features) : l.features
    }));
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

// Save/Update project layers
export async function saveProjectLayers(projectId: string, layers: Layer[]) {
    if (!projectId) return;

    try {
        // Serialize features to avoid nested array issues
        const serializedLayers = layers.map(l => ({
            ...l,
            features: JSON.stringify(l.features)
        }));

        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(projectRef, {
            layers: serializedLayers,
            updatedAt: serverTimestamp()
        });
        console.log("Project layers saved");
    } catch (error) {
        console.error("Error saving project:", error);
    }
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

// Load a specific project (by ID)
export async function getProject(projectId: string): Promise<Project | null> {
    try {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                layers: data.layers ? parseLayers(data.layers) : []
            } as Project;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting project:", error);
        throw error;
    }
}

export async function getPublicProjects(limitCount = 24): Promise<Project[]> {
    try {
        // No orderBy to avoid requiring a composite index; sort client-side instead
        const q = query(
            collection(db, PROJECTS_COLLECTION),
            where('isPublic', '==', true)
        );
        const snapshot = await getDocs(q);
        const projects = snapshot.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, layers: data.layers ? parseLayers(data.layers) : [] } as Project;
        });
        return projects
            .sort((a, b) => {
                const aTime = a.updatedAt?.seconds ?? 0;
                const bTime = b.updatedAt?.seconds ?? 0;
                return bTime - aTime;
            })
            .slice(0, limitCount);
    } catch (error) {
        console.error("Error fetching public projects:", error);
        return [];
    }
}

export async function forkProject(sourceProjectId: string, targetUserId: string, targetUserName: string, targetUserEmail: string): Promise<string> {
    const source = await getProject(sourceProjectId);
    if (!source) throw new Error('Source project not found');
    const serializedLayers = (source.layers ?? []).map(l => ({
        ...l,
        features: typeof l.features === 'string' ? l.features : JSON.stringify(l.features)
    }));
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
        name: `${source.name} (copia)`,
        ownerId: targetUserId,
        ownerName: targetUserName,
        ownerEmail: targetUserEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        layers: serializedLayers,
        isPublic: false,
        collaborators: [],
    });
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
