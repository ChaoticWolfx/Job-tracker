// Import Firebase & Auth directly from the web
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
let sharedJobData = null; // Stored so the print function can access it cleanly

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
            sharedJobData = docSnap.data(); // Save for printing!
            document.getElementById('shared-job-view').classList.remove('hidden');
            document.getElementById('shared-job-title').innerText = sharedJobData.title || "Untitled Job";
            document.getElementById('shared-job-owner').innerText = "Created by: " + (sharedJobData.owner || "Unknown User");
            
            const container = document.getElementById('shared-tasks-container');
            container.innerHTML = '';
            
            if(!sharedJobData.tasks || sharedJobData.tasks.length === 0) {
                container.innerHTML = '<p style="color:var(--gray);">No tasks found.</p>';
            } else {
                sharedJobData.tasks.forEach(task => {
                    let isComplete = task.status === 'Complete';
                    let color = isComplete ? 'var(--success)' : (task.status === 'In Progress' ? 'var(--primary)' : 'var(--gray)');
                    let checkmark = isComplete ? '✅ ' : '';
                    let titleStyle = isComplete ? 'text-decoration: line-through; color: var(--gray);' : '';
                    let dateStr = task.dueDate ? `<br><span style="font-size:13px; color:#d9534f;">📅 Due: ${task.dueDate} ${task.dueTime ? 'at ' + task.dueTime : ''}</span>` : '';
                    let asgn = task.assignedTo ? `<br><span style="font-size:13px; color:var(--primary);">👤 ${task.assignedTo}</span>` : '';
                    let desc = task.desc ? `<p style="font-size:14px; color:var(--gray); margin-top:5px;">${task.desc}</p>` : '';
                    
                    container.innerHTML += `
                        <div style="background:var(--light-gray); padding:15px; border-radius:6px; margin-bottom:10px; border:1px solid var(--border-color);">
                            <strong style="${titleStyle}">${checkmark}${task.title}</strong> <span style="color:${color}; font-size:12px; font-weight:bold; float:right;">[${task.status}]</span>
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
                    uid: currentUserUid, name: currentUserName, email: currentUserEmail, photoURL: currentUserPhoto, lastLogin: Date.now()
                }, { merge: true });
            } catch(e) { console.error("Could not save user profile:", e); }

            document.getElementById('user-profile-pic').src = currentUserPhoto;
            document.getElementById('user-profile-pic').classList.remove('hidden');
            document.getElementById('settings-profile-pic').src = currentUserPhoto;
            document.getElementById('settings-user-name').innerText = currentUserName;
            document.getElementById('settings-user-email').innerText = currentUserEmail;

            if (currentUserUid === ADMIN_UID) document.getElementById('admin-overview-btn').classList.remove('hidden');
            else document.getElementById('admin-overview-btn').classList.add('hidden');

            await loadData();
            
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('home-view').classList.remove('hidden');
            document.getElementById('logout-btn').classList.remove('hidden');
            document.getElementById('app-footer').classList.remove('hidden');
            document.getElementById('header-title').innerText = currentUserName + "'s Jobs";
            
            viewingArchives = false; renderJobs();
        } else {
            currentUserUid = null; currentUserName = null; currentUserPhoto = null; jobs = []; teamMembers = [];
            
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('home-view').classList.add('hidden');
            document.getElementById('job-detail-view').classList.add('hidden');
            document.getElementById('logout-btn').classList.add('hidden');
            document.getElementById('user-profile-pic').classList.add('hidden');
            document.getElementById('app-footer').classList.add('hidden');
            document.getElementById('admin-overview-btn').classList.add('hidden');
            document.getElementById('header-title').innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: middle;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>Job Tracker`;
        }
    });
}

// --- LOGIN COMMANDS ---
async function loginWithEmail() {
    const email = document.getElementById('email-input').value.trim();
    const pass = document.getElementById('password-input').value;
    if(!email || !pass) return alert("Please enter email and password.");
    try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { alert("Login failed: " + e.message); }
}

async function loginWithGoogle() {
    try { await signInWithPopup(auth, googleProvider); } catch(e) { alert("Google login failed: " + e.message); }
}
async function logout() { await signOut(auth); }

// --- SETTINGS MODAL ---
function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

// --- SECURE CLOUD LOAD LOGIC ---
async function loadData() { 
    if (!currentUserUid) return;
    jobs = []; teamMembers = [];

    const qJobs = query(collection(db, "jobs"), where("ownerUid", "==", currentUserUid));
    const querySnapshotJobs = await getDocs(qJobs);
    querySnapshotJobs.forEach((doc) => {
        let data = doc.data(); data.firebaseId = doc.id; 
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
        let data = doc.data(); data.firebaseId = doc.id; teamMembers.push(data);
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
    currentJobId = null;
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('job-detail-view').classList.add('hidden');
    renderJobs();
}

function viewJob(jobId) {
    currentJobId = jobId;
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.remove('hidden');
    populateDropdowns(); renderTasks();
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
        if(!exists) { teamMembers.push({name: name, role: role}); renderTeamList(); await saveData(); }
        nameInput.value = ''; roleInput.value = '';
    }
}
async function removeTeamMember(index) { 
    const member = teamMembers[index];
    const docId = member.firebaseId || member.name.replace(/[^a-zA-Z0-9]/g, '');
    await deleteDoc(doc(db, "team", docId)); 
    teamMembers.splice(index, 1); renderTeamList(); 
}

function renderTeamList() {
    const list = document.getElementById('team-list'); list.innerHTML = '';
    if(teamMembers.length === 0) list.innerHTML = '<li style="color:var(--gray); font-size:14px;">No team members added.</li>';
    teamMembers.forEach((member, index) => {
        list.innerHTML += `<li style="display:flex; justify-content:space-between; align-items: center; margin-bottom:10px; padding:10px; background:var(--light-gray); border-radius:6px;">
            <div><strong>${member.name}</strong> <br><span style="font-size:12px; color:var(--gray);">${member.role}</span></div>
            <button class="btn-icon" onclick="removeTeamMember(${index})" style="color:red; font-weight:bold;">X</button>
        </li>`;
    });
}

function populateDropdowns() {
    let optionsHTML = '<option value="">Unassigned</option>';
    teamMembers.forEach(member => { optionsHTML += `<option value="${member.name}">${member.name} (${member.role})</option>`; });
    
    ['add-job-assignee', 'new-task-assignee', 'edit-job-assignee', 'edit-task-assignee'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = optionsHTML;
    });
}

