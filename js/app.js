// --- FIREBASE IMPORTS (CDN for Browser usage) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBpeJ6rGw24Mf_xcno9zj9Q6MQW-2HuuMA",
  authDomain: "jobtracker-4d6eb.firebaseapp.com",
  projectId: "jobtracker-4d6eb",
  storageBucket: "jobtracker-4d6eb.firebasestorage.app",
  messagingSenderId: "1074805891410",
  appId: "1:1074805891410:web:e4dde23db3ced1b9061a8b",
  measurementId: "G-PV9V64CJZ5"
};

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- APP STATE ---
let currentUser = null;
let jobs = [];
let teamMembers = [];
let currentJobId = null; // This will now be the Firestore Document ID
let viewingArchives = false;
let dragSrcIndex = null;
let dragType = null;

// --- CLOUD FUNCTIONS (ASYNC) ---

// Load data from Firestore instead of LocalStorage
async function loadCloudData() {
    const jobsRef = collection(db, "jobs");
    const teamRef = collection(db, "team");

    // 1. Get Jobs for this user
    const qJobs = query(jobsRef, where("owner", "==", currentUser.toLowerCase()));
    const querySnapshotJobs = await getDocs(qJobs);
    jobs = querySnapshotJobs.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));

    // 2. Get Team for this user
    const qTeam = query(teamRef, where("owner", "==", currentUser.toLowerCase()));
    const querySnapshotTeam = await getDocs(qTeam);
    teamMembers = querySnapshotTeam.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
}

// --- APP LOGIC ---

// Login is now Async because it has to wait for the Cloud
window.login = async function() {
    const input = document.getElementById('username-input').value.trim();
    if(input === "") { alert("Please enter a name."); return; }
    
    // Show a temporary loading state
    const btn = document.querySelector('#login-view .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Loading Cloud Data...";
    
    currentUser = input;
    
    await loadCloudData(); // Wait for database
    
    btn.innerText = originalText;
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    document.getElementById('app-footer').classList.remove('hidden');
    document.getElementById('header-title').innerText = currentUser + "'s Jobs";
    viewingArchives = false;
    renderJobs();
}

window.logout = function() {
    currentUser = null; jobs = []; teamMembers = [];
    document.getElementById('username-input').value = '';
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.add('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('app-footer').classList.add('hidden');
    document.getElementById('header-title').innerText = "Job Tracker";
}

window.goHome = function() {
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('job-detail-view').classList.add('hidden');
    renderJobs();
}

window.viewJob = function(firestoreId) {
    currentJobId = firestoreId;
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.remove('hidden');
    populateDropdowns();
    renderTasks();
}

// --- TEAM MANAGEMENT ---

window.openTeamModal = function() {
    renderTeamList();
    document.getElementById('team-modal').classList.remove('hidden');
}
window.closeTeamModal = function() { document.getElementById('team-modal').classList.add('hidden'); }

window.addTeamMember = async function() {
    const nameInput = document.getElementById('new-team-member');
    const roleInput = document.getElementById('new-team-role');
    const name = nameInput.value.trim();
    const role = roleInput.value.trim() || 'Team Member';
    
    if(name) {
        // Save to Cloud
        const docRef = await addDoc(collection(db, "team"), {
            owner: currentUser.toLowerCase(),
            name: name,
            role: role
        });
        
        // Update Local State
        teamMembers.push({ name: name, role: role, firestoreId: docRef.id });
        renderTeamList();
        
        nameInput.value = '';
        roleInput.value = '';
    }
}

window.removeTeamMember = async function(index) {
    const member = teamMembers[index];
    // Delete from Cloud
    await deleteDoc(doc(db, "team", member.firestoreId));
    
    // Update Local
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
    teamMembers.forEach(member => { 
        optionsHTML += `<option value="${member.name}">${member.name} (${member.role})</option>`; 
    });
    
    const jobDropdown = document.getElementById('add-job-assignee');
    const taskDropdown = document.getElementById('new-task-assignee');
    
    if(jobDropdown) jobDropdown.innerHTML = optionsHTML;
    if(taskDropdown) taskDropdown.innerHTML = optionsHTML;
}

// --- JOBS LOGIC ---

window.toggleArchives = function() {
    viewingArchives = !viewingArchives;
    const btn = document.getElementById('toggle-archive-btn');
    btn.innerText = viewingArchives ? "Show Active" : "Show Archives";
    btn.style.background = viewingArchives ? "var(--warning)" : "var(--light-gray)";
    renderJobs();
}

function renderJobs() {
    const container = document.getElementById('jobs-container');
    container.innerHTML = '';
    
    // Filter locally
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
        if(job.assignedTo) badges += `<span class="badge badge-Assignee">👷 ${job.assignedTo}</span>`;

        const card = document.createElement('div');
        card.className = 'card'; // Temporarily removed draggable for simplicity in Cloud migration
        
        card.onclick = () => viewJob(job.firestoreId);
        card.style.opacity = job.isArchived ? '0.7' : '1';
        
        card.innerHTML = `
            <button class="btn-danger btn-small" onclick="event.stopPropagation(); deleteJobFromHome('${job.firestoreId}')" style="position:absolute; top:12px; right:12px; padding: 2px 8px; font-size:12px;">X</button>
            ${badges ? `<div style="margin-bottom:8px;">${badges}</div>` : ''}
            <h3 style="padding-right: 30px;">${job.title} ${job.isArchived ? '(Archived)' : ''}</h3>
            <p style="color: var(--gray); font-size: 14px; margin-top: 5px;">${total > 0 ? `${completed}/${total} Tasks Done` : 'No tasks'}</p>
            <div class="progress-container"><div class="progress-fill" style="width: ${percent}%;"></div></div>
        `;
        container.appendChild(card);
    });
}

