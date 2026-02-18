import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpeJ6rGw24Mf_xcno9zj9Q6MQW-2HuuMA",
  authDomain: "jobtracker-4d6eb.firebaseapp.com",
  projectId: "jobtracker-4d6eb",
  storageBucket: "jobtracker-4d6eb.firebasestorage.app",
  messagingSenderId: "1074805891410",
  appId: "1:1074805891410:web:e4dde23db3ced1b9061a8b",
  measurementId: "G-PV9V64CJZ5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const ADMIN_UID = "7cX7BVQxqwMTrsX0NVH5hIruLBW2";

let currentUserUid = null, currentUserName = null, currentUserPhoto = null, jobs = [], teamMembers = [], adminViewJobs = [], currentJobId = null, viewingArchives = false;

// --- AUTH OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || user.email.split('@')[0];
        currentUserPhoto = user.photoURL || `https://ui-avatars.com/api/?name=${currentUserName}`;
        
        await setDoc(doc(db, "users", currentUserUid), { uid: currentUserUid, name: currentUserName, photoURL: currentUserPhoto, lastLogin: Date.now() }, { merge: true });
        
        document.getElementById('user-profile-pic').src = currentUserPhoto;
        document.getElementById('user-profile-pic').classList.remove('hidden');
        document.getElementById('settings-profile-pic').src = currentUserPhoto;
        document.getElementById('settings-user-name').innerText = currentUserName;
        
        if (currentUserUid === ADMIN_UID) document.getElementById('admin-overview-btn').classList.remove('hidden');
        
        await loadData();
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('home-view').classList.remove('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        document.getElementById('app-footer').classList.remove('hidden');
        renderJobs();
    } else {
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('home-view').classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
    }
});