// --- Jobs Logic & Drag-and-Drop ---
let jobSortable = null;

function toggleArchives() {
    viewingArchives = !viewingArchives;
    const btn = document.getElementById('toggle-archive-btn');
    btn.innerText = viewingArchives ? "Show Active" : "Show Archives";
    btn.style.background = viewingArchives ? "var(--warning)" : "var(--light-gray)";
    btn.style.color = viewingArchives ? "white" : "var(--text)";
    renderJobs();
}

function renderJobs() {
    const container = document.getElementById('jobs-container');
    container.innerHTML = '';
    const displayJobs = jobs.filter(j => viewingArchives ? j.isArchived : !j.isArchived);

    if(displayJobs.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--gray); margin-top:20px; padding: 20px;">${viewingArchives ? "No archived jobs." : "No active jobs."}</p>`;
        return;
    }

    displayJobs.forEach((job) => {
        const total = job.tasks ? job.tasks.length : 0;
        const completed = job.tasks ? job.tasks.filter(t => t.status === 'Complete').length : 0;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        
        // Dynamic Progress Bar Color Logic
        let barColor = 'var(--danger)'; // Default Red
        if (percent === 100) { barColor = 'var(--success)'; } // Green
        else if (percent >= 50) { barColor = 'var(--warning)'; } // Yellow
        
        // If there are zero tasks, make the bar grey
        if (total === 0) barColor = 'var(--gray)';

        let badges = '';
        if(job.priority === 'High') badges += `<span class="badge badge-High">High</span> `;
        if(job.priority === 'Low') badges += `<span class="badge badge-Low">Low</span> `;
        if(job.assignedTo) badges += `<span class="badge badge-Assignee">👷 ${getAssigneeText(job.assignedTo)}</span> `;
        if(job.startDate) badges += `<span class="badge" style="background:var(--light-gray); color:var(--text); border:1px solid var(--border-color);">📅 ${job.startDate}</span>`;

        const card = document.createElement('div');
        card.className = 'card'; 
        card.dataset.id = job.id;
        card.onclick = () => viewJob(job.id);
        card.style.opacity = job.isArchived ? '0.7' : '1';
        card.style.cursor = 'pointer';
        
        card.innerHTML = `
            <div style="position:absolute; top:15px; right:15px; display:flex; gap:5px; align-items:center;">
                <button class="btn-icon" onclick="event.stopPropagation(); deleteJobFromHome(${job.id})" title="Delete Job" style="color: var(--danger);">🗑️</button>
                <span class="drag-handle" title="Drag to reorder" onclick="event.stopPropagation()">☰</span>
            </div>
            ${badges ? `<div style="margin-bottom:10px; padding-right: 70px; display:flex; flex-wrap:wrap; gap:5px;">${badges}</div>` : ''}
            <h3 style="padding-right: 70px; margin: 0 0 5px 0;">${job.title || 'Untitled Job'} ${job.isArchived ? '(Archived)' : ''}</h3>
            <p style="color: var(--gray); font-size: 14px; margin: 0 0 10px 0;">${total > 0 ? `${completed}/${total} Tasks Done (${percent}%)` : 'No tasks'}</p>
            <div class="progress-container"><div class="progress-fill" style="width: ${percent}%; background-color: ${barColor};"></div></div>
        `;
        container.appendChild(card);
    });

    if (jobSortable) jobSortable.destroy();
    jobSortable = Sortable.create(container, {
        handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost',
        onEnd: async function (evt) {
            const items = container.querySelectorAll('.card');
            let newOrderIds = Array.from(items).map(el => parseInt(el.dataset.id));
            const visibleJobs = jobs.filter(j => viewingArchives ? j.isArchived : !j.isArchived);
            const hiddenJobs = jobs.filter(j => viewingArchives ? !j.isArchived : j.isArchived);
            visibleJobs.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
            jobs = [...visibleJobs, ...hiddenJobs]; await saveData();
        }
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
    if (!title) { alert("Please enter a job title."); return; }

    jobs.push({ 
        id: Date.now(), title: title, 
        priority: document.getElementById('add-job-priority').value, 
        assignedTo: document.getElementById('add-job-assignee').value, 
        startDate: document.getElementById('add-job-date').value, 
        startTime: document.getElementById('add-job-time').value, 
        tasks: [], isArchived: false, isShared: false 
    });
    
    if(viewingArchives) { viewingArchives = false; document.getElementById('toggle-archive-btn').innerText = "Show Archives"; document.getElementById('toggle-archive-btn').style.background = "var(--light-gray)"; document.getElementById('toggle-archive-btn').style.color = "var(--text)"; }
    
    closeAddJobModal(); renderJobs(); await saveData(); 
}

// --- Edit Job Logic ---
function openEditJobModal() {
    populateDropdowns();
    const job = jobs.find(j => j.id === currentJobId);
    document.getElementById('edit-job-title').value = job.title;
    document.getElementById('edit-job-priority').value = job.priority || 'Normal';
    document.getElementById('edit-job-assignee').value = job.assignedTo || '';
    document.getElementById('edit-job-date').value = job.startDate || '';
    document.getElementById('edit-job-time').value = job.startTime || '';
    document.getElementById('edit-job-modal').classList.remove('hidden');
}
function closeEditJobModal() { document.getElementById('edit-job-modal').classList.add('hidden'); }

async function saveEditedJob() {
    const title = document.getElementById('edit-job-title').value.trim();
    if (!title) return alert("Title cannot be empty.");
    
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    jobs[jobIndex].title = title;
    jobs[jobIndex].priority = document.getElementById('edit-job-priority').value;
    jobs[jobIndex].assignedTo = document.getElementById('edit-job-assignee').value;
    jobs[jobIndex].startDate = document.getElementById('edit-job-date').value;
    jobs[jobIndex].startTime = document.getElementById('edit-job-time').value;
    
    closeEditJobModal(); renderTasks(); await saveData();
}

// --- Tasks Logic & Drag-and-Drop ---
let taskSortable = null;

function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    const job = jobs.find(j => j.id === currentJobId);
    const hideCompleted = document.getElementById('hide-completed-tasks-toggle').checked;

    document.getElementById('current-job-title').innerText = job.title || 'Untitled';
    
    const calAction = document.getElementById('current-job-calendar-action');
    if (job.startDate) {
        calAction.innerHTML = `<button class="btn-outline btn-small" style="color:var(--primary); border-color:var(--primary);" onclick="pushSavedJobToCalendar()">📅 Sync Job to Calendar</button>`;
    } else { calAction.innerHTML = ''; }

    let topBadges = '';
    if(job.priority === 'High') topBadges += `<span class="badge badge-High">High Priority</span> `;
    if(job.priority === 'Low') topBadges += `<span class="badge badge-Low">Low Priority</span> `;
    if(job.assignedTo) topBadges += `<span class="badge badge-Assignee">Job Lead: ${getAssigneeText(job.assignedTo)}</span> `;
    if(job.startDate) topBadges += `<span class="badge" style="background:var(--light-gray); color:var(--text); border:1px solid var(--border-color);">📅 Start: ${job.startDate} ${job.startTime ? job.startTime : ''}</span>`;
    document.getElementById('current-job-badges').innerHTML = topBadges;

    if (!job.tasks) job.tasks = [];

    let displayTasks = job.tasks;
    if (hideCompleted) { displayTasks = displayTasks.filter(t => t.status !== 'Complete'); }

    if(displayTasks.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--gray); margin-top:20px; padding:20px;">No tasks visible.</p>`;
        return;
    }

    displayTasks.forEach((task) => {
        let isComplete = task.status === 'Complete';
        let dateDisplay = '';
        let syncBtnDisplay = '';
        
        if (task.dueDate) {
            const [year, month, day] = task.dueDate.split('-');
            const taskDate = new Date(year, month - 1, day);
            const today = new Date(); today.setHours(0,0,0,0);
            const isPastDue = taskDate < today && !isComplete;
            
            dateDisplay = `<div style="margin-top: 8px; font-size: 13px; color: ${isPastDue ? 'var(--danger)' : 'var(--gray)'}; font-weight: ${isPastDue ? 'bold' : 'normal'};">
                📅 Due: ${task.dueDate} ${task.dueTime ? 'at ' + task.dueTime : ''} ${isPastDue ? '(Past Due!)' : ''}
            </div>`;
            syncBtnDisplay = `<button class="btn-small" style="background:transparent; border:1px solid var(--border-color); color:var(--gray); margin-top:8px;" onclick="pushSavedTaskToCalendar(${task.id})">📅 Sync</button>`;
        }

        let badgeDisplay = '';
        if(task.priority === 'High') badgeDisplay += `<span class="badge badge-High" style="margin-bottom:5px;">High</span> `;
        if(task.priority === 'Low') badgeDisplay += `<span class="badge badge-Low" style="margin-bottom:5px;">Low</span> `;
        if(task.assignedTo) badgeDisplay += `<span class="badge badge-Assignee" style="margin-bottom:5px;">👤 ${getAssigneeText(task.assignedTo)}</span>`;

        const taskEl = document.createElement('div');
        taskEl.className = `task-row task-${task.status.replace(' ', '-')}`;
        taskEl.dataset.id = task.id;

        let checkmark = isComplete ? '✅ ' : '';
        let titleClass = isComplete ? 'task-title-completed' : '';

        taskEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="font-size: 18px; line-height:1.4; padding-right: 90px; flex: 1;">
                    ${badgeDisplay}<br>
                    <span class="${titleClass}" style="font-weight: 600;">${checkmark}${task.title}</span>
                </div>
                <div style="display:flex; gap:2px; position:absolute; top:12px; right:12px; align-items:center;">
                    <button class="btn-icon" onclick="event.stopPropagation(); openEditTaskModal(${task.id})" title="Edit Task">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteTask(${task.id})" title="Delete Task" style="color:var(--danger);">🗑️</button>
                    <span class="drag-handle" title="Drag to reorder">☰</span>
                </div>
            </div>
            ${task.desc ? `<p style="color: var(--gray); font-size: 14px; margin: 5px 0;">${task.desc}</p>` : ''}
            ${dateDisplay}
            
            <div style="display: flex; gap: 10px; margin-top: 10px; align-items: center;">
                <select style="margin: 0; padding: 8px; font-size: 14px; flex: 1;" onchange="updateTaskStatus(${task.id}, this.value)">
                    <option value="Not Started" ${task.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                    <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Complete" ${task.status === 'Complete' ? 'selected' : ''}>✅ Complete</option>
                </select>
                ${syncBtnDisplay}
            </div>
            <textarea placeholder="Ongoing notes..." onchange="updateTaskNotes(${task.id}, this.value)" rows="1" style="margin-top: 10px; padding: 8px; font-size: 14px; font-style: italic;">${task.notes || ''}</textarea>
        `;
        container.appendChild(taskEl);
    });

    if (taskSortable) taskSortable.destroy();
    taskSortable = Sortable.create(container, {
        handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost',
        onEnd: async function(evt) {
            const jobIndex = jobs.findIndex(j => j.id === currentJobId);
            const items = container.querySelectorAll('.task-row');
            let newOrderIds = Array.from(items).map(el => parseInt(el.dataset.id));
            const visibleTasks = jobs[jobIndex].tasks.filter(t => hideCompleted ? t.status !== 'Complete' : true);
            const hiddenTasks = jobs[jobIndex].tasks.filter(t => hideCompleted ? t.status === 'Complete' : false);
            visibleTasks.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
            jobs[jobIndex].tasks = [...visibleTasks, ...hiddenTasks];
            await saveData();
        }
    });
}

// --- Add & Edit Task Logic ---
function openAddTaskModal() {
    populateDropdowns();
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-desc').value = '';
    document.getElementById('new-task-priority').value = 'Normal';
    document.getElementById('new-task-assignee').value = '';
    document.getElementById('new-task-date').value = '';
    document.getElementById('new-task-time').value = '';
    document.getElementById('add-task-modal').classList.remove('hidden');
}

function closeAddTaskModal() { document.getElementById('add-task-modal').classList.add('hidden'); }

async function addTask() {
    const title = document.getElementById('new-task-title').value.trim();
    if (!title) return alert("Enter a task name.");
    
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    jobs[jobIndex].tasks.push({ 
        id: Date.now(), title: title, 
        desc: document.getElementById('new-task-desc').value.trim(), 
        priority: document.getElementById('new-task-priority').value, 
        assignedTo: document.getElementById('new-task-assignee').value, 
        status: 'Not Started', notes: '', 
        dueDate: document.getElementById('new-task-date').value, 
        dueTime: document.getElementById('new-task-time').value
    });

    closeAddTaskModal(); renderTasks(); await saveData(); 
}

let editingTaskId = null;
function openEditTaskModal(taskId) {
    editingTaskId = taskId; populateDropdowns();
    const job = jobs.find(j => j.id === currentJobId);
    const task = job.tasks.find(t => t.id === taskId);
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-desc').value = task.desc || '';
    document.getElementById('edit-task-priority').value = task.priority || 'Normal';
    document.getElementById('edit-task-assignee').value = task.assignedTo || '';
    document.getElementById('edit-task-date').value = task.dueDate || '';
    document.getElementById('edit-task-time').value = task.dueTime || '';
    document.getElementById('edit-task-modal').classList.remove('hidden');
}

function closeEditTaskModal() { document.getElementById('edit-task-modal').classList.add('hidden'); editingTaskId = null; }

async function saveEditedTask() {
    const title = document.getElementById('edit-task-title').value.trim();
    if (!title) return alert("Task name cannot be empty.");
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === editingTaskId);
    jobs[jobIndex].tasks[taskIndex].title = title;
    jobs[jobIndex].tasks[taskIndex].desc = document.getElementById('edit-task-desc').value.trim();
    jobs[jobIndex].tasks[taskIndex].priority = document.getElementById('edit-task-priority').value;
    jobs[jobIndex].tasks[taskIndex].assignedTo = document.getElementById('edit-task-assignee').value;
    jobs[jobIndex].tasks[taskIndex].dueDate = document.getElementById('edit-task-date').value;
    jobs[jobIndex].tasks[taskIndex].dueTime = document.getElementById('edit-task-time').value;
    closeEditTaskModal(); renderTasks(); await saveData();
}

async function updateTaskStatus(taskId, newStatus) {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === taskId);
    jobs[jobIndex].tasks[taskIndex].status = newStatus;
    if (newStatus === 'Complete') {
        const completedTask = jobs[jobIndex].tasks.splice(taskIndex, 1)[0];
        jobs[jobIndex].tasks.push(completedTask);
    }
    renderTasks(); await saveData(); 
}

async function updateTaskNotes(taskId, notes) {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === taskId);
    jobs[jobIndex].tasks[taskIndex].notes = notes; await saveData();
}

async function deleteTask(taskId) {
    if(confirm("Remove this task?")) {
        const jobIndex = jobs.findIndex(j => j.id === currentJobId);
        jobs[jobIndex].tasks = jobs[jobIndex].tasks.filter(t => t.id !== taskId);
        renderTasks(); await saveData();
    }
}

// --- CALENDAR LOGIC (UNIVERSAL) ---
function createCalendarLink(title, startDate, startTime, description) {
    if (!startDate) return alert("Please select a Date first so we know when to add it to the Calendar!");
    let startDateTime = '', endDateTime = '';
    if (startDate && startTime) {
        const [year, month, day] = startDate.split('-'); const [hour, minute] = startTime.split(':');
        startDateTime = `${year}${month}${day}T${hour}${minute}00`;
        const d = new Date(year, month - 1, day, hour, minute); d.setHours(d.getHours() + 1);
        endDateTime = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    } else {
        const [year, month, day] = startDate.split('-'); startDateTime = `${year}${month}${day}`;
        const d = new Date(year, month - 1, day); d.setDate(d.getDate() + 1);
        endDateTime = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }
    const safeTitle = encodeURIComponent("Job Tracker: " + title);
    const safeDesc = encodeURIComponent(description || "Added via Job Tracker");
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${safeTitle}&dates=${startDateTime}/${endDateTime}&details=${safeDesc}`, '_blank');
}
function pushSavedJobToCalendar() { const job = jobs.find(j => j.id === currentJobId); if(job) createCalendarLink(job.title, job.startDate, job.startTime, "Job Start Date"); }
function pushSavedTaskToCalendar(taskId) { const job = jobs.find(j => j.id === currentJobId); const task = job.tasks.find(t => t.id === taskId); if(task) createCalendarLink(task.title, task.dueDate, task.dueTime, task.desc); }

// --- ADMIN & SHARE ---
async function shareCurrentJob() {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId); if(jobIndex < 0) return;
    jobs[jobIndex].isShared = true; await saveData(); 
    const shareUrl = window.location.origin + window.location.pathname + '?job=' + (jobs[jobIndex].firebaseId || jobs[jobIndex].id.toString());
    try { await navigator.clipboard.writeText(shareUrl); alert("🔗 Link copied to clipboard!"); } catch (err) { alert("Share this link: \n\n" + shareUrl); }
}

