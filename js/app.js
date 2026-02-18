// Import Firebase & Auth directly from the web
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Your specific Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBpeJ6rGw24Mf_xcno9zj9Q6MQW-2HuuMA",
  authDomain: "jobtracker-4d6eb.firebaseapp.com",
  projectId: "jobtracker-4d6eb",
  storageBucket: "jobtracker-4d6eb.firebasestorage.app",
  messagingSenderId: "1074805891410",
  appId: "1:1074805891410:web:e4dde23db3ced1b9061a8b",
  measurementId: "G-PV9V64CJZ5"
};

// Initialize the Cloud connection & Auth
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Master Admin Security Key
const ADMIN_UID = "7cX7BVQxqwMTrsX0NVH5hIruLBW2";

// Data Structure & State
let currentUserUid = null;
let currentUserEmail = null;
let currentUserName = null;
let currentUserPhoto = null;
let jobs = [];
let teamMembers = [];
let adminViewJobs = []; 
let currentJobId = null;
let viewingArchives = false;

// --- SHARED LINK ROUTING ---
const urlParams = new URLSearchParams(window.location.search);
const sharedJobId = urlParams.get('job');

if (sharedJobId) {
    document.getElementById('login-view').classList.add('hidden');
    loadSharedJob(sharedJobId);
}

async function loadSharedJob(firebaseDocId) {
    try {
        const docRef = doc(db, "jobs", firebaseDocId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().isShared === true) {
            const jobData = docSnap.data();
            document.getElementById('shared-job-view').classList.remove('hidden');
            document.getElementById('shared-job-title').innerText = jobData.title || "Untitled Job";
            document.getElementById('shared-job-owner').innerText = "Created by: " + (jobData.owner || "Unknown User");
            const container = document.getElementById('shared-tasks-container');
            container.innerHTML = '';
            if(!jobData.tasks || jobData.tasks.length === 0) {
                container.innerHTML = '<p style="color:var(--gray);">No tasks found.</p>';
            } else {
                jobData.tasks.forEach(task => {
                    let color = task.status === 'Complete' ? 'var(--success)' : (task.status === 'In Progress' ? 'var(--primary)' : 'var(--gray)');
                    let dateStr = task.dueDate ? `<br><span style="font-size:13px; color:#d9534f;">📅 Due: ${task.dueDate} ${task.dueTime ? 'at ' + task.dueTime : ''}</span>` : '';
                    let asgn = task.assignedTo ? `<br><span style="font-size:13px; color:var(--primary);">👤 ${task.assignedTo}</span>` : '';
                    let desc = task.desc ? `<p style="font-size:14px; color:var(--gray); margin-top:5px;">${task.desc}</p>` : '';
                    container.innerHTML += `<div style="background:var(--light-gray); padding:15px; border-radius:6px; margin-bottom:10px; border:1px solid var(--border-color);"><strong>${task.title}</strong> <span style="color:${color}; font-size:12px; font-weight:bold; float:right;">[${task.status}]</span>${desc}${asgn}${dateStr}</div>`;
                });
            }
        } else {
            alert("Invalid link."); window.location.href = window.location.pathname; 
        }
    } catch (e) { window.location.href = window.location.pathname; }
}

// --- THEME LOGIC ---
function loadThemePreference() {
    const isDark = localStorage.getItem('jobTrackerDarkMode') === 'true';
    if (isDark) { document.body.classList.add('dark-mode'); const toggle = document.getElementById('dark-mode-toggle'); if(toggle) toggle.checked = true; }
}
function toggleDarkMode() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    if (isDark) { document.body.classList.add('dark-mode'); localStorage.setItem('jobTrackerDarkMode', 'true'); } 
    else { document.body.classList.remove('dark-mode'); localStorage.setItem('jobTrackerDarkMode', 'false'); }
}
loadThemePreference();

