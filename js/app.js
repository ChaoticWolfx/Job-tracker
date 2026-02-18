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
                    
                    container.innerHTML += `
                        <div style="background:var(--light-gray); padding:15px; border-radius:6px; margin-bottom:10px; border:1px solid var(--border-color);">
                            <strong>${task.title}</strong> <span style="color:${color}; font-size:12px; font-weight:bold; float:right;">[${task.status}]</span>
                            ${desc}${asgn}${dateStr}
                        </div>
                    `;
                });
            }
        } else {
            alert("This job link is invalid or is no longer being shared.");
            window.location.href = window.location.pathname; 
        }
    } catch (e) {
        alert("Error loading shared job. It may be private or deleted.");
        window.location.href = window.location.pathname;
    }
}

// --- THEME LOGIC ---
function loadThemePreference() {
    const isDark = localStorage.getItem('jobTrackerDarkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('dark-mode-toggle');
        if(toggle) toggle.checked = true;
    }
}
function toggleDarkMode() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    if (isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('jobTrackerDarkMode', 'true');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('jobTrackerDarkMode', 'false');
    }
}
loadThemePreference();

// --- AUTHENTICATION STATE OBSERVER ---
if (!sharedJobId) { 
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            currentUserEmail = user.email;
            currentUserName = user.displayName || user.email.split('@')[0]; 
            
            currentUserPhoto = user.photoURL || `https://ui-avatars.com/api/?name=${currentUserName}&background=random`;
            
            try {
                await setDoc(doc(db, "users", currentUserUid), {
                    uid: currentUserUid,
                    name: currentUserName,
                    email: currentUserEmail,
                    photoURL: currentUserPhoto,
                    lastLogin: Date.now()
                }, { merge: true });
            } catch(e) { console.error("Could not save user profile:", e); }

            document.getElementById('user-profile-pic').src = currentUserPhoto;
            document.getElementById('user-profile-pic').classList.remove('hidden');
            document.getElementById('settings-profile-pic').src = currentUserPhoto;
            document.getElementById('settings-user-name').innerText = currentUserName;
            document.getElementById('settings-user-email').innerText = currentUserEmail;

            if (currentUserUid === ADMIN_UID) {
                document.getElementById('admin-overview-btn').classList.remove('hidden');
            } else {
                document.getElementById('admin-overview-btn').classList.add('hidden');
            }

            await loadData();
            
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('home-view').classList.remove('hidden');
            document.getElementById('logout-btn').classList.remove('hidden');
            document.getElementById('app-footer').classList.remove('hidden');
            document.getElementById('header-title').innerText = currentUserName + "'s Jobs";
            
            viewingArchives = false;
            renderJobs();
        } else {
            currentUserUid = null;
            currentUserName = null;
            currentUserPhoto = null;
            jobs = [];
            teamMembers = [];
            
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('home-view').classList.add('hidden');
            document.getElementById('job-detail-view').classList.add('hidden');
            document.getElementById('logout-btn').classList.add('hidden');
            document.getElementById('user-profile-pic').classList.add('hidden');
            document.getElementById('app-footer').classList.add('hidden');
            document.getElementById('admin-overview-btn').classList.add('hidden');
            document.getElementById('header-title').innerText = "Job Tracker";
        }
    });
}

// --- LOGIN COMMANDS ---
async function loginWithEmail() {
    const email = document.getElementById('email-input').value.trim();
    const pass = document.getElementById('password-input').value;
    if(!email || !pass) return alert("Please enter email and password.");
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch(e) { alert("Login failed: " + e.message); }
}

async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch(e) { alert("Google login failed: " + e.message); }
}

async function logout() { await signOut(auth); }

// --- SETTINGS MODAL ---
function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

// --- SECURE CLOUD LOAD LOGIC ---
async function loadData() { 
    if (!currentUserUid) return;
    jobs = [];
    teamMembers = [];

    const qJobs = query(collection(db, "jobs"), where("ownerUid", "==", currentUserUid));
    const querySnapshotJobs = await getDocs(qJobs);
    querySnapshotJobs.forEach((doc) => {
        let data = doc.data();
        data.firebaseId = doc.id; 
        if(!data.id) data.id = data.createdAt || Date.now(); 
        if(!data.tasks) data.tasks = [];
        
        if(typeof data.isArchived === 'undefined') data.isArchived = false; 
        if(typeof data.isShared === 'undefined') data.isShared = false;
        
        jobs.push(data);
    });
    jobs.sort((a,b) => a.id - b.id); 

    const qTeam = query(collection(db, "team"), where("ownerUid", "==", currentUserUid));
    const querySnapshotTeam = await getDocs(qTeam);
    querySnapshotTeam.forEach((doc) => {
        let data = doc.data();
        data.firebaseId = doc.id;
        teamMembers.push(data);
    });
}

async function saveData() { 
    if (!currentUserUid) return;

    for (const job of jobs) {
        const docId = job.firebaseId || job.id.toString();
        await setDoc(doc(db, "jobs", docId), { ...job, owner: currentUserName, ownerUid: currentUserUid });
    }

    for (const member of teamMembers) {
        const docId = member.firebaseId || member.name.replace(/[^a-zA-Z0-9]/g, '');
        await setDoc(doc(db, "team", docId), { ...member, owner: currentUserName, ownerUid: currentUserUid });
    }
}