async function deleteJobFromHome(jobId) {
    if(confirm("PERMANENTLY delete this job?")) {
        const job = jobs.find(j => j.id === jobId);
        await deleteDoc(doc(db, "jobs", job.firebaseId || job.id.toString())); 
        jobs = jobs.filter(j => j.id !== jobId); renderJobs();
    }
}
async function deleteCurrentJob() {
    if(confirm("PERMANENTLY delete this job?")) {
        const job = jobs.find(j => j.id === currentJobId);
        await deleteDoc(doc(db, "jobs", job.firebaseId || job.id.toString())); 
        jobs = jobs.filter(j => j.id !== currentJobId); goHome();
    }
}
async function archiveCurrentJob() {
    if(!confirm("Move this job to the Archives?")) return; 
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    jobs[jobIndex].isArchived = !jobs[jobIndex].isArchived; goHome(); await saveData();
}

async function banUser(uid, userName) { if(!confirm(`Ban ${userName}?`)) return; await setDoc(doc(db, "banned_users", uid), { bannedAt: Date.now(), name: userName }); alert(`${userName} has been banned.`); openAllUsersJobsModal(); }
async function unbanUser(uid, userName) { if(!confirm(`Unban ${userName}?`)) return; await deleteDoc(doc(db, "banned_users", uid)); alert(`${userName} has been unbanned.`); openAllUsersJobsModal(); }
async function deleteUserData(uid, userName) {
    if(!confirm(`⚠️ PERMANENTLY delete ALL data for ${userName}?`)) return;
    const snapJobs = await getDocs(query(collection(db, "jobs"), where("ownerUid", "==", uid))); snapJobs.forEach(async (d) => await deleteDoc(doc(db, "jobs", d.id)));
    const snapTeam = await getDocs(query(collection(db, "team"), where("ownerUid", "==", uid))); snapTeam.forEach(async (d) => await deleteDoc(doc(db, "team", d.id)));
    alert(`Data wiped.`); openAllUsersJobsModal(); 
}

