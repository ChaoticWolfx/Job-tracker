// Import Firebase & Auth directly from the web
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, collection, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
let jobs = [];
let teamMembers = [];
let adminViewJobs = []; // Temporarily stores jobs viewed in the Admin panel
let currentJobId = null;
let viewingArchives = false;

// --- AUTHENTICATION STATE OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        currentUserEmail = user.email;
        currentUserName = user.displayName || user.email.split('@')[0]; 
        
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
        jobs = [];
        teamMembers = [];
        
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('home-view').classList.add('hidden');
        document.getElementById('job-detail-view').classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('app-footer').classList.add('hidden');
        document.getElementById('admin-overview-btn').classList.add('hidden');
        document.getElementById('header-title').innerText = "Job Tracker";
    }
});

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

        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => viewJob(job.id);
        card.style.opacity = job.isArchived ? '0.7' : '1';
        
        card.innerHTML = `
            <div style="position:absolute; top:12px; right:12px; display:flex; gap:5px;">
                <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid #ccc;" onclick="event.stopPropagation(); moveJob(${job.id}, 'up')">⬆️</button>
                <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid #ccc;" onclick="event.stopPropagation(); moveJob(${job.id}, 'down')">⬇️</button>
                <button class="btn-danger btn-small" onclick="event.stopPropagation(); deleteJobFromHome(${job.id})" style="padding: 2px 8px; font-size:12px;">X</button>
            </div>
            ${badges ? `<div style="margin-bottom:8px; padding-right: 90px;">${badges}</div>` : ''}
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
    document.getElementById('add-job-modal').classList.remove('hidden');
}
function closeAddJobModal() { document.getElementById('add-job-modal').classList.add('hidden'); }

async function saveNewJob() {
    const title = document.getElementById('add-job-title').value.trim();
    const priority = document.getElementById('add-job-priority').value;
    const assignee = document.getElementById('add-job-assignee').value;

    if (!title) { alert("Please enter a job title."); return; }

    jobs.push({ id: Date.now(), title: title, priority: priority, assignedTo: assignee, tasks: [], isArchived: false });
    if(viewingArchives) { viewingArchives = false; document.getElementById('toggle-archive-btn').innerText = "Show Archives"; document.getElementById('toggle-archive-btn').style.background = "var(--light-gray)"; }
    
    closeAddJobModal(); renderJobs(); await saveData(); 
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
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    jobs[jobIndex].isArchived = !jobs[jobIndex].isArchived; goHome(); await saveData();
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
    document.getElementById('current-job-badges').innerHTML = topBadges;

    if (!job.tasks) job.tasks = [];

    job.tasks.forEach((task, index) => {
        let dateDisplay = '';
        if (task.hasDate && task.dueDate) {
            const [year, month, day] = task.dueDate.split('-');
            const taskDate = new Date(year, month - 1, day);
            const today = new Date(); today.setHours(0,0,0,0);
            const isPastDue = taskDate < today && task.status !== 'Complete';
            dateDisplay = `<div class="${isPastDue ? 'past-due' : ''}" style="margin-top: 5px; font-size: 14px;">
                <span style="display:inline-block; margin-right:5px;">📅</span>Due: ${task.dueDate} ${isPastDue ? '(Past Due!)' : ''}
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
                    <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid #ccc;" onclick="event.stopPropagation(); moveTask(${task.id}, 'up')">⬆️</button>
                    <button class="btn-small" style="padding: 2px 8px; font-size:12px; background:var(--light-gray); border: 1px solid #ccc;" onclick="event.stopPropagation(); moveTask(${task.id}, 'down')">⬇️</button>
                    <button class="btn-danger btn-small" style="padding: 2px 8px; font-size:12px;" onclick="event.stopPropagation(); deleteTask(${task.id})">X</button>
                </div>
            </div>
            ${task.desc ? `<p style="color: #555; font-size: 15px;">${task.desc}</p>` : ''}
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

function toggleDateField() { document.getElementById('new-task-date').classList.toggle('hidden'); }

async function addTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const priority = document.getElementById('new-task-priority').value;
    const assignee = document.getElementById('new-task-assignee').value;
    const hasDate = document.getElementById('new-task-has-date').checked;
    const dueDate = document.getElementById('new-task-date').value;

    if (!title) return alert("Enter a task name.");
    if (hasDate && !dueDate) return alert("Please select a due date.");
    
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    
    jobs[jobIndex].tasks.push({ 
        id: Date.now(), title: title, desc: desc, priority: priority, assignedTo: assignee, status: 'Not Started', notes: '', hasDate: hasDate, dueDate: dueDate
    });
    
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-desc').value = '';
    document.getElementById('new-task-priority').value = 'Normal';
    document.getElementById('new-task-assignee').value = '';
    document.getElementById('new-task-has-date').checked = false;
    document.getElementById('new-task-date').value = '';
    document.getElementById('new-task-date').classList.add('hidden');
    
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