// --- AUTHENTICATION ---
if (!sharedJobId) { 
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid; currentUserEmail = user.email;
            currentUserName = user.displayName || user.email.split('@')[0]; 
            currentUserPhoto = user.photoURL || `https://ui-avatars.com/api/?name=${currentUserName}&background=random`;
            try { await setDoc(doc(db, "users", currentUserUid), { uid: currentUserUid, name: currentUserName, email: currentUserEmail, photoURL: currentUserPhoto, lastLogin: Date.now() }, { merge: true }); } catch(e) {}
            document.getElementById('user-profile-pic').src = currentUserPhoto; document.getElementById('user-profile-pic').classList.remove('hidden');
            document.getElementById('settings-profile-pic').src = currentUserPhoto; document.getElementById('settings-user-name').innerText = currentUserName; document.getElementById('settings-user-email').innerText = currentUserEmail;
            if (currentUserUid === ADMIN_UID) document.getElementById('admin-overview-btn').classList.remove('hidden');
            await loadData();
            document.getElementById('login-view').classList.add('hidden'); document.getElementById('home-view').classList.remove('hidden');
            document.getElementById('logout-btn').classList.remove('hidden'); document.getElementById('app-footer').classList.remove('hidden');
            document.getElementById('header-title').innerText = currentUserName + "'s Jobs";
            viewingArchives = false; renderJobs();
        } else {
            currentUserUid = null; document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('home-view').classList.add('hidden'); document.getElementById('job-detail-view').classList.add('hidden');
            document.getElementById('logout-btn').classList.add('hidden'); document.getElementById('user-profile-pic').classList.add('hidden');
            document.getElementById('app-footer').classList.add('hidden'); document.getElementById('header-title').innerText = "Job Tracker";
        }
    });
}
// --- SECURE CLOUD LOAD & SAVE ---
async function loadData() { 
    if (!currentUserUid) return;
    jobs = []; teamMembers = [];
    const qJobs = query(collection(db, "jobs"), where("ownerUid", "==", currentUserUid));
    const snapJobs = await getDocs(qJobs);
    snapJobs.forEach((doc) => {
        let data = doc.data(); data.firebaseId = doc.id; 
        if(!data.tasks) data.tasks = [];
        if(typeof data.isArchived === 'undefined') data.isArchived = false; 
        jobs.push(data);
    });
    jobs.sort((a,b) => a.id - b.id); 
    const qTeam = query(collection(db, "team"), where("ownerUid", "==", currentUserUid));
    const snapTeam = await getDocs(qTeam);
    snapTeam.forEach((doc) => {
        let data = doc.data(); data.firebaseId = doc.id;
        teamMembers.push(data);
    });
}

async function saveData() { 
    if (!currentUserUid) return;
    for (const job of jobs) {
        const docId = job.firebaseId || job.id.toString();
        await setDoc(doc(db, "jobs", docId), { ...job, ownerUid: currentUserUid });
    }
    for (const member of teamMembers) {
        const docId = member.firebaseId || member.name.replace(/[^a-zA-Z0-9]/g, '');
        await setDoc(doc(db, "team", docId), { ...member, ownerUid: currentUserUid });
    }
}