async function openAllUsersJobsModal() {
    const container = document.getElementById('all-users-container');
    container.innerHTML = '<p style="text-align:center; color:var(--gray);">Fetching...</p>';
    document.getElementById('all-users-modal').classList.remove('hidden');
    try {
        const bannedSnap = await getDocs(collection(db, "banned_users")); let bannedUids = []; bannedSnap.forEach(doc => bannedUids.push(doc.id));
        const usersSnap = await getDocs(collection(db, "users")); let allUsers = []; usersSnap.forEach(doc => allUsers.push(doc.data()));
        const jobsSnap = await getDocs(collection(db, "jobs")); let jobsByUid = {}; adminViewJobs = []; 
        jobsSnap.forEach((doc) => {
            const data = doc.data(); data.firebaseId = doc.id; adminViewJobs.push(data); 
            if(data.ownerUid) { if(!jobsByUid[data.ownerUid]) jobsByUid[data.ownerUid] = []; jobsByUid[data.ownerUid].push(data); }
        });
        container.innerHTML = '';
        if (allUsers.length === 0) return container.innerHTML = '<p>No users found.</p>';
        allUsers.forEach((userData) => {
            const userName = userData.name || "Unknown User"; const userUid = userData.uid;
            const activeJobs = (jobsByUid[userUid] || []).filter(j => !j.isArchived);
            const banBtn = bannedUids.includes(userUid) ? `<button class="btn-success btn-small" onclick="unbanUser('${userUid}', '${userName}')">Unban</button>` : `<button class="btn-warning btn-small" onclick="banUser('${userUid}', '${userName}')">Ban</button>`;

            const userDiv = document.createElement('div'); userDiv.style.marginBottom = '15px'; userDiv.style.border = '1px solid var(--border-color)'; userDiv.style.borderRadius = '8px'; userDiv.style.overflow = 'hidden';
            const userHeader = document.createElement('div'); userHeader.style.background = 'var(--light-gray)'; userHeader.style.padding = '12px 15px';
            userHeader.innerHTML = `
                <div style="display: flex; justify-content: space-between; cursor: pointer; align-items: center;" id="toggle-${userUid}">
                    <div style="display: flex; align-items: center; gap: 10px;"><img src="${userData.photoURL || `https://ui-avatars.com/api/?name=${userName}`}" style="width: 32px; border-radius: 50%;"><div><strong>${userName}</strong><br><span style="font-size: 12px; color: var(--gray);">${userData.email || "No email"}</span></div></div>
                    <span style="color: var(--primary); font-weight: bold;">${activeJobs.length} Active ▼</span>
                </div>
                <div style="display: flex; gap: 5px; justify-content: flex-end; padding-top: 5px; border-top: 1px solid var(--border-color);">${banBtn}<button class="btn-danger btn-small" onclick="deleteUserData('${userUid}', '${userName}')">Wipe</button></div>
            `;
            const listCont = document.createElement('div'); listCont.style.display = 'none';
            activeJobs.forEach(job => {
                const row = document.createElement('div'); row.style.padding = '10px 15px'; row.style.borderBottom = '1px solid var(--border-color)';
                row.innerHTML = `<strong>${job.title}</strong> <button class="btn-primary btn-small" style="float:right;" onclick="cloneJob('${job.firebaseId}')">📥 Import</button>`;
                listCont.appendChild(row);
            });
            userHeader.querySelector(`#toggle-${userUid}`).onclick = () => listCont.style.display = listCont.style.display === 'none' ? 'block' : 'none';
            userDiv.appendChild(userHeader); userDiv.appendChild(listCont); container.appendChild(userDiv);
        });
    } catch (e) { container.innerHTML = `<p style="color:red;">Error: ${e.message}</p>`; }
}
function closeAllUsersJobsModal() { document.getElementById('all-users-modal').classList.add('hidden'); }

