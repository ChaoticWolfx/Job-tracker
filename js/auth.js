import { auth, googleProvider, db } from './firebase.js';
import { state } from './state.js';
import { loadData } from './api.js';
import { renderJobs } from './jobs.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function toggleAuthMode() {
    state.isSignUpMode = !state.isSignUpMode; 
    const title = document.getElementById('auth-title'); 
    const submitBtn = document.getElementById('auth-submit-btn'); 
    const toggleText = document.getElementById('auth-toggle-text');
    
    if (state.isSignUpMode) { 
        title.innerText = "Create an Account"; 
        submitBtn.innerText = "Sign Up"; 
        toggleText.innerHTML = `Already have an account? <a href="#" onclick="toggleAuthMode()" style="color:var(--primary); text-decoration:none; font-weight:bold;">Log In</a>`; 
    } else { 
        title.innerText = "Access Your Workspace"; 
        submitBtn.innerText = "Log In"; 
        toggleText.innerHTML = `Don't have an account? <a href="#" onclick="toggleAuthMode()" style="color:var(--primary); text-decoration:none; font-weight:bold;">Sign Up</a>`; 
    }
}

export async function handleEmailAuth() {
    const email = document.getElementById('email-input').value.trim(); 
    const pass = document.getElementById('password-input').value;
    if(!email || !pass) return alert("Please enter email and password.");
    
    try { 
        if (state.isSignUpMode) { 
            await createUserWithEmailAndPassword(auth, email, pass); 
        } else { 
            await signInWithEmailAndPassword(auth, email, pass); 
        } 
    } catch(e) { 
        alert("Authentication failed: " + e.message); 
    }
}

export async function loginWithGoogle() { 
    try { await signInWithPopup(auth, googleProvider); } catch(e) { alert("Google login failed: " + e.message); } 
}

export async function logout() { 
    await signOut(auth); 
}

// Session Listener
export function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUserUid = user.uid; 
            state.currentUserEmail = user.email; 
            state.currentUserName = user.displayName || user.email.split('@')[0]; 
            state.currentUserPhoto = user.photoURL || `https://ui-avatars.com/api/?name=${state.currentUserName}&background=random`;
            
            try { 
                await setDoc(doc(db, "users", state.currentUserUid), { 
                    uid: state.currentUserUid, 
                    name: state.currentUserName, 
                    email: state.currentUserEmail, 
                    photoURL: state.currentUserPhoto, 
                    lastLogin: Date.now() 
                }, { merge: true }); 
            } catch(e) { console.error("Error saving user profile:", e); }
            
            // Update UI Elements
            document.getElementById('user-profile-pic').src = state.currentUserPhoto; 
            document.getElementById('user-profile-pic').classList.remove('hidden'); 
            document.getElementById('settings-profile-pic').src = state.currentUserPhoto; 
            document.getElementById('settings-user-name').innerText = state.currentUserName; 
            document.getElementById('settings-user-email').innerText = state.currentUserEmail;
            
            if (state.currentUserUid === state.ADMIN_UID) {
                document.getElementById('admin-overview-btn').classList.remove('hidden'); 
            } else {
                document.getElementById('admin-overview-btn').classList.add('hidden');
            }
            
            // Check invites & load data (functions will be imported from team.js and api.js in the main app file)
            await loadData();
            
            document.getElementById('login-view').classList.add('hidden'); 
            document.getElementById('home-view').classList.remove('hidden'); 
            document.getElementById('logout-btn').classList.remove('hidden'); 
            document.getElementById('app-footer').classList.remove('hidden');
            
            state.viewingArchives = false; 
            renderJobs();
        } else {
            // Clear State
            state.currentUserUid = null; state.currentUserName = null; state.currentUserPhoto = null; state.jobs = []; state.teamMembers = []; state.currentPendingInvite = null;
            
            // Reset UI
            document.getElementById('login-view').classList.remove('hidden'); 
            document.getElementById('home-view').classList.add('hidden'); 
            document.getElementById('job-detail-view').classList.add('hidden'); 
            document.getElementById('logout-btn').classList.add('hidden'); 
            document.getElementById('user-profile-pic').classList.add('hidden'); 
            document.getElementById('app-footer').classList.add('hidden'); 
            document.getElementById('admin-overview-btn').classList.add('hidden');
        }
    });
}
