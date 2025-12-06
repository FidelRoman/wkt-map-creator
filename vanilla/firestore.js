// firestore.js

const PROJECTS_COLLECTION = 'projects';

// Create a new project
async function createProject(name, ownerId) {
    try {
        const docRef = await db.collection(PROJECTS_COLLECTION).add({
            name: name,
            ownerId: ownerId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            // New Layer Structure
            layers: [
                {
                    id: 'layer_' + Date.now(),
                    name: 'Capa 1',
                    visible: true,
                    features: [] // GeoJSON features
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

// Get user's projects
async function getUserProjects(userId) {
    try {
        const snapshot = await db.collection(PROJECTS_COLLECTION)
            .where('ownerId', '==', userId)
            .orderBy('updatedAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching projects:", error);
        return [];
    }
}

// Save/Update project layers
async function saveProjectLayers(projectId, layers) {
    if (!projectId) return;

    try {
        // Ensure we are saving a clean array of objects
        // (sometimes internal references might sneak in if not careful)
        await db.collection(PROJECTS_COLLECTION).doc(projectId).update({
            layers: layers,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Project layers saved");
    } catch (error) {
        console.error("Error saving project:", error);
    }
}


// Update sharing settings
async function updateProjectSharing(projectId, isPublic, collaborators = []) {
    try {
        await db.collection(PROJECTS_COLLECTION).doc(projectId).update({
            isPublic: isPublic,
            collaborators: collaborators
        });
    } catch (error) {
        console.error("Error updating sharing:", error);
        throw error;
    }
}

// Load a specific project (by ID)
async function getProject(projectId) {
    try {
        const doc = await db.collection(PROJECTS_COLLECTION).doc(projectId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting project:", error);
        throw error;
    }
}