// --- CLOUD ADMIN OVERVIEW LOGIC WITH JOB CLONING ---
async function openAllUsersJobsModal() {
    const container = document.getElementById('all-users-container');
    container.innerHTML = '<p style="text-align:center; color:var(--gray);">Fetching all company jobs from Cloud...</p>';
    document.getElementById('all-users-modal').classList.remove('hidden');

    try {
        const querySnapshot = await getDocs(collection(db, "jobs"));
        container.innerHTML = '';
        adminViewJobs = []; // Clear temporary admin view array
        
        // Group all pulled jobs by their Owner tag
        let usersData = {};
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.firebaseId = doc.id; // Save specific cloud ID for cloning
            adminViewJobs.push(data); // Push into the temporary array

            const owner = data.owner || "Unknown User";
            if(!usersData[owner]) usersData[owner] = [];
            usersData[owner].push(data);
        });

        if (Object.keys(usersData).length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray); margin-top: 20px;">No jobs found in Cloud.</p>';
            return;
        }

        // Build the dropdowns for each User found
        for (const [owner, userJobs] of Object.entries(usersData)) {
            const userName = owner.charAt(0).toUpperCase() + owner.slice(1);
            const activeJobs = userJobs.filter(j => !j.isArchived);
            
            const userDiv = document.createElement('div');
            userDiv.style.marginBottom = '15px'; userDiv.style.border = '1px solid var(--light-gray)'; userDiv.style.borderRadius = '8px'; userDiv.style.overflow = 'hidden';
            
            const userHeader = document.createElement('div');
            userHeader.style.background = 'var(--light-gray)'; userHeader.style.padding = '12px 15px'; userHeader.style.fontWeight = 'bold'; userHeader.style.cursor = 'pointer'; userHeader.style.display = 'flex'; userHeader.style.justifyContent = 'space-between';
            userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▼</span>`;
            
            const jobsListContainer = document.createElement('div');
            jobsListContainer.style.display = 'none'; jobsListContainer.style.background = 'white';
            
            if (activeJobs.length === 0) {
                jobsListContainer.innerHTML = '<div style="padding:15px;"><em style="color: var(--gray); font-size: 14px;">No active jobs.</em></div>';
            } else {
                activeJobs.forEach(job => {
                    const tasks = job.tasks || [];
                    const completed = tasks.filter(t => t.status === 'Complete').length;
                    const total = tasks.length;
                    const jobRow = document.createElement('div'); jobRow.style.borderBottom = '1px solid #eee';
                    
                    const jobHeader = document.createElement('div');
                    jobHeader.style.padding = '12px 15px'; jobHeader.style.cursor = 'pointer'; jobHeader.style.display = 'flex'; jobHeader.style.justifyContent = 'space-between'; jobHeader.style.alignItems = 'center';
                    
                    // Added the Import Button inside the job header!
                    jobHeader.innerHTML = `
                        <div style="flex: 1;">
                            <strong>${job.title || 'Untitled'}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▼</span>
                        </div>
                        <button class="btn-primary btn-small" style="margin:0; padding: 4px 10px; font-size: 12px; border-radius: 4px;" onclick="event.stopPropagation(); cloneJob('${job.firebaseId}')">📥 Import</button>
                    `;
                    
                    const taskList = document.createElement('div');
                    taskList.style.display = 'none'; taskList.style.padding = '10px 15px 15px 25px'; taskList.style.background = '#fafafa';
                    
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
                        if(taskList.style.display === 'none') { taskList.style.display = 'block'; jobHeader.innerHTML = `
                            <div style="flex: 1;"><strong>${job.title || 'Untitled'}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▲</span></div>
                            <button class="btn-primary btn-small" style="margin:0; padding: 4px 10px; font-size: 12px; border-radius: 4px;" onclick="event.stopPropagation(); cloneJob('${job.firebaseId}')">📥 Import</button>
                        `; } 
                        else { taskList.style.display = 'none'; jobHeader.innerHTML = `
                            <div style="flex: 1;"><strong>${job.title || 'Untitled'}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▼</span></div>
                            <button class="btn-primary btn-small" style="margin:0; padding: 4px 10px; font-size: 12px; border-radius: 4px;" onclick="event.stopPropagation(); cloneJob('${job.firebaseId}')">📥 Import</button>
                        `; }
                    };
                    jobRow.appendChild(jobHeader); jobRow.appendChild(taskList); jobsListContainer.appendChild(jobRow);
                });
            }
            
            userHeader.onclick = () => {
                if (jobsListContainer.style.display === 'none') { jobsListContainer.style.display = 'block'; userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▲</span>`; } 
                else { jobsListContainer.style.display = 'none'; userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▼</span>`; }
            };
            userDiv.appendChild(userHeader); userDiv.appendChild(jobsListContainer); container.appendChild(userDiv);
        }
    } catch (e) {
        container.innerHTML = `<p style="color: red; text-align: center; margin-top: 20px;">Error connecting to Cloud: ${e.message}</p>`;
    }
}
function closeAllUsersJobsModal() { document.getElementById('all-users-modal').classList.add('hidden'); }

// --- THE NEW IMPORT/CLONE FUNCTION ---
async function cloneJob(firebaseId) {
    // Find the specific job in the admin temporary array
    const originalJob = adminViewJobs.find(j => j.firebaseId === firebaseId);
    if(!originalJob) return;

    if(!confirm(`Import "${originalJob.title || 'Untitled'}" to your own job list?`)) return;

    // Deep copy the job so changes don't affect the original owner's list
    const newJob = JSON.parse(JSON.stringify(originalJob));
    
    // Assign completely new IDs and transfer ownership to you
    newJob.id = Date.now();
    newJob.firebaseId = newJob.id.toString(); 
    newJob.owner = currentUserName;
    newJob.ownerUid = currentUserUid;
    newJob.title = (newJob.title || 'Untitled') + " (Imported)";
    
    // Refresh task IDs to prevent overlaps
    if(newJob.tasks) {
        newJob.tasks.forEach((t, i) => {
            t.id = Date.now() + i + 1;
        });
    }

    // Push it straight into your home screen!
    jobs.push(newJob);
    
    // Alert and save
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
            html += `<div style="margin-bottom: 25px;"><h3 style="font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">${jPriority}${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}${jAssignee}</h3>`;
            
            if(!job.tasks || job.tasks.length === 0) { html += `<p style="margin-left:15px;">No tasks.</p>`; } 
            else {
                html += `<ul style="margin-left: 25px; list-style-type: square; line-height: 1.6;">`;
                job.tasks.forEach(task => {
                    let tPriority = task.priority === 'High' ? '<strong style="color:red;">[HIGH]</strong> ' : '';
                    let tAssignee = task.assignedTo ? ` <span style="color:blue;">(👤 ${getAssigneeText(task.assignedTo)})</span>` : '';
                    html += `<li style="margin-bottom: 10px;">${tPriority}<strong>${task.title}</strong>${tAssignee} - Status: <em>${task.status}</em>`;
                    if (task.desc) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #555;">Desc: ${task.desc}</span>`;
                    if (task.hasDate && task.dueDate) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #d9534f;">Due: ${task.dueDate}</span>`;
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
    html += `<div style="margin-bottom: 25px;"><h3 style="font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">${jPriority}${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}${jAssignee}</h3>`;
    
    if(!job.tasks || job.tasks.length === 0) { html += `<p style="margin-left:15px;">No tasks.</p>`; } 
    else {
        html += `<ul style="margin-left: 25px; list-style-type: square; line-height: 1.6;">`;
        job.tasks.forEach(task => {
            let tPriority = task.priority === 'High' ? '<strong style="color:red;">[HIGH]</strong> ' : '';
            let tAssignee = task.assignedTo ? ` <span style="color:blue;">(👤 ${getAssigneeText(task.assignedTo)})</span>` : '';
            html += `<li style="margin-bottom: 10px;">${tPriority}<strong>${task.title}</strong>${tAssignee} - Status: <em>${task.status}</em>`;
            if (task.desc) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #555;">Desc: ${task.desc}</span>`;
            if (task.hasDate && task.dueDate) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #d9534f;">Due: ${task.dueDate}</span>`;
            if (task.notes) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #666;">Notes: ${task.notes}</span>`;
            html += `</li>`;
        });
        html += `</ul>`;
    }
    html += `</div>`;
    
    printArea.innerHTML = html;
    setTimeout(() => { window.print(); }, 100);
}