// --- Helper Functions ---
function getAssigneeText(name) {
    if (!name) return '';
    const member = teamMembers.find(m => m.name === name);
    if (member && member.role) return `${name} (${member.role})`;
    return name;
}

function goHome() {
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('job-detail-view').classList.add('hidden');
    renderJobs();
}

function viewJob(jobId) {
    currentJobId = jobId;
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.remove('hidden');
    populateDropdowns();
    renderTasks();
}

// --- Team Management ---
function openTeamModal() { renderTeamList(); document.getElementById('team-modal').classList.remove('hidden'); }
function closeTeamModal() { document.getElementById('team-modal').classList.add('hidden'); }

async function addTeamMember() {
    const nameInput = document.getElementById('new-team-member');
    const roleInput = document.getElementById('new-team-role');
    const name = nameInput.value.trim();
    const role = roleInput.value.trim() || 'Team Member';
    
    if(name) {
        const exists = teamMembers.find(m => m.name.toLowerCase() === name.toLowerCase());
        if(!exists) { 
            teamMembers.push({name: name, role: role}); 
            renderTeamList(); 
            await saveData(); 
        }
        nameInput.value = ''; roleInput.value = '';
    }
}
async function removeTeamMember(index) { 
    const member = teamMembers[index];
    const docId = member.firebaseId || member.name.replace(/[^a-zA-Z0-9]/g, '');
    await deleteDoc(doc(db, "team", docId)); 
    teamMembers.splice(index, 1); 
    renderTeamList(); 
}

function renderTeamList() {
    const list = document.getElementById('team-list');
    list.innerHTML = '';
    if(teamMembers.length === 0) list.innerHTML = '<li style="color:var(--gray); font-size:14px;">No team members added.</li>';
    teamMembers.forEach((member, index) => {
        list.innerHTML += `<li style="display:flex; justify-content:space-between; align-items: center; margin-bottom:10px; padding:10px; background:var(--light-gray); border-radius:6px;">
            <div><strong>${member.name}</strong> <br><span style="font-size:12px; color:var(--gray);">${member.role}</span></div>
            <button onclick="removeTeamMember(${index})" style="color:red; background:none; border:none; font-weight:bold; cursor:pointer; font-size:16px;">X</button>
        </li>`;
    });
}

function populateDropdowns() {
    let optionsHTML = '<option value="">Unassigned</option>';
    teamMembers.forEach(member => { optionsHTML += `<option value="${member.name}">${member.name} (${member.role})</option>`; });
    
    const jobDropdown = document.getElementById('add-job-assignee');
    const taskDropdown = document.getElementById('new-task-assignee');
    if(jobDropdown) jobDropdown.innerHTML = optionsHTML;
    if(taskDropdown) taskDropdown.innerHTML = optionsHTML;
}
// --- Order Up/Down Functions ---
async function moveJob(jobId, direction) {
    const index = jobs.findIndex(j => j.id === jobId);
    if (index < 0) return;
    
    let targetIndex = -1;
    if (direction === 'up') {
        for(let i = index - 1; i >= 0; i--) { if (jobs[i].isArchived === jobs[index].isArchived) { targetIndex = i; break; } }
    } else {
        for(let i = index + 1; i < jobs.length; i++) { if (jobs[i].isArchived === jobs[index].isArchived) { targetIndex = i; break; } }
    }
    
    if (targetIndex !== -1) {
        const temp = jobs[index];
        jobs[index] = jobs[targetIndex];
        jobs[targetIndex] = temp;
        renderJobs(); await saveData(); 
    }
}

async function moveTask(taskId, direction) {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === taskId);
    
    if (direction === 'up' && taskIndex > 0) {
        const temp = jobs[jobIndex].tasks[taskIndex];
        jobs[jobIndex].tasks[taskIndex] = jobs[jobIndex].tasks[taskIndex-1];
        jobs[jobIndex].tasks[taskIndex-1] = temp;
    } else if (direction === 'down' && taskIndex < jobs[jobIndex].tasks.length - 1) {
        const temp = jobs[jobIndex].tasks[taskIndex];
        jobs[jobIndex].tasks[taskIndex] = jobs[jobIndex].tasks[taskIndex+1];
        jobs[jobIndex].tasks[taskIndex+1] = temp;
    }
    renderTasks(); await saveData(); 
}

