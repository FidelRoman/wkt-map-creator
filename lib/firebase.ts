import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc, getDoc, deleteDoc, setDoc } from "firebase/firestore";
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
    lsCustomerId: string | null;
    lsSubscriptionId: string | null;
    lsCustomerPortalUrl: string | null;
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
        lsCustomerId: null,
        lsSubscriptionId: null,
        lsCustomerPortalUrl: null,
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

export async function getSnapshots(projectId: string, limitCount: number = 20): Promise<Snapshot[]> {
    try {
        const q = query(
            collection(db, 'snapshots'),
            where('projectId', '==', projectId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.slice(0, limitCount).map(d => ({
            id: d.id,
            ...d.data()
        })) as Snapshot[];
    } catch (error) {
        console.error("Error fetching snapshots:", error);
        return [];
    }
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
    await deleteDoc(doc(db, 'snapshots', snapshotId));
}

export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    features: any; // GeoJSON FeatureCollection or similar
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