// --- CLOUD DATA ---
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
// --- CALENDAR LOGIC (NATIVE INTENT) ---
function createCalendarLink(title, startDate, startTime, description) {
    let startDateTime = '', endDateTime = '', startTimeMs = 0, endTimeMs = 0;
    if (startDate && startTime) {
        const [y, m, d] = startDate.split('-'), [hr, min] = startTime.split(':');
        const local = new Date(y, m - 1, d, hr, min);
        const localEnd = new Date(local.getTime() + 3600000);
        startTimeMs = local.getTime(); endTimeMs = localEnd.getTime();
        startDateTime = local.toISOString().replace(/-|:|\.\d\d\d/g, "");
        endDateTime = localEnd.toISOString().replace(/-|:|\.\d\d\d/g, "");
    } else if (startDate) {
        const [y, m, d] = startDate.split('-');
        const local = new Date(y, m - 1, d);
        const end = new Date(local); end.setDate(end.getDate() + 1);
        startTimeMs = local.getTime(); endTimeMs = end.getTime();
        startDateTime = startDate.replace(/-/g, "");
        endDateTime = end.toISOString().split('T')[0].replace(/-/g, "");
    }

    const safeTitle = encodeURIComponent("Job Tracker: " + title);
    const safeDesc = encodeURIComponent(description || "");
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid && startTimeMs > 0) {
        const intentUrl = `intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/event;S.title=${safeTitle};S.description=${safeDesc};l.beginTime=${startTimeMs};l.endTime=${endTimeMs};end;`;
        const link = document.createElement('a'); link.href = intentUrl; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } else {
        const webUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${safeTitle}&dates=${startDateTime}/${endDateTime}&details=${safeDesc}`;
        window.open(webUrl, '_blank');
    }
}

// --- RENDERING LOGIC ---
function renderJobs() {
    const container = document.getElementById('jobs-container');
    container.innerHTML = '';
    const displayJobs = jobs.filter(j => viewingArchives ? j.isArchived : !j.isArchived);
    displayJobs.forEach(job => {
        const card = document.createElement('div'); card.className = 'card';
        card.onclick = () => viewJob(job.id);
        card.innerHTML = `<h3>${job.title}</h3><p>${job.tasks.length} Tasks</p>`;
        container.appendChild(card);
    });
}

function viewJob(jobId) {
    currentJobId = jobId;
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.remove('hidden');
    populateTeamDropdowns();
    renderTasks();
}

function renderTasks() {
    const container = document.getElementById('tasks-container'); container.innerHTML = '';
    const job = jobs.find(j => j.id === currentJobId);
    document.getElementById('current-job-title').innerText = job.title;
    job.tasks.forEach((t, i) => {
        const div = document.createElement('div'); div.className = 'task-row';
        div.innerHTML = `<strong>${t.title}</strong> - ${t.status} <button onclick="deleteTask(${i})" style="float:right; color:red; background:none; border:none;">X</button>`;
        container.appendChild(div);
    });
}

function populateTeamDropdowns() {
    const html = '<option value="">Unassigned</option>' + teamMembers.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    document.getElementById('new-task-assignee').innerHTML = html;
    document.getElementById('add-job-assignee').innerHTML = html;
}

// --- GLOBAL WINDOW ACTIONS ---
window.loginWithGoogle = () => signInWithPopup(auth, googleProvider);
window.logout = () => signOut(auth).then(() => location.reload());
window.goHome = () => { document.getElementById('home-view').classList.remove('hidden'); document.getElementById('job-detail-view').classList.add('hidden'); renderJobs(); };
window.openAddJobModal = () => { populateTeamDropdowns(); document.getElementById('add-job-modal').classList.remove('hidden'); };
window.closeAddJobModal = () => document.getElementById('add-job-modal').classList.add('hidden');
window.saveNewJob = async () => {
    const title = document.getElementById('add-job-title').value;
    const date = document.getElementById('add-job-date').value;
    const time = document.getElementById('add-job-time').value;
    jobs.push({ id: Date.now(), title, tasks: [], isArchived: false, startDate: date, startTime: time, ownerUid: currentUserUid });
    await saveData(); closeAddJobModal(); renderJobs();
};
window.addTask = async () => {
    const title = document.getElementById('new-task-title').value;
    const date = document.getElementById('new-task-date').value;
    const job = jobs.find(j => j.id === currentJobId);
    job.tasks.push({ title, dueDate: date, status: 'Not Started' });
    await saveData(); renderTasks();
};
window.deleteTask = async (index) => {
    const job = jobs.find(j => j.id === currentJobId);
    job.tasks.splice(index, 1); await saveData(); renderTasks();
};
window.archiveCurrentJob = async () => {
    const job = jobs.find(j => j.id === currentJobId);
    job.isArchived = true; await saveData(); goHome();
};
window.toggleArchives = () => { viewingArchives = !viewingArchives; document.getElementById('toggle-archive-btn').innerText = viewingArchives ? "Show Active" : "Show Archives"; renderJobs(); };
window.openTeamModal = () => { renderTeamList(); document.getElementById('team-modal').classList.remove('hidden'); };
window.closeTeamModal = () => document.getElementById('team-modal').classList.add('hidden');
window.addTeamMember = async () => {
    const name = document.getElementById('new-team-member').value;
    const role = document.getElementById('new-team-role').value;
    teamMembers.push({ name, role }); await saveData(); renderTeamList();
};
function renderTeamList() {
    document.getElementById('team-list').innerHTML = teamMembers.map(m => `<li>${m.name} (${m.role})</li>`).join('');
}
window.openJobCalendarTemplate = () => {
    createCalendarLink(document.getElementById('add-job-title').value, document.getElementById('add-job-date').value, document.getElementById('add-job-time').value, "Job Start");
};
window.openTaskCalendarTemplate = () => {
    createCalendarLink(document.getElementById('new-task-title').value, document.getElementById('new-task-date').value, document.getElementById('new-task-time').value, "Task Due");
};
window.openAllUsersJobsModal = async () => {
    const container = document.getElementById('all-users-container');
    container.innerHTML = 'Loading...'; document.getElementById('all-users-modal').classList.remove('hidden');
    const snap = await getDocs(collection(db, "jobs"));
    container.innerHTML = '';
    snap.forEach(doc => { container.innerHTML += `<p>${doc.data().title} (User: ${doc.data().ownerUid})</p>`; });
};
window.closeAllUsersJobsModal = () => document.getElementById('all-users-modal').classList.add('hidden');
window.openPrintModal = () => document.getElementById('print-modal').classList.remove('hidden');
window.closePrintModal = () => document.getElementById('print-modal').classList.add('hidden');
window.executePrint = () => window.print();
window.shareCurrentJob = () => {
    const firebaseId = jobs.find(j => j.id === currentJobId).firebaseId;
    const url = window.location.origin + window.location.pathname + '?job=' + firebaseId;
    navigator.clipboard.writeText(url); alert("Link copied!");
};