// --- NEW: SMART GOOGLE CALENDAR LINK GENERATOR ---
function createCalendarLink(title, startDate, startTime, description) {
    let startDateTime = '';
    let endDateTime = '';
    let startTimeMs = 0;
    let endTimeMs = 0;

    if (startDate && startTime) {
        const [year, month, day] = startDate.split('-');
        const [hour, minute] = startTime.split(':');
        const localDate = new Date(year, month - 1, day, hour, minute);
        const localEndDate = new Date(localDate.getTime() + (60 * 60 * 1000)); // Add 1 hour
        
        // Save exact milliseconds for the Android Native App
        startTimeMs = localDate.getTime();
        endTimeMs = localEndDate.getTime();
        
        startDateTime = localDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
        endDateTime = localEndDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
    } else if (startDate) {
        const [year, month, day] = startDate.split('-');
        const localDate = new Date(year, month - 1, day);
        const endDate = new Date(year, month - 1, day);
        endDate.setDate(endDate.getDate() + 1);
        
        startTimeMs = localDate.getTime();
        endTimeMs = endDate.getTime();
        
        startDateTime = `${year}${month}${day}`;
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDate.getDate()).padStart(2, '0');
        endDateTime = `${endYear}${endMonth}${endDay}`;
    } else {
        const today = new Date();
        startTimeMs = today.getTime();
        endTimeMs = startTimeMs + (60 * 60 * 1000);
        
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        startDateTime = `${year}${month}${day}`;
        endDateTime = startDateTime;
    }

    const safeTitle = encodeURIComponent("Job Tracker: " + title);
    const safeDesc = encodeURIComponent(description || "Added via Job Tracker App");

    // --- SMART DEVICE DETECTION ---
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
        // TRUE NATIVE ANDROID INTENT
        // This bypasses the web entirely and forces the phone's OS to open the Calendar App
        const intentUrl = `intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/event;S.title=${safeTitle};S.description=${safeDesc};l.beginTime=${startTimeMs};l.endTime=${endTimeMs};end;`;
        window.location.href = intentUrl;
    } else {
        // Web fallback for iOS and Desktop
        const webUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${safeTitle}&dates=${startDateTime}/${endDateTime}&details=${safeDesc}`;
        window.open(webUrl, '_blank');
    }
}

function openJobCalendarTemplate() {
    const title = document.getElementById('add-job-title').value.trim();
    const date = document.getElementById('add-job-date').value;
    const time = document.getElementById('add-job-time').value;
    
    if (!title) return alert("Please enter a Job Title first so we can add it to the calendar!");
    createCalendarLink(title, date, time, "Job Start Date");
}

function openTaskCalendarTemplate() {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const date = document.getElementById('new-task-date').value;
    const time = document.getElementById('new-task-time').value;
    
    if (!title) return alert("Please enter a Task Name first so we can add it to the calendar!");
    createCalendarLink(title, date, time, desc);
}

// --- Jobs Logic ---
function toggleArchives() {
    viewingArchives = !viewingArchives;
    const btn = document.getElementById('toggle-archive-btn');
    btn.innerText = viewingArchives ? "Show Active" : "Show Archives";
    btn.style.background = viewingArchives ? "var(--warning)" : "var(--light-gray)";
    renderJobs();
}

function renderJobs() {
    const container = document.getElementById('jobs-container');
    container.innerHTML = '';
    const displayJobs = jobs.filter(j => viewingArchives ? j.isArchived : !j.isArchived);

    if(displayJobs.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--gray); margin-top:20px;">${viewingArchives ? "No archived jobs." : "No active jobs."}</p>`;
        return;
    }

    displayJobs.forEach((job) => {
        const total = job.tasks ? job.tasks.length : 0;
        const completed = job.tasks ? job.tasks.filter(t => t.status === 'Complete').length : 0;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        
        let badges = '';
        if(job.priority === 'High') badges += `<span class="badge badge-High">High Priority</span> `;
        if(job.priority === 'Low') badges += `<span class="badge badge-Low">Low Priority</span> `;
        if(job.assignedTo) badges += `<span class="badge badge-Assignee">👷 ${getAssigneeText(job.assignedTo)}</span>`;
        if(job.startDate) badges += `<span class="badge" style="background:var(--light-gray); color:var(--text); border:1px solid var(--border-color);">📅 Start: ${job.startDate} ${job.startTime ? job.startTime : ''}</span>`;

        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => viewJob(job.id);
        card.style.opacity = job.isArchived ? '0.7' : '1';
        
        card.innerHTML = `
            <div style="position:absolute; top:12px; right:12px; display:flex; gap:5px;">
                <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid var(--border-color); color: var(--text);" onclick="event.stopPropagation(); moveJob(${job.id}, 'up')">⬆️</button>
                <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid var(--border-color); color: var(--text);" onclick="event.stopPropagation(); moveJob(${job.id}, 'down')">⬇️</button>
                <button class="btn-danger btn-small" onclick="event.stopPropagation(); deleteJobFromHome(${job.id})" style="padding: 2px 8px; font-size:12px;">X</button>
            </div>
            ${badges ? `<div style="margin-bottom:8px; padding-right: 90px; display:flex; flex-wrap:wrap; gap:5px;">${badges}</div>` : ''}
            <h3 style="padding-right: 90px;">${job.title || 'Untitled Job'} ${job.isArchived ? '(Archived)' : ''}</h3>
            <p style="color: var(--gray); font-size: 14px; margin-top: 5px;">${total > 0 ? `${completed}/${total} Tasks Done` : 'No tasks'}</p>
            <div class="progress-container"><div class="progress-fill" style="width: ${percent}%;"></div></div>
        `;
        container.appendChild(card);
    });
}

function openAddJobModal() {
    populateDropdowns();
    document.getElementById('add-job-title').value = '';
    document.getElementById('add-job-priority').value = 'Normal';
    document.getElementById('add-job-date').value = '';
    document.getElementById('add-job-time').value = '';
    document.getElementById('add-job-modal').classList.remove('hidden');
}

function closeAddJobModal() { document.getElementById('add-job-modal').classList.add('hidden'); }