async function cloneJob(firebaseId) {
    const originalJob = adminViewJobs.find(j => j.firebaseId === firebaseId);
    if(!originalJob || !confirm(`Import "${originalJob.title}"?`)) return;
    const newJob = JSON.parse(JSON.stringify(originalJob));
    newJob.id = Date.now(); newJob.firebaseId = newJob.id.toString(); 
    newJob.owner = currentUserName; newJob.ownerUid = currentUserUid;
    newJob.title += " (Imported)"; newJob.isShared = false; 
    if(newJob.tasks) newJob.tasks.forEach((t, i) => t.id = Date.now() + i + 1);
    jobs.push(newJob); alert(`Imported!`); renderJobs(); await saveData();
}

// --- CONTEXT-AWARE PRINT LOGIC (Checkmarks & Layout Updates) ---
function openPrintModal() { 
    document.getElementById('print-modal').classList.remove('hidden'); 
    const isJobView = currentJobId !== null;
    document.getElementById('print-modal-title').innerText = isJobView ? "Print Task Checklist" : "Print Job List";
    document.getElementById('print-archive-label').style.display = isJobView ? 'none' : 'block';
    const container = document.getElementById('print-item-selection'); container.innerHTML = '';
    
    if (isJobView) {
        const job = jobs.find(j => j.id === currentJobId);
        if(!job.tasks || job.tasks.length === 0) container.innerHTML = '<p style="color:var(--gray);">No tasks to print.</p>';
        else job.tasks.forEach(task => { container.innerHTML += `<label style="display:block; margin-bottom:10px; font-size:16px; cursor:pointer;"><input type="checkbox" class="print-item-cb" value="${task.id}" checked style="width:auto; margin-right:8px; transform: scale(1.2);"> ${task.title}</label>`; });
    } else {
        const includeArchives = document.getElementById('print-archive-toggle').checked;
        jobs.forEach(job => {
            if (!includeArchives && job.isArchived) return;
            container.innerHTML += `<label style="display:block; margin-bottom:10px; font-size:16px; cursor:pointer;"><input type="checkbox" class="print-item-cb" value="${job.id}" checked style="width:auto; margin-right:8px; transform: scale(1.2);"> ${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}</label>`;
        });
    }
    generatePrintPreview(); 
}