function executePrint() { document.getElementById('real-print-area').innerHTML = document.getElementById('print-preview-area').innerHTML; setTimeout(() => { window.print(); }, 100); }

// --- MODAL LOGIC FOR ABOUT & WEB-FETCH CHANGELOG ---
function openAboutModal() { document.getElementById('about-modal').classList.remove('hidden'); }
function closeAboutModal() { document.getElementById('about-modal').classList.add('hidden'); }

const logFilesList = ['v2_1', 'v2_0', 'v1_16', 'v1_15', 'v1_14', 'v1_13', 'v1_12', 'v1_11', 'v1_10', 'v1_9', 'v1_8', 'v1_7', 'v1_6', 'v1_5', 'v1_4', 'v1_3', 'v1_2', 'v1_1', 'v1_0'];
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
            let html = `<div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">`;
            html += `<h3 class="version-title">${lines[0] || versionName}</h3><ul class="changelog-list">`;
            for(let i = 1; i < lines.length; i++) {
                if(lines[i].trim() !== '') { html += `<li>${lines[i].replace('-', '').trim()}</li>`; }
            }
            html += `</ul></div>`;
            container.innerHTML += html;
        } catch (e) {
            container.innerHTML += `
                <div style="margin-bottom: 20px; padding: 10px; background: #ffe6e6; border-left: 4px solid red;">
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
window.openAllUsersJobsModal = openAllUsersJobsModal;
window.closeAllUsersJobsModal = closeAllUsersJobsModal;
window.cloneJob = cloneJob;
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
window.toggleDateField = toggleDateField;
window.deleteTask = deleteTask;
window.moveTask = moveTask;
window.updateTaskStatus = updateTaskStatus;
window.updateTaskNotes = updateTaskNotes;
window.viewJob = viewJob;
