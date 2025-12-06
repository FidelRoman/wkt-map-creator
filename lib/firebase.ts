import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";

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
    createdAt?: any;
    updatedAt?: any;
    layers: Layer[];
    isPublic: boolean;
    collaborators: string[];
}

// Create a new project
export async function createProject(name: string, ownerId: string): Promise<{ id: string; name: string }> {
    try {
        const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
            name: name,
            ownerId: ownerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // New Layer Structure
            layers: [
                {
                    id: 'layer_' + Date.now(),
                    name: 'Capa 1',
                    visible: true,
                    // Serialize empty features
                    features: JSON.stringify({ type: "FeatureCollection", features: [] })
                }
            ],
            isPublic: false,
            collaborators: []
        });
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
export async function updateProjectSharing(projectId: string, isPublic: boolean, collaborators: string[] = []) {
    try {
        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(projectRef, {
            isPublic: isPublic,
            collaborators: collaborators
        });
    } catch (error) {
        console.error("Error updating sharing:", error);
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