window.openAddJobModal = function() {
    populateDropdowns();
    document.getElementById('add-job-title').value = '';
    document.getElementById('add-job-priority').value = 'Normal';
    document.getElementById('add-job-modal').classList.remove('hidden');
}
window.closeAddJobModal = function() { document.getElementById('add-job-modal').classList.add('hidden'); }

window.saveNewJob = async function() {
    const title = document.getElementById('add-job-title').value.trim();
    const priority = document.getElementById('add-job-priority').value;
    const assignee = document.getElementById('add-job-assignee').value;

    if (!title) { alert("Please enter a job title."); return; }
    
    // Save to Cloud
    const newJob = {
        owner: currentUser.toLowerCase(),
        title: title,
        priority: priority,
        assignedTo: assignee,
        tasks: [],
        isArchived: false,
        createdAt: Date.now()
    };
    
    const docRef = await addDoc(collection(db, "jobs"), newJob);
    
    // Update Local
    jobs.push({ ...newJob, firestoreId: docRef.id });

    if(viewingArchives) { viewingArchives = false; document.getElementById('toggle-archive-btn').innerText = "Show Archives"; document.getElementById('toggle-archive-btn').style.background = "var(--light-gray)"; }
    
    closeAddJobModal();
    renderJobs();
}

window.deleteJobFromHome = async function(firestoreId) {
    if(confirm("PERMANENTLY delete this job and all tasks?")) {
        // Delete from Cloud
        await deleteDoc(doc(db, "jobs", firestoreId));
        // Update Local
        jobs = jobs.filter(j => j.firestoreId !== firestoreId);
        renderJobs();
    }
}

window.archiveCurrentJob = async function() {
    const job = jobs.find(j => j.firestoreId === currentJobId);
    // Toggle
    job.isArchived = !job.isArchived;
    // Save to Cloud
    await updateDoc(doc(db, "jobs", currentJobId), { isArchived: job.isArchived });
    goHome();
}

window.deleteCurrentJob = async function() {
    if(confirm("PERMANENTLY delete this job?")) {
        await deleteDoc(doc(db, "jobs", currentJobId));
        jobs = jobs.filter(j => j.firestoreId !== currentJobId);
        goHome();
    }
}

// --- TASKS LOGIC (Sub-items inside the Job Document) ---