function closePrintModal() { document.getElementById('print-modal').classList.add('hidden'); }

function generatePrintPreview() {
    const selectedIds = Array.from(document.querySelectorAll('.print-item-cb')).filter(cb => cb.checked).map(cb => String(cb.value));
    const printArea = document.getElementById('print-preview-area'); const dateStr = new Date().toLocaleDateString();
    
    let html = '';
    if (currentJobId !== null) {
        const job = jobs.find(j => j.id === currentJobId);
        html = `<div style="color:black; font-family:sans-serif; background:white; padding:10px;"><h2>${job.title} - Site Checklist</h2><p style="margin-bottom: 20px; color: #555;">Generated: ${dateStr}</p><hr style="margin-bottom: 20px;">`;
        const tasksToPrint = (job.tasks || []).filter(t => selectedIds.includes(String(t.id)));
        if(tasksToPrint.length === 0) html += `<p>No tasks selected.</p>`;
        else {
            html += `<ul style="list-style-type: none; padding-left: 0;">`;
            tasksToPrint.forEach(task => {
                let checkmark = task.status === 'Complete' ? '✅ ' : '';
                let boxCheck = task.status === 'Complete' ? '✓' : '';
                html += `<li style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc;">
                    <div style="font-size: 18px;">
                        <div style="display:inline-block; width:18px; height:18px; border:2px solid black; margin-right:15px; vertical-align:middle; border-radius:3px; text-align:center; line-height:18px; font-size:14px;">${boxCheck}</div>
                        ${checkmark}${task.title} <span style="font-size: 14px; color: #555;">[${task.status}]</span>
                        ${task.assignedTo ? ` <strong style="font-size:14px;">(Lead: ${getAssigneeText(task.assignedTo)})</strong>` : ''}${task.dueDate ? ` <span style="color:#d9534f; float:right; font-size:14px;">[Due: ${task.dueDate}]</span>` : ''}
                    </div>`;
                if (task.desc) html += `<div style="margin-left: 37px; margin-top: 5px; font-size: 14px; color: #333;">Desc: ${task.desc}</div>`;
                if (task.notes) html += `<div style="margin-left: 37px; margin-top: 5px; font-size: 14px; color: #555; font-style: italic;">Notes: ${task.notes}</div>`;
                html += `</li>`;
            });
            html += `</ul>`;
        }
        html += `</div>`;
    } else {
        html = `<div style="color:black; font-family:sans-serif; background:white; padding:10px;"><h2>${currentUserName}'s Active Jobs</h2><p style="margin-bottom: 20px; color: #555;">Generated: ${dateStr}</p><hr style="margin-bottom: 20px;">`;
        const jobsToPrint = jobs.filter(j => selectedIds.includes(String(j.id)));
        if(jobsToPrint.length === 0) html += `<p>No jobs selected.</p>`;
        else {
            jobsToPrint.forEach(job => {
                html += `<div style="margin-bottom: 25px;"><h3 style="font-size: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}</h3>`;
                if(!job.tasks || job.tasks.length === 0) html += `<p style="margin-left:15px; color:#555;">No tasks.</p>`;
                else { 
                    html += `<ul style="margin-left: 25px; list-style-type: square; line-height: 1.6;">`; 
                    job.tasks.forEach(task => { 
                        let checkmark = task.status === 'Complete' ? '✅ ' : '';
                        html += `<li><strong>${checkmark}${task.title}</strong> - Status: <em>${task.status}</em></li>`; 
                    }); 
                    html += `</ul>`; 
                }
                html += `</div>`;
            });
        }
        html += `</div>`;
    }
    printArea.innerHTML = html;
}