async function saveNewJob() {
    const title = document.getElementById('add-job-title').value.trim();
    const priority = document.getElementById('add-job-priority').value;
    const assignee = document.getElementById('add-job-assignee').value;
    const startDate = document.getElementById('add-job-date').value;
    const startTime = document.getElementById('add-job-time').value;

    if (!title) { alert("Please enter a job title."); return; }

    jobs.push({ 
        id: Date.now(), 
        title: title, 
        priority: priority, 
        assignedTo: assignee, 
        startDate: startDate,
        startTime: startTime,
        tasks: [], 
        isArchived: false, 
        isShared: false 
    });
    
    if(viewingArchives) { viewingArchives = false; document.getElementById('toggle-archive-btn').innerText = "Show Archives"; document.getElementById('toggle-archive-btn').style.background = "var(--light-gray)"; }
    
    closeAddJobModal(); renderJobs(); await saveData(); 
}

// --- SHARE LINK LOGIC ---
async function shareCurrentJob() {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    if(jobIndex < 0) return;
    
    jobs[jobIndex].isShared = true;
    await saveData(); 
    
    const firebaseId = jobs[jobIndex].firebaseId || jobs[jobIndex].id.toString();
    const shareUrl = window.location.origin + window.location.pathname + '?job=' + firebaseId;
    
    try {
        await navigator.clipboard.writeText(shareUrl);
        alert("🔗 Link copied to clipboard! Anyone with this link can view a read-only version of this job.");
    } catch (err) {
        alert("Share this link to grant Read-Only access: \n\n" + shareUrl);
    }
}

async function deleteJobFromHome(jobId) {
    if(confirm("PERMANENTLY delete this job and all tasks?")) {
        const job = jobs.find(j => j.id === jobId);
        const docId = job.firebaseId || job.id.toString();
        await deleteDoc(doc(db, "jobs", docId)); 
        jobs = jobs.filter(j => j.id !== jobId); 
        renderJobs();
    }
}

async function archiveCurrentJob() {
    if(!confirm("Move this job to the Archives?")) return; 
    
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    jobs[jobIndex].isArchived = !jobs[jobIndex].isArchived; 
    goHome(); 
    await saveData();
}

async function deleteCurrentJob() {
    if(confirm("PERMANENTLY delete this job?")) {
        const job = jobs.find(j => j.id === currentJobId);
        const docId = job.firebaseId || job.id.toString();
        await deleteDoc(doc(db, "jobs", docId)); 
        jobs = jobs.filter(j => j.id !== currentJobId); 
        goHome();
    }
}

// --- Tasks Logic ---
function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    const job = jobs.find(j => j.id === currentJobId);

    document.getElementById('current-job-title').innerText = job.title || 'Untitled';
    document.getElementById('current-job-status').innerText = job.isArchived ? "Status: Archived" : "Status: Active";
    
    let topBadges = '';
    if(job.priority === 'High') topBadges += `<span class="badge badge-High">High Priority</span> `;
    if(job.priority === 'Low') topBadges += `<span class="badge badge-Low">Low Priority</span> `;
    if(job.assignedTo) topBadges += `<span class="badge badge-Assignee">Job Lead: ${getAssigneeText(job.assignedTo)}</span>`;
    if(job.startDate) topBadges += `<span class="badge" style="background:var(--light-gray); color:var(--text); border:1px solid var(--border-color);">📅 Start: ${job.startDate} ${job.startTime ? job.startTime : ''}</span>`;
    document.getElementById('current-job-badges').innerHTML = topBadges;

    if (!job.tasks) job.tasks = [];

    job.tasks.forEach((task, index) => {
        let dateDisplay = '';
        if (task.dueDate) {
            const [year, month, day] = task.dueDate.split('-');
            const taskDate = new Date(year, month - 1, day);
            const today = new Date(); today.setHours(0,0,0,0);
            const isPastDue = taskDate < today && task.status !== 'Complete';
            dateDisplay = `<div class="${isPastDue ? 'past-due' : ''}" style="margin-top: 5px; font-size: 14px;">
                <span style="display:inline-block; margin-right:5px;">📅</span>Due: ${task.dueDate} ${task.dueTime ? 'at ' + task.dueTime : ''} ${isPastDue ? '(Past Due!)' : ''}
            </div>`;
        }

        let badgeDisplay = '';
        if(task.priority === 'High') badgeDisplay += `<span class="badge badge-High" style="margin-bottom:0;">High</span> `;
        if(task.priority === 'Low') badgeDisplay += `<span class="badge badge-Low" style="margin-bottom:0;">Low</span> `;
        if(task.assignedTo) badgeDisplay += `<span class="badge badge-Assignee" style="margin-bottom:0;">👤 ${getAssigneeText(task.assignedTo)}</span>`;

        const taskEl = document.createElement('div');
        taskEl.className = `task-row task-${task.status.replace(' ', '-')}`;

        taskEl.innerHTML = `
            <div class="task-header" style="align-items:flex-start;">
                <div style="font-size: 18px; line-height:1.4; padding-right: 90px;">${badgeDisplay}<br>${task.title}</div>
                <div style="display:flex; gap:5px; position:absolute; top:12px; right:12px;">
                    <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid var(--border-color); color: var(--text);" onclick="event.stopPropagation(); moveTask(${task.id}, 'up')">⬆️</button>
                    <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid var(--border-color); color: var(--text);" onclick="event.stopPropagation(); moveTask(${task.id}, 'down')">⬇️</button>
                    <button class="btn-danger btn-small" style="padding: 2px 8px; font-size:12px;" onclick="event.stopPropagation(); deleteTask(${task.id})">X</button>
                </div>
            </div>
            ${task.desc ? `<p style="color: var(--gray); font-size: 15px;">${task.desc}</p>` : ''}
            ${dateDisplay}
            <select class="status-select" style="margin-top: 10px;" onchange="updateTaskStatus(${task.id}, this.value)">
                <option value="Not Started" ${task.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Complete" ${task.status === 'Complete' ? 'selected' : ''}>Complete</option>
            </select>
            <textarea class="notes-area" placeholder="Ongoing notes..." onchange="updateTaskNotes(${task.id}, this.value)" rows="2" style="margin-top: 10px;">${task.notes || ''}</textarea>
        `;
        container.appendChild(taskEl);
    });
}