function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    const job = jobs.find(j => j.firestoreId === currentJobId);

    document.getElementById('current-job-title').innerText = job.title;
    document.getElementById('current-job-status').innerText = job.isArchived ? "Status: Archived" : "Status: Active";
    
    let topBadges = '';
    if(job.priority === 'High') topBadges += `<span class="badge badge-High">High Priority</span> `;
    if(job.priority === 'Low') topBadges += `<span class="badge badge-Low">Low Priority</span> `;
    if(job.assignedTo) topBadges += `<span class="badge badge-Assignee">Job Lead: ${job.assignedTo}</span>`;
    document.getElementById('current-job-badges').innerHTML = topBadges;

    if(!job.tasks) job.tasks = []; // Safety check

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
        if(task.assignedTo) badgeDisplay += `<span class="badge badge-Assignee" style="margin-bottom:0;">👤 ${task.assignedTo}</span>`;

        const taskEl = document.createElement('div');
        taskEl.className = `task-row task-${task.status.replace(' ', '-')}`;
        
        taskEl.innerHTML = `
            <div class="task-header" style="align-items:flex-start;">
                <div style="font-size: 18px; line-height:1.4;">${badgeDisplay}<br>${task.title}</div>
                <button class="btn-danger btn-small" style="position:absolute; top:12px; right:12px; padding: 2px 8px; font-size:12px;" onclick="event.stopPropagation(); deleteTask(${task.id})">X</button>
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

window.toggleDateField = function() { document.getElementById('new-task-date').classList.toggle('hidden'); }

window.addTask = async function() {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const priority = document.getElementById('new-task-priority').value;
    const assignee = document.getElementById('new-task-assignee').value;
    const hasDate = document.getElementById('new-task-has-date').checked;
    const dueDate = document.getElementById('new-task-date').value;

    if (!title) return alert("Enter a task name.");
    if (hasDate && !dueDate) return alert("Please select a due date.");
    
    const job = jobs.find(j => j.firestoreId === currentJobId);
    
    const newTask = { 
        id: Date.now(), title: title, desc: desc, priority: priority, assignedTo: assignee, status: 'Not Started', notes: '', hasDate: hasDate, dueDate: dueDate
    };
    
    job.tasks.push(newTask);
    
    // Save to Cloud (Update the whole tasks array)
    await updateDoc(doc(db, "jobs", currentJobId), { tasks: job.tasks });
    
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-desc').value = '';
    document.getElementById('new-task-priority').value = 'Normal';
    document.getElementById('new-task-assignee').value = '';
    document.getElementById('new-task-has-date').checked = false;
    document.getElementById('new-task-date').value = '';
    document.getElementById('new-task-date').classList.add('hidden');
    
    renderTasks();
}

window.updateTaskStatus = async function(taskId, newStatus) {
    const job = jobs.find(j => j.firestoreId === currentJobId);
    const task = job.tasks.find(t => t.id === taskId);
    task.status = newStatus;
    // Save to Cloud
    await updateDoc(doc(db, "jobs", currentJobId), { tasks: job.tasks });
    renderTasks(); 
}

window.updateTaskNotes = async function(taskId, notes) {
    const job = jobs.find(j => j.firestoreId === currentJobId);
    const task = job.tasks.find(t => t.id === taskId);
    task.notes = notes;
    // Save to Cloud
    await updateDoc(doc(db, "jobs", currentJobId), { tasks: job.tasks });
}

window.deleteTask = async function(taskId) {
    if(confirm("Remove this task?")) {
        const job = jobs.find(j => j.firestoreId === currentJobId);
        job.tasks = job.tasks.filter(t => t.id !== taskId);
        // Save to Cloud
        await updateDoc(doc(db, "jobs", currentJobId), { tasks: job.tasks });
        renderTasks();
    }
}

// --- ADMIN OVERVIEW (Now pulls from Cloud!) ---
window.openAllUsersJobsModal = async function() {
    const container = document.getElementById('all-users-container');
    container.innerHTML = '<p style="text-align:center; padding:20px;">Loading live data...</p>';
    document.getElementById('all-users-modal').classList.remove('hidden');

    // Get ALL jobs from the cloud
    const q = query(collection(db, "jobs"));
    const snapshot = await getDocs(q);
    const allJobs = snapshot.docs.map(doc => doc.data());

    container.innerHTML = '';
    
    // Group by Owner
    const jobsByOwner = {};
    allJobs.forEach(job => {
        if(!job.isArchived) {
            if(!jobsByOwner[job.owner]) jobsByOwner[job.owner] = [];
            jobsByOwner[job.owner].push(job);
        }
    });

    if(Object.keys(jobsByOwner).length === 0) {
         container.innerHTML = '<p style="color: var(--gray); text-align: center; margin-top: 20px;">No active jobs found.</p>';
         return;
    }

    Object.keys(jobsByOwner).forEach(owner => {
        const activeJobs = jobsByOwner[owner];
        const userName = owner.charAt(0).toUpperCase() + owner.slice(1);
        
        const userDiv = document.createElement('div');
        userDiv.style.marginBottom = '15px'; userDiv.style.border = '1px solid var(--light-gray)'; userDiv.style.borderRadius = '8px'; userDiv.style.overflow = 'hidden';
        
        const userHeader = document.createElement('div');
        userHeader.style.background = 'var(--light-gray)'; userHeader.style.padding = '12px 15px'; userHeader.style.fontWeight = 'bold'; userHeader.style.cursor = 'pointer'; userHeader.style.display = 'flex'; userHeader.style.justifyContent = 'space-between';
        userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▼</span>`;
        
        const jobsListContainer = document.createElement('div');
        jobsListContainer.style.display = 'none'; jobsListContainer.style.background = 'white';
        
        activeJobs.forEach(job => {
            const completed = job.tasks ? job.tasks.filter(t => t.status === 'Complete').length : 0;
            const total = job.tasks ? job.tasks.length : 0;
            const jobRow = document.createElement('div'); jobRow.style.borderBottom = '1px solid #eee';
            
            const jobHeader = document.createElement('div');
            jobHeader.style.padding = '12px 15px'; jobHeader.style.cursor = 'pointer'; jobHeader.style.display = 'flex'; jobHeader.style.justifyContent = 'space-between';
            jobHeader.innerHTML = `<strong>${job.title}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▼</span>`;
            
            const taskList = document.createElement('div');
            taskList.style.display = 'none'; taskList.style.padding = '10px 15px 15px 25px'; taskList.style.background = '#fafafa';
            
            if(total === 0) { taskList.innerHTML = '<em style="color:var(--gray); font-size:13px;">No tasks.</em>'; } 
            else {
                let tHtml = '<ul style="margin:0; padding-left:15px; font-size:14px; line-height:1.6;">';
                job.tasks.forEach(t => {
                    let color = t.status === 'Complete' ? 'var(--success)' : (t.status === 'In Progress' ? 'var(--primary)' : 'var(--gray)');
                    tHtml += `<li>${t.title} <span style="color:${color}; font-size:12px;">[${t.status}]</span></li>`;
                });
                tHtml += '</ul>'; taskList.innerHTML = tHtml;
            }

            jobHeader.onclick = (e) => {
                e.stopPropagation();
                if(taskList.style.display === 'none') { taskList.style.display = 'block'; jobHeader.innerHTML = `<strong>${job.title}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▲</span>`; } 
                else { taskList.style.display = 'none'; jobHeader.innerHTML = `<strong>${job.title}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▼</span>`; }
            };
            jobRow.appendChild(jobHeader); jobRow.appendChild(taskList); jobsListContainer.appendChild(jobRow);
        });
        
        userHeader.onclick = () => {
            if (jobsListContainer.style.display === 'none') { jobsListContainer.style.display = 'block'; userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▲</span>`; } 
            else { jobsListContainer.style.display = 'none'; userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▼</span>`; }
        };
        userDiv.appendChild(userHeader); userDiv.appendChild(jobsListContainer); container.appendChild(userDiv);
    });
}
window.closeAllUsersJobsModal = function() { document.getElementById('all-users-modal').classList.add('hidden'); }