function executePrint() { 
    const previewHTML = document.getElementById('print-preview-area').innerHTML;
    if (!previewHTML || previewHTML.trim() === '') return alert("There is nothing to print!");

    const printArea = document.getElementById('real-print-area');
    closePrintModal(); document.getElementById('main-app-wrapper').style.display = 'none'; document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    
    printArea.classList.remove('hidden'); printArea.style.display = 'block'; printArea.style.background = 'white'; printArea.style.color = 'black'; printArea.style.padding = '20px'; printArea.style.minHeight = '100vh';
    printArea.innerHTML = `<style>@media print { .no-print-btn { display: none !important; } }</style><button class="btn btn-primary no-print-btn" onclick="restoreAppAfterPrint()" style="width: 100%; margin-bottom: 25px; font-size: 16px; padding: 15px;">⬅️ Done Printing (Return to App)</button>${previewHTML}`;

    setTimeout(() => { window.print(); }, 500); 
}

// Cleaned up Shared Job Printing
function printSharedJob() {
    if(!sharedJobData) return;
    const printArea = document.getElementById('real-print-area');
    
    document.getElementById('main-app-wrapper').style.display = 'none';
    printArea.classList.remove('hidden'); printArea.style.display = 'block'; printArea.style.background = 'white'; printArea.style.color = 'black'; printArea.style.padding = '20px'; printArea.style.minHeight = '100vh';
    
    let tasksHTML = '<ul style="list-style-type: none; padding-left: 0;">';
    if(sharedJobData.tasks) {
        sharedJobData.tasks.forEach(task => {
            let checkmark = task.status === 'Complete' ? '✅ ' : '';
            let boxCheck = task.status === 'Complete' ? '✓' : '';
            tasksHTML += `<li style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc;">
                <div style="font-size: 18px;">
                    <div style="display:inline-block; width:18px; height:18px; border:2px solid black; margin-right:15px; vertical-align:middle; border-radius:3px; text-align:center; line-height:18px; font-size:14px;">${boxCheck}</div>
                    ${checkmark}${task.title} <span style="font-size: 14px; color: #555;">[${task.status}]</span>
                </div>
                ${task.desc ? `<div style="margin-left: 37px; margin-top: 5px; font-size: 14px; color: #333;">Desc: ${task.desc}</div>` : ''}
            </li>`;
        });
    }
    tasksHTML += '</ul>';

    printArea.innerHTML = `<style>@media print { .no-print-btn { display: none !important; } }</style><button class="btn btn-primary no-print-btn" onclick="restoreAppAfterPrint()" style="width: 100%; margin-bottom: 25px; font-size: 16px; padding: 15px;">⬅️ Done Printing (Return to App)</button><div style="font-family:sans-serif; color:black;"><h2>${sharedJobData.title || 'Untitled'} - Site Checklist</h2><p style="color: #555; margin-bottom: 5px;">Created by: ${sharedJobData.owner || 'Unknown'}</p><p style="color: #555; margin-bottom: 20px;">Printed: ${new Date().toLocaleDateString()}</p><hr style="margin-bottom: 20px;">${tasksHTML}</div>`;

    setTimeout(() => { window.print(); }, 500);
}