async function addTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const priority = document.getElementById('new-task-priority').value;
    const assignee = document.getElementById('new-task-assignee').value;
    const dueDate = document.getElementById('new-task-date').value;
    const dueTime = document.getElementById('new-task-time').value;

    if (!title) return alert("Enter a task name.");
    
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    
    jobs[jobIndex].tasks.push({ 
        id: Date.now(), title: title, desc: desc, priority: priority, assignedTo: assignee, status: 'Not Started', notes: '', dueDate: dueDate, dueTime: dueTime
    });

    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-desc').value = '';
    document.getElementById('new-task-priority').value = 'Normal';
    document.getElementById('new-task-assignee').value = '';
    document.getElementById('new-task-date').value = '';
    document.getElementById('new-task-time').value = '';
    
    renderTasks(); await saveData(); 
}

async function updateTaskStatus(taskId, newStatus) {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === taskId);
    jobs[jobIndex].tasks[taskIndex].status = newStatus;
    renderTasks(); await saveData(); 
}
async function updateTaskNotes(taskId, notes) {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === taskId);
    jobs[jobIndex].tasks[taskIndex].notes = notes;
    await saveData();
}
async function deleteTask(taskId) {
    if(confirm("Remove this task?")) {
        const jobIndex = jobs.findIndex(j => j.id === currentJobId);
        jobs[jobIndex].tasks = jobs[jobIndex].tasks.filter(t => t.id !== taskId);
        renderTasks(); await saveData();
    }
}

// --- ADMIN USER MANAGEMENT ---
async function banUser(uid, userName) {
    if(!confirm(`Ban ${userName}? They will be immediately locked out of the app.`)) return;
    await setDoc(doc(db, "banned_users", uid), { bannedAt: Date.now(), name: userName });
    alert(`${userName} has been banned.`);
    openAllUsersJobsModal(); 
}

async function unbanUser(uid, userName) {
    if(!confirm(`Unban ${userName}?`)) return;
    await deleteDoc(doc(db, "banned_users", uid));
    alert(`${userName} has been unbanned.`);
    openAllUsersJobsModal(); 
}

async function deleteUserData(uid, userName) {
    if(!confirm(`⚠️ PERMANENTLY delete ALL jobs and team data for ${userName}? This CANNOT be undone.`)) return;
    
    const qJobs = query(collection(db, "jobs"), where("ownerUid", "==", uid));
    const snapJobs = await getDocs(qJobs);
    snapJobs.forEach(async (d) => await deleteDoc(doc(db, "jobs", d.id)));
    
    const qTeam = query(collection(db, "team"), where("ownerUid", "==", uid));
    const snapTeam = await getDocs(qTeam);
    snapTeam.forEach(async (d) => await deleteDoc(doc(db, "team", d.id)));
    
    alert(`All data for ${userName} has been permanently wiped from the cloud.`);
    openAllUsersJobsModal(); 
}