// --- PRINT & OTHER MODALS (No Changes needed here, they rely on 'jobs' state) ---
window.openPrintModal = function() { document.getElementById('print-modal').classList.remove('hidden'); document.getElementById('print-archive-toggle').checked = false; generatePrintPreview(); }
window.closePrintModal = function() { document.getElementById('print-modal').classList.add('hidden'); }

function generatePrintPreview() {
    const includeArchives = document.getElementById('print-archive-toggle').checked;
    const printArea = document.getElementById('print-preview-area');
    const dateStr = new Date().toLocaleDateString();
    let html = `<h2>${currentUser}'s Job List</h2><p style="margin-bottom: 20px;">Generated: ${dateStr}</p><hr style="margin-bottom: 20px;">`;
    const jobsToPrint = jobs.filter(j => includeArchives ? true : !j.isArchived);
    if(jobsToPrint.length === 0) { html += `<p>No jobs found.</p>`; } 
    else {
        jobsToPrint.forEach(job => {
            let jPriority = job.priority === 'High' ? '[HIGH PRIORITY] ' : '';
            let jAssignee = job.assignedTo ? ` (Lead: ${job.assignedTo})` : '';
            html += `<div style="margin-bottom: 25px;"><h3 style="font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">${jPriority}${job.title} ${job.isArchived ? '(Archived)' : ''}${jAssignee}</h3>`;
            if(job.tasks && job.tasks.length > 0) {
                html += `<ul style="margin-left: 25px; list-style-type: square; line-height: 1.6;">`;
                job.tasks.forEach(task => {
                    let tPriority = task.priority === 'High' ? '<strong style="color:red;">[HIGH]</strong> ' : '';
                    let tAssignee = task.assignedTo ? ` <span style="color:blue;">(👤 ${task.assignedTo})</span>` : '';
                    html += `<li style="margin-bottom: 10px;">${tPriority}<strong>${task.title}</strong>${tAssignee} - Status: <em>${task.status}</em>`;
                    if (task.desc) html += `<br><span style="margin-left: 10px; font-size: 14px; color: #555;">Desc: ${task.desc}</span>`;
                    html += `</li>`;
                });
                html += `</ul>`;
            } else { html += `<p style="margin-left:15px;">No tasks.</p>`; }
            html += `</div>`;
        });
    }
    printArea.innerHTML = html;
}
window.executePrint = function() { document.getElementById('real-print-area').innerHTML = document.getElementById('print-preview-area').innerHTML; setTimeout(() => { window.print(); }, 100); }