// --- CALENDAR LOGIC (ROBUST REDIRECT) ---
function createCalendarLink(title, startDate, startTime, description) {
    let startDateTime = ''; let endDateTime = '';
    let startTimeMs = 0; let endTimeMs = 0;

    if (startDate && startTime) {
        const [year, month, day] = startDate.split('-');
        const [hour, minute] = startTime.split(':');
        const localDate = new Date(year, month - 1, day, hour, minute);
        const localEndDate = new Date(localDate.getTime() + (60 * 60 * 1000));
        startTimeMs = localDate.getTime(); endTimeMs = localEndDate.getTime();
        startDateTime = localDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
        endDateTime = localEndDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
    } else if (startDate) {
        const [year, month, day] = startDate.split('-');
        const localDate = new Date(year, month - 1, day);
        const endDate = new Date(year, month - 1, day); endDate.setDate(endDate.getDate() + 1);
        startTimeMs = localDate.getTime(); endTimeMs = endDate.getTime();
        startDateTime = `${year}${month}${day}`;
        endDateTime = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`;
    } else {
        const today = new Date(); startTimeMs = today.getTime(); endTimeMs = startTimeMs + (3600000);
        startDateTime = today.toISOString().replace(/-|:|\.\d\d\d/g, "");
        endDateTime = new Date(startTimeMs + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, "");
    }

    const safeTitle = encodeURIComponent("Job Tracker: " + title);
    const safeDesc = encodeURIComponent(description || "");
    const isAndroid = /Android/i.test(navigator.userAgent);

    let finalUrl = "";
    if (isAndroid) {
        // Force the Intent via anchor tag simulation
        finalUrl = `intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/event;S.title=${safeTitle};S.description=${safeDesc};l.beginTime=${startTimeMs};l.endTime=${endTimeMs};end;`;
    } else {
        finalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${safeTitle}&dates=${startDateTime}/${endDateTime}&details=${safeDesc}`;
    }

    // CREATE HIDDEN LINK AND CLICK IT (Satisfies Chrome's User-Gesture requirement)
    const link = document.createElement('a');
    link.href = finalUrl;
    if (!isAndroid) link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- APP NAVIGATION & RENDERING ---
function renderJobs() {
    const container = document.getElementById('jobs-container');
    container.innerHTML = '';
    const displayJobs = jobs.filter(j => viewingArchives ? j.isArchived : !j.isArchived);
    displayJobs.forEach((job) => {
        const card = document.createElement('div');
        card.className = 'card'; card.onclick = () => viewJob(job.id);
        card.innerHTML = `<h3>${job.title}</h3><p>${job.tasks ? job.tasks.length : 0} Tasks</p>`;
        container.appendChild(card);
    });
}

function viewJob(jobId) {
    currentJobId = jobId;
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.remove('hidden');
    renderTasks();
}

function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    const job = jobs.find(j => j.id === currentJobId);
    document.getElementById('current-job-title').innerText = job.title;
    job.tasks.forEach(task => {
        const div = document.createElement('div'); div.className = 'task-row';
        div.innerHTML = `<strong>${task.title}</strong><br><small>${task.dueDate || ''}</small>`;
        container.appendChild(div);
    });
}

// --- GLOBAL HELPERS ---
window.loginWithGoogle = async () => { try { await signInWithPopup(auth, googleProvider); } catch(e) { alert(e.message); } };
window.logout = () => signOut(auth);
window.goHome = () => { document.getElementById('home-view').classList.remove('hidden'); document.getElementById('job-detail-view').classList.add('hidden'); renderJobs(); };
window.openAddJobModal = () => document.getElementById('add-job-modal').classList.remove('hidden');
window.closeAddJobModal = () => document.getElementById('add-job-modal').classList.add('hidden');
window.saveNewJob = async () => {
    const title = document.getElementById('add-job-title').value;
    jobs.push({ id: Date.now(), title, tasks: [], isArchived: false });
    await saveData(); closeAddJobModal(); renderJobs();
};
window.openJobCalendarTemplate = () => {
    const title = document.getElementById('add-job-title').value;
    const date = document.getElementById('add-job-date').value;
    const time = document.getElementById('add-job-time').value;
    createCalendarLink(title, date, time, "Job Start");
};
window.openTaskCalendarTemplate = () => {
    const title = document.getElementById('new-task-title').value;
    const date = document.getElementById('new-task-date').value;
    const time = document.getElementById('new-task-time').value;
    createCalendarLink(title, date, time, "Task Due");
};
window.addTask = async () => {
    const title = document.getElementById('new-task-title').value;
    const date = document.getElementById('new-task-date').value;
    const job = jobs.find(j => j.id === currentJobId);
    job.tasks.push({ title, dueDate: date });
    await saveData(); renderTasks();
};