// --- CLOUD ADMIN OVERVIEW LOGIC WITH PROFILES & BANNING ---
async function openAllUsersJobsModal() {
    const container = document.getElementById('all-users-container');
    container.innerHTML = '<p style="text-align:center; color:var(--gray);">Fetching all company users and jobs...</p>';
    document.getElementById('all-users-modal').classList.remove('hidden');

    try {
        const bannedSnap = await getDocs(collection(db, "banned_users"));
        let bannedUids = [];
        bannedSnap.forEach(doc => bannedUids.push(doc.id));

        const usersSnap = await getDocs(collection(db, "users"));
        let allUsers = [];
        usersSnap.forEach(doc => allUsers.push(doc.data()));

        const jobsSnap = await getDocs(collection(db, "jobs"));
        let jobsByUid = {};
        adminViewJobs = []; 
        
        jobsSnap.forEach((doc) => {
            const data = doc.data();
            data.firebaseId = doc.id; 
            adminViewJobs.push(data); 

            const uid = data.ownerUid;
            if(uid) {
                if(!jobsByUid[uid]) jobsByUid[uid] = [];
                jobsByUid[uid].push(data);
            }
        });

        container.innerHTML = '';
        if (allUsers.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray); margin-top: 20px;">No users found. Log out and log back in to register your profile!</p>';
            return;
        }

        allUsers.forEach((userData) => {
            const userName = userData.name || "Unknown User";
            const userEmail = userData.email || "No email";
            const userUid = userData.uid;
            const userPhoto = userData.photoURL || `https://ui-avatars.com/api/?name=${userName}&background=random`;
            
            const userJobs = jobsByUid[userUid] || [];
            const activeJobs = userJobs.filter(j => !j.isArchived);
            
            const isBanned = bannedUids.includes(userUid);
            const banButtonHtml = isBanned ? 
                `<button class="btn-success btn-small" style="padding: 4px 10px;" onclick="unbanUser('${userUid}', '${userName}')">Unban</button>` : 
                `<button class="btn-warning btn-small" style="padding: 4px 10px;" onclick="banUser('${userUid}', '${userName}')">Ban</button>`;

            const userDiv = document.createElement('div');
            userDiv.style.marginBottom = '15px'; userDiv.style.border = '1px solid var(--border-color)'; userDiv.style.borderRadius = '8px'; userDiv.style.overflow = 'hidden';
            
            const userHeader = document.createElement('div');
            userHeader.style.background = 'var(--light-gray)'; userHeader.style.padding = '12px 15px'; userHeader.style.display = 'flex'; userHeader.style.flexDirection = 'column'; userHeader.style.gap = '10px';
            
            userHeader.innerHTML = `
                <div style="display: flex; justify-content: space-between; cursor: pointer; align-items: center;" id="toggle-${userUid}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${userPhoto}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
                        <div style="line-height: 1.2;">
                            <strong style="font-size: 15px;">${userName}</strong><br>
                            <span style="font-size: 12px; color: var(--gray); font-weight: normal;">${userEmail}</span>
                        </div>
                    </div>
                    <span style="color: var(--primary); font-weight: bold;">${activeJobs.length} Active ▼</span>
                </div>
                <div style="display: flex; gap: 5px; justify-content: flex-end; padding-top: 5px; border-top: 1px solid var(--border-color);">
                    ${banButtonHtml}
                    <button class="btn-danger btn-small" style="padding: 4px 10px;" onclick="deleteUserData('${userUid}', '${userName}')">Wipe Data</button>
                </div>
            `;
            
            const jobsListContainer = document.createElement('div');
            jobsListContainer.style.display = 'none'; jobsListContainer.style.background = 'var(--card-bg)';
            
            if (activeJobs.length === 0) {
                jobsListContainer.innerHTML = '<div style="padding:15px;"><em style="color: var(--gray); font-size: 14px;">User has not created any active jobs.</em></div>';
            } else {
                activeJobs.forEach(job => {
                    const tasks = job.tasks || [];
                    const completed = tasks.filter(t => t.status === 'Complete').length;
                    const total = tasks.length;
                    const jobRow = document.createElement('div'); jobRow.style.borderBottom = '1px solid var(--border-color)';
                    
                    const jobHeader = document.createElement('div');
                    jobHeader.style.padding = '12px 15px'; jobHeader.style.cursor = 'pointer'; jobHeader.style.display = 'flex'; jobHeader.style.justifyContent = 'space-between'; jobHeader.style.alignItems = 'center';
                    
                    jobHeader.innerHTML = `
                        <div style="flex: 1;">
                            <strong>${job.title || 'Untitled'}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▼</span>
                        </div>
                        <button class="btn-primary btn-small" style="margin:0; padding: 4px 10px; font-size: 12px; border-radius: 4px;" onclick="event.stopPropagation(); cloneJob('${job.firebaseId}')">📥 Import</button>
                    `;
                    
                    const taskList = document.createElement('div');
                    taskList.style.display = 'none'; taskList.style.padding = '10px 15px 15px 25px'; taskList.style.background = 'var(--bg-color)';
                    
                    if(total === 0) { taskList.innerHTML = '<em style="color:var(--gray); font-size:13px;">No tasks.</em>'; } 
                    else {
                        let tHtml = '<ul style="margin:0; padding-left:15px; font-size:14px; line-height:1.6;">';
                        tasks.forEach(t => {
                            let color = t.status === 'Complete' ? 'var(--success)' : (t.status === 'In Progress' ? 'var(--primary)' : 'var(--gray)');
                            let asgn = t.assignedTo ? ` (👤 ${t.assignedTo})` : '';
                            tHtml += `<li>${t.title}${asgn} <span style="color:${color}; font-size:12px;">[${t.status}]</span></li>`;
                        });
                        tHtml += '</ul>'; taskList.innerHTML = tHtml;
                    }

                    jobHeader.onclick = (e) => {
                        e.stopPropagation();
                        taskList.style.display = taskList.style.display === 'none' ? 'block' : 'none';
                    };
                    jobRow.appendChild(jobHeader); jobRow.appendChild(taskList); jobsListContainer.appendChild(jobRow);
                });
            }
            
            userHeader.querySelector(`#toggle-${userUid}`).onclick = () => {
                jobsListContainer.style.display = jobsListContainer.style.display === 'none' ? 'block' : 'none';
            };
            userDiv.appendChild(userHeader); userDiv.appendChild(jobsListContainer); container.appendChild(userDiv);
        });
    } catch (e) {
        container.innerHTML = `<p style="color: red; text-align: center; margin-top: 20px;">Error connecting to Cloud: ${e.message}</p>`;
    }
}
function closeAllUsersJobsModal() { document.getElementById('all-users-modal').classList.add('hidden'); }