window.openAboutModal = function() { document.getElementById('about-modal').classList.remove('hidden'); }
window.closeAboutModal = function() { document.getElementById('about-modal').classList.add('hidden'); }

const logFilesList = ['v1_13', 'v1_12', 'v1_11', 'v1_10', 'v1_9', 'v1_8', 'v1_7', 'v1_6', 'v1_5', 'v1_4', 'v1_3', 'v1_2', 'v1_1', 'v1_0'];
let currentLogIndex = 0;
window.openChangelogModal = function() {
    document.getElementById('changelog-modal').classList.remove('hidden');
    if (currentLogIndex === 0) { document.getElementById('changelog-container').innerHTML = ''; loadMoreLogs(); }
}
window.closeChangelogModal = function() { document.getElementById('changelog-modal').classList.add('hidden'); }

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
            for(let i = 1; i < lines.length; i++) { if(lines[i].trim() !== '') { html += `<li>${lines[i].replace('-', '').trim()}</li>`; } }
            html += `</ul></div>`;
            container.innerHTML += html;
        } catch (e) { }
        currentLogIndex++; loadedThisTime++;
    }
    if (currentLogIndex >= logFilesList.length) { document.getElementById('load-more-logs-btn').classList.add('hidden'); }
    else { document.getElementById('load-more-logs-btn').classList.remove('hidden'); }
}
