// auth.js

// UI Elements
const loginOverlay = document.getElementById('login-overlay');
const loginBtn = document.getElementById('google-login-btn');
const userProfileEl = document.getElementById('user-profile');
const appContainer = document.getElementById('app-container');

// Current User State
let currentUser = null;

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedProjectId = urlParams.get('project');

    if (user) {
        // User is signed in
        currentUser = user;
        console.log('User signed in:', user.email);

        loginOverlay.style.display = 'none';
        renderUserProfile(user);

        if (sharedProjectId) {
            // Load shared project
            if (typeof loadProject === 'function') {
                const p = await getProject(sharedProjectId);
                if (p) loadProject(p.id, p);
            }
        } else {
            // Load user projects
            if (typeof loadUserProjects === 'function') {
                loadUserProjects(user.uid);
            }
        }

    } else {
        // User is signed out
        currentUser = null;
        console.log('User signed out');

        // Check if viewing a public project
        if (sharedProjectId) {
            try {
                const project = await getProject(sharedProjectId);
                if (project && project.isPublic) {
                    loginOverlay.style.display = 'none';
                    if (typeof loadProject === 'function') {
                        loadProject(project.id, project);
                    }
                    // Show a small banner or "Login to Edit" button?
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        }

        // Default: Show Login
        loginOverlay.style.display = 'flex';
        userProfileEl.style.display = 'none';
    }
});

// Login Action
loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            // Handled by onAuthStateChanged
        })
        .catch((error) => {
            console.error('Login Error:', error);
            alert('Error al iniciar sesión: ' + error.message);
        });
});

// Logout Action (Delegated event or attached in render)
function signOut() {
    auth.signOut().then(() => {
        // Handled by onAuthStateChanged
        // Optional: Clear map
        if (typeof clearMap === 'function') clearMap();
    }).catch((error) => {
        console.error('Logout Error:', error);
    });
}

function renderUserProfile(user) {
    userProfileEl.style.display = 'flex';
    userProfileEl.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/36'}" alt="Profile" class="user-avatar">
        <div class="user-info">
            <span class="user-name" title="${user.displayName}">${user.displayName}</span>
            <span class="user-email" title="${user.email}">${user.email}</span>
        </div>
        <button class="btn-logout" id="logout-btn" title="Cerrar Sesión">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
        </button>
    `;

    document.getElementById('logout-btn').addEventListener('click', signOut);
}