// --- THE IMPORT/CLONE FUNCTION ---
async function cloneJob(firebaseId) {
    const originalJob = adminViewJobs.find(j => j.firebaseId === firebaseId);
    if(!originalJob) return;

    if(!confirm(`Import "${originalJob.title || 'Untitled'}" to your own job list?`)) return;

    const newJob = JSON.parse(JSON.stringify(originalJob));
    
    newJob.id = Date.now();
    newJob.firebaseId = newJob.id.toString(); 
    newJob.owner = currentUserName;
    newJob.ownerUid = currentUserUid;
    newJob.title = (newJob.title || 'Untitled') + " (Imported)";
    newJob.isShared = false; 
    
    if(newJob.tasks) {
        newJob.tasks.forEach((t, i) => {
            t.id = Date.now() + i + 1;
        });
    }

    jobs.push(newJob);
    
    alert(`"${newJob.title}" imported successfully! You can find it on your home screen.`);
    renderJobs();
    await saveData();
}

// --- PRINT LOGIC ---
function openPrintModal() { 
    document.getElementById('print-modal').classList.remove('hidden'); 
    document.getElementById('print-archive-toggle').checked = false; 
    
    const container = document.getElementById('print-job-selection');
    container.innerHTML = '';
    const includeArchives = document.getElementById('print-archive-toggle').checked;
    
    jobs.forEach(job => {
        if (!includeArchives && job.isArchived) return;
        container.innerHTML += `<label style="display:block; margin-bottom:10px; font-size:16px;">
            <input type="checkbox" class="print-job-cb" value="${job.id}" checked style="width:auto; margin-right:8px; transform: scale(1.2);"> 
            ${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}
        </label>`;
    });

    generatePrintPreview(); 
}

function closePrintModal() { document.getElementById('print-modal').classList.add('hidden'); }

function generatePrintPreview() {
    const checkboxes = document.querySelectorAll('.print-job-cb');
    const selectedJobIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
    
    const printArea = document.getElementById('print-preview-area');
    const dateStr = new Date().toLocaleDateString();
    
    let html = `<h2>${currentUserName}'s Job List</h2><p style="margin-bottom: 20px;">Generated: ${dateStr}</p><hr style="margin-bottom: 20px;">`;
    const jobsToPrint = jobs.filter(j => selectedJobIds.includes(j.id));
    
    if(jobsToPrint.length === 0) { html += `<p>No jobs selected to print.</p>`; } 
    else {
        jobsToPrint.forEach(job => {
            let jPriority = job.priority === 'High' ? '[HIGH PRIORITY] ' : '';
            let jAssignee = job.assignedTo ? ` (Lead: ${getAssigneeText(job.assignedTo)})` : '';
            let jDate = job.startDate ? `<br><span style="font-size: 14px; color: #d9534f;">Start: ${job.startDate} ${job.startTime ? job.startTime : ''}</span>` : '';
            html += `<div style="margin-bottom: 25px;"><h3 style="font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">${jPriority}${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}${jAssignee}</h3>${jDate}`;
            
            if(!job.tasks || job.tasks.length === 0) { html += `<p style="margin-left:15px;">No tasks.</p>`; } 
            else {
                html += `<ul style="margin-left: 25px; list-style-type: square; line-height: 1.6;">`;
                job.tasks.forEach(task => {
                    let tPriority = task.priority === 'High' ? '<strong style="color:red;">[HIGH]</strong> ' : '';
                    let tAssignee = task.assignedTo ? ` <span style="color:blue;">(👤 ${getAssigneeText(task.assignedTo)})</span>` : '';
                    html += `<li style="margin-bottom: 10px;">${tPriority}<strong>${task.title}</strong>${tAssignee} - Status: <em>${task.status}</em>`;
                    if (task.desc) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #555;">Desc: ${task.desc}</span>`;
                    if (task.dueDate) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #d9534f;">Due: ${task.dueDate} ${task.dueTime ? task.dueTime : ''}</span>`;
                    if (task.notes) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #666;">Notes: ${task.notes}</span>`;
                    html += `</li>`;
                });
                html += `</ul>`;
            }
            html += `</div>`;
        });
    }
    printArea.innerHTML = html;
}

function printSingleJob() {
    const job = jobs.find(j => j.id === currentJobId);
    if(!job) return;
    
    const printArea = document.getElementById('real-print-area');
    const dateStr = new Date().toLocaleDateString();
    
    let html = `<h2>Job Detail Report</h2><p style="margin-bottom: 20px;">Generated: ${dateStr}</p><hr style="margin-bottom: 20px;">`;
    let jPriority = job.priority === 'High' ? '[HIGH PRIORITY] ' : '';
    let jAssignee = job.assignedTo ? ` (Lead: ${getAssigneeText(job.assignedTo)})` : '';
    let jDate = job.startDate ? `<br><span style="font-size: 14px; color: #d9534f;">Start: ${job.startDate} ${job.startTime ? job.startTime : ''}</span>` : '';
    html += `<div style="margin-bottom: 25px;"><h3 style="font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">${jPriority}${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}${jAssignee}</h3>${jDate}`;
    
    if(!job.tasks || job.tasks.length === 0) { html += `<p style="margin-left:15px;">No tasks.</p>`; } 
    else {
        html += `<ul style="margin-left: 25px; list-style-type: square; line-height: 1.6;">`;
        job.tasks.forEach(task => {
            let tPriority = task.priority === 'High' ? '<strong style="color:red;">[HIGH]</strong> ' : '';
            let tAssignee = task.assignedTo ? ` <span style="color:blue;">(👤 ${getAssigneeText(task.assignedTo)})</span>` : '';
            html += `<li style="margin-bottom: 10px;">${tPriority}<strong>${task.title}</strong>${tAssignee} - Status: <em>${task.status}</em>`;
            if (task.desc) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #555;">Desc: ${task.desc}</span>`;
            if (task.dueDate) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #d9534f;">Due: ${task.dueDate} ${task.dueTime ? task.dueTime : ''}</span>`;
            if (task.notes) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #666;">Notes: ${task.notes}</span>`;
            html += `</li>`;
        });
        html += `</ul>`;
    }
    html += `</div>`;
    
    printArea.innerHTML = html;
    printArea.classList.remove('hidden'); 
    setTimeout(() => { 
        window.print(); 
        printArea.classList.add('hidden'); 
    }, 100);
}