function restoreAppAfterPrint() {
    const printArea = document.getElementById('real-print-area');
    printArea.classList.add('hidden'); printArea.style.display = 'none'; printArea.innerHTML = '';
    document.getElementById('main-app-wrapper').style.display = 'block';
    document.querySelectorAll('.modal').forEach(m => m.style.display = '');
}

// --- CHANGELOG MODAL ---
function openAboutModal() { document.getElementById('about-modal').classList.remove('hidden'); }
function closeAboutModal() { document.getElementById('about-modal').classList.add('hidden'); }
const logFilesList = ['v3_0', 'v2_7', 'v2_6', 'v2_5', 'v2_4', 'v2_3', 'v2_2', 'v2_1', 'v2_0', 'v1_16', 'v1_15'];
let currentLogIndex = 0;
function openChangelogModal() { document.getElementById('changelog-modal').classList.remove('hidden'); if (currentLogIndex === 0) { document.getElementById('changelog-container').innerHTML = ''; loadMoreLogs(); } }
function closeChangelogModal() { document.getElementById('changelog-modal').classList.add('hidden'); }
async function loadMoreLogs() {
    const container = document.getElementById('changelog-container'); let loadedThisTime = 0;
    const loadBtn = document.getElementById('load-more-logs-btn'); if(loadBtn) loadBtn.innerText = "Loading...";
    while (loadedThisTime < 2 && currentLogIndex < logFilesList.length) {
        const versionName = logFilesList[currentLogIndex];
        try {
            const response = await fetch(`log/${versionName}.txt?v=${Date.now()}`); if (!response.ok) throw new Error("File not found");
            const text = await response.text(); const lines = text.split('\n');
            let html = `<div style="margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><h3 class="version-title" style="color:var(--primary); margin-bottom:10px;">${lines[0] || versionName}</h3><ul class="changelog-list" style="padding-left: 20px; line-height: 1.6;">`;
            for(let i = 1; i < lines.length; i++) { if(lines[i].trim() !== '') { html += `<li>${lines[i].replace(/^-/, '').trim()}</li>`; } }
            html += `</ul></div>`; container.innerHTML += html; loadedThisTime++; 
        } catch (e) { console.warn(`Missing file: log/${versionName}.txt`); }
        currentLogIndex++;
    }
    if (currentLogIndex >= logFilesList.length) { if(loadBtn) loadBtn.style.display = 'none'; if(container.innerHTML === '') container.innerHTML = '<p style="color:var(--gray); text-align:center;">No updates found.</p>'; } else { if(loadBtn) { loadBtn.style.display = 'inline-block'; loadBtn.innerText = "Show More"; } }
}
function printSingleJob() { openPrintModal(); }
// Global scope mapping
window.loginWithEmail = loginWithEmail; window.loginWithGoogle = loginWithGoogle; window.logout = logout;
window.openSettingsModal = openSettingsModal; window.closeSettingsModal = closeSettingsModal; window.toggleDarkMode = toggleDarkMode;
window.openAllUsersJobsModal = openAllUsersJobsModal; window.closeAllUsersJobsModal = closeAllUsersJobsModal; window.cloneJob = cloneJob; 
window.shareCurrentJob = shareCurrentJob; window.openChangelogModal = openChangelogModal; window.closeChangelogModal = closeChangelogModal; 
window.loadMoreLogs = loadMoreLogs; window.openAboutModal = openAboutModal; window.closeAboutModal = closeAboutModal; 
window.openAddJobModal = openAddJobModal; window.closeAddJobModal = closeAddJobModal; window.saveNewJob = saveNewJob; 
window.openEditJobModal = openEditJobModal; window.closeEditJobModal = closeEditJobModal; window.saveEditedJob = saveEditedJob;
window.openAddTaskModal = openAddTaskModal; window.closeAddTaskModal = closeAddTaskModal; window.addTask = addTask; 
window.openEditTaskModal = openEditTaskModal; window.closeEditTaskModal = closeEditTaskModal; window.saveEditedTask = saveEditedTask;
window.openTeamModal = openTeamModal; window.closeTeamModal = closeTeamModal; window.addTeamMember = addTeamMember; window.removeTeamMember = removeTeamMember; 
window.toggleArchives = toggleArchives; window.openPrintModal = openPrintModal; window.closePrintModal = closePrintModal; 
window.generatePrintPreview = generatePrintPreview; window.executePrint = executePrint; window.goHome = goHome; 
window.archiveCurrentJob = archiveCurrentJob; window.deleteCurrentJob = deleteCurrentJob; window.deleteJobFromHome = deleteJobFromHome; 
window.deleteTask = deleteTask; 
window.updateTaskStatus = updateTaskStatus; window.updateTaskNotes = updateTaskNotes; window.viewJob = viewJob; 
window.banUser = banUser; window.unbanUser = unbanUser; window.deleteUserData = deleteUserData; 
window.pushSavedJobToCalendar = pushSavedJobToCalendar; window.pushSavedTaskToCalendar = pushSavedTaskToCalendar;
window.printSingleJob = printSingleJob; window.printSharedJob = printSharedJob; window.restoreAppAfterPrint = restoreAppAfterPrint; window.renderTasks = renderTasks;