function executePrint() { 
    const printArea = document.getElementById('real-print-area');
    printArea.innerHTML = document.getElementById('print-preview-area').innerHTML; 
    printArea.classList.remove('hidden'); 
    setTimeout(() => { 
        window.print(); 
        printArea.classList.add('hidden'); 
    }, 100); 
}

// --- MODAL LOGIC FOR ABOUT & WEB-FETCH CHANGELOG ---
function openAboutModal() { document.getElementById('about-modal').classList.remove('hidden'); }
function closeAboutModal() { document.getElementById('about-modal').classList.add('hidden'); }

const logFilesList = ['v2_4', 'v2_3', 'v2_2', 'v2_1', 'v2_0', 'v1_16', 'v1_15', 'v1_14', 'v1_13', 'v1_12', 'v1_11', 'v1_10', 'v1_9', 'v1_8', 'v1_7', 'v1_6', 'v1_5', 'v1_4', 'v1_3', 'v1_2', 'v1_1', 'v1_0'];
let currentLogIndex = 0;

function openChangelogModal() {
    document.getElementById('changelog-modal').classList.remove('hidden');
    if (currentLogIndex === 0) { document.getElementById('changelog-container').innerHTML = ''; loadMoreLogs(); }
}
function closeChangelogModal() { document.getElementById('changelog-modal').classList.add('hidden'); }

async function loadMoreLogs() {
    const container = document.getElementById('changelog-container');
    let loadedThisTime = 0;
    
    while (loadedThisTime < 2 && currentLogIndex < logFilesList.length) {
        const versionName = logFilesList[currentLogIndex];
        try {
            const response = await fetch(`log/${versionName}.txt`);
            if (!response.ok) throw new Error("File not found");
            const text = await response.text();
            const lines = text.split('\n');
            let html = `<div style="margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">`;
            html += `<h3 class="version-title">${lines[0] || versionName}</h3><ul class="changelog-list">`;
            for(let i = 1; i < lines.length; i++) {
                if(lines[i].trim() !== '') { html += `<li>${lines[i].replace('-', '').trim()}</li>`; }
            }
            html += `</ul></div>`;
            container.innerHTML += html;
        } catch (e) {
            container.innerHTML += `
                <div style="margin-bottom: 20px; padding: 10px; background: #ffe6e6; border-left: 4px solid red; color: #333;">
                    <strong>Failed to load ${versionName}.txt</strong><br>
                    <span style="font-size: 12px; color: #cc0000;">Make sure log/${versionName}.txt exists in your GitHub repository!</span>
                </div>`;
        }
        currentLogIndex++; loadedThisTime++;
    }
    
    if (currentLogIndex >= logFilesList.length) { document.getElementById('load-more-logs-btn').classList.add('hidden'); }
    else { document.getElementById('load-more-logs-btn').classList.remove('hidden'); }
}

// Global functions for HTML
window.loginWithEmail = loginWithEmail;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.toggleDarkMode = toggleDarkMode;
window.openAllUsersJobsModal = openAllUsersJobsModal;
window.closeAllUsersJobsModal = closeAllUsersJobsModal;
window.cloneJob = cloneJob;
window.shareCurrentJob = shareCurrentJob;
window.openChangelogModal = openChangelogModal;
window.closeChangelogModal = closeChangelogModal;
window.loadMoreLogs = loadMoreLogs;
window.openAboutModal = openAboutModal;
window.closeAboutModal = closeAboutModal;
window.openAddJobModal = openAddJobModal;
window.closeAddJobModal = closeAddJobModal;
window.saveNewJob = saveNewJob;
window.openTeamModal = openTeamModal;
window.closeTeamModal = closeTeamModal;
window.addTeamMember = addTeamMember;
window.removeTeamMember = removeTeamMember;
window.toggleArchives = toggleArchives;
window.openPrintModal = openPrintModal;
window.closePrintModal = closePrintModal;
window.generatePrintPreview = generatePrintPreview;
window.printSingleJob = printSingleJob;
window.executePrint = executePrint;
window.goHome = goHome;
window.archiveCurrentJob = archiveCurrentJob;
window.deleteCurrentJob = deleteCurrentJob;
window.deleteJobFromHome = deleteJobFromHome;
window.moveJob = moveJob;
window.addTask = addTask;
window.deleteTask = deleteTask;
window.moveTask = moveTask;
window.updateTaskStatus = updateTaskStatus;
window.updateTaskNotes = updateTaskNotes;
window.viewJob = viewJob;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.deleteUserData = deleteUserData;
window.openJobCalendarTemplate = openJobCalendarTemplate;
window.openTaskCalendarTemplate = openTaskCalendarTemplate;
