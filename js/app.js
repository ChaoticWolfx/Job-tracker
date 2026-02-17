// Data Structure & State
let currentUser = null;
let jobs = [];
let teamMembers = [];
let currentJobId = null;
let viewingArchives = false;
let dragSrcIndex = null;
let dragType = null;

function getJobKey() { return 'jobTrackerData_' + currentUser.toLowerCase(); }
function getTeamKey() { return 'teamTrackerData_' + currentUser.toLowerCase(); }

function loadData() { 
    jobs = JSON.parse(localStorage.getItem(getJobKey())) || []; 
    teamMembers = JSON.parse(localStorage.getItem(getTeamKey())) || [];
}
function saveData() { 
    localStorage.setItem(getJobKey(), JSON.stringify(jobs)); 
    localStorage.setItem(getTeamKey(), JSON.stringify(teamMembers));
}

// --- Login Logic ---
function login() {
    const input = document.getElementById('username-input').value.trim();
    if(input === "") { alert("Please enter a name."); return; }
    currentUser = input;
    loadData();
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    document.getElementById('app-footer').classList.remove('hidden');
    document.getElementById('header-title').innerText = currentUser + "'s Jobs";
    viewingArchives = false;
    renderJobs();
}

function logout() {
    currentUser = null; jobs = []; teamMembers = [];
    document.getElementById('username-input').value = '';
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.add('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('app-footer').classList.add('hidden');
    document.getElementById('header-title').innerText = "Job Tracker";
}

// --- View Logic ---
function goHome() {
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('job-detail-view').classList.add('hidden');
    renderJobs();
}

function viewJob(jobId) {
    currentJobId = jobId;
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('job-detail-view').classList.remove('hidden');
    renderTasks();
}

// --- Team Management ---
function openTeamModal() {
    renderTeamList();
    document.getElementById('team-modal').classList.remove('hidden');
}
function closeTeamModal() { document.getElementById('team-modal').classList.add('hidden'); }

function addTeamMember() {
    const input = document.getElementById('new-team-member');
    const name = input.value.trim();
    if(name) {
        if(!teamMembers.includes(name)) { teamMembers.push(name); saveData(); renderTeamList(); }
        input.value = '';
    }
}
function removeTeamMember(index) {
    teamMembers.splice(index, 1);
    saveData();
    renderTeamList();
}
function renderTeamList() {
    const list = document.getElementById('team-list');
    list.innerHTML = '';
    if(teamMembers.length === 0) list.innerHTML = '<li style="color:var(--gray); font-size:14px;">No team members added.</li>';
    teamMembers.forEach((member, index) => {
        list.innerHTML += `<li style="display:flex; justify-content:space-between; margin-bottom:10px; padding:10px; background:var(--light-gray); border-radius:6px;">
            ${member} <button onclick="removeTeamMember(${index})" style="color:red; background:none; border:none; font-weight:bold; cursor:pointer;">X</button>
        </li>`;
    });
}

// --- Drag and Drop Handlers ---
function handleDragStart(e, index, type) {
    dragSrcIndex = index;
    dragType = type;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
function handleDragEnter(e) { e.currentTarget.classList.add('drag-over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function handleDragEnd(e) { e.target.style.opacity = '1'; }

function handleDropJob(e, targetIndex) {
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    if (dragSrcIndex !== targetIndex && dragType === 'job') {
        const item = jobs.splice(dragSrcIndex, 1)[0];
        jobs.splice(targetIndex, 0, item);
        saveData();
        renderJobs();
    }
    return false;
}

function handleDropTask(e, targetIndex) {
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    if (dragSrcIndex !== targetIndex && dragType === 'task') {
        const jobIndex = jobs.findIndex(j => j.id === currentJobId);
        const item = jobs[jobIndex].tasks.splice(dragSrcIndex, 1)[0];
        jobs[jobIndex].tasks.splice(targetIndex, 0, item);
        saveData();
        renderTasks();
    }
    return false;
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
    
    const displayJobs = jobs.map((job, index) => ({...job, originalIndex: index}))
                            .filter(j => viewingArchives ? j.isArchived : !j.isArchived);

    if(displayJobs.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--gray); margin-top:20px;">${viewingArchives ? "No archived jobs." : "No active jobs."}</p>`;
        return;
    }

    displayJobs.forEach((job) => {
        const total = job.tasks.length;
        const completed = job.tasks.filter(t => t.status === 'Complete').length;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        
        let badges = '';
        if(job.priority === 'High') badges += `<span class="badge badge-High">High Priority</span> `;
        if(job.priority === 'Low') badges += `<span class="badge badge-Low">Low Priority</span> `;
        if(job.assignedTo) badges += `<span class="badge badge-Assignee">👤 ${job.assignedTo}</span>`;

        const card = document.createElement('div');
        card.className = 'card draggable';
        card.draggable = true;
        
        card.addEventListener('dragstart', (e) => handleDragStart(e, job.originalIndex, 'job'));
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', (e) => handleDropJob(e, job.originalIndex));
        card.addEventListener('dragend', handleDragEnd);

        card.onclick = () => viewJob(job.id);
        card.style.opacity = job.isArchived ? '0.7' : '1';
        
        card.innerHTML = `
            <button class="btn-danger btn-small" onclick="event.stopPropagation(); deleteJobFromHome(${job.id})" style="position:absolute; top:12px; right:12px; padding: 2px 8px; font-size:12px;">X</button>
            ${badges ? `<div style="margin-bottom:8px;">${badges}</div>` : ''}
            <h3 style="padding-right: 30px;">${job.title} ${job.isArchived ? '(Archived)' : ''}</h3>
            <p style="color: var(--gray); font-size: 14px; margin-top: 5px;">${total > 0 ? `${completed}/${total} Tasks Done` : 'No tasks'}</p>
            <div class="progress-container"><div class="progress-fill" style="width: ${percent}%;"></div></div>
        `;
        container.appendChild(card);
    });
}

function openAddJobModal() {
    const select = document.getElementById('add-job-assignee');
    select.innerHTML = '<option value="">Myself (Unassigned)</option>';
    teamMembers.forEach(member => { select.innerHTML += `<option value="${member}">${member}</option>`; });
    
    document.getElementById('add-job-title').value = '';
    document.getElementById('add-job-priority').value = 'Normal';
    document.getElementById('add-job-modal').classList.remove('hidden');
}
function closeAddJobModal() { document.getElementById('add-job-modal').classList.add('hidden'); }

function saveNewJob() {
    const title = document.getElementById('add-job-title').value.trim();
    const priority = document.getElementById('add-job-priority').value;
    const assignee = document.getElementById('add-job-assignee').value;

    if (!title) { alert("Please enter a job title."); return; }

    jobs.push({ id: Date.now(), title: title, priority: priority, assignedTo: assignee, tasks: [], isArchived: false });
    saveData();
    
    if(viewingArchives) { viewingArchives = false; document.getElementById('toggle-archive-btn').innerText = "Show Archives"; document.getElementById('toggle-archive-btn').style.background = "var(--light-gray)"; }
    
    closeAddJobModal();
    renderJobs();
}

function deleteJobFromHome(jobId) {
    if(confirm("PERMANENTLY delete this job and all tasks?")) {
        jobs = jobs.filter(j => j.id !== jobId);
        saveData();
        renderJobs();
    }
}

function archiveCurrentJob() {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    jobs[jobIndex].isArchived = !jobs[jobIndex].isArchived;
    saveData();
    goHome();
}

function deleteCurrentJob() {
    if(confirm("PERMANENTLY delete this job?")) {
        jobs = jobs.filter(j => j.id !== currentJobId);
        saveData();
        goHome();
    }
}

// --- Tasks Logic ---
function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    const job = jobs.find(j => j.id === currentJobId);

    document.getElementById('current-job-title').innerText = job.title;
    document.getElementById('current-job-status').innerText = job.isArchived ? "Status: Archived" : "Status: Active";
    
    let topBadges = '';
    if(job.priority === 'High') topBadges += `<span class="badge badge-High">High Priority</span> `;
    if(job.priority === 'Low') topBadges += `<span class="badge badge-Low">Low Priority</span> `;
    if(job.assignedTo) topBadges += `<span class="badge badge-Assignee">Assigned to: ${job.assignedTo}</span>`;
    document.getElementById('current-job-badges').innerHTML = topBadges;

    job.tasks.forEach((task, index) => {
        let dateDisplay = '';
        if (task.hasDate && task.dueDate) {
            const [year, month, day] = task.dueDate.split('-');
            const taskDate = new Date(year, month - 1, day);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const isPastDue = taskDate < today && task.status !== 'Complete';
            dateDisplay = `<div class="${isPastDue ? 'past-due' : ''}" style="margin-top: 5px; font-size: 14px;">
                <span style="display:inline-block; margin-right:5px;">📅</span>Due: ${task.dueDate} ${isPastDue ? '(Past Due!)' : ''}
            </div>`;
        }

        let badgeDisplay = '';
        if(task.priority === 'High') badgeDisplay = `<span class="badge badge-High" style="margin-bottom:0;">High</span>`;
        if(task.priority === 'Low') badgeDisplay = `<span class="badge badge-Low" style="margin-bottom:0;">Low</span>`;

        const taskEl = document.createElement('div');
        taskEl.className = `task-row draggable task-${task.status.replace(' ', '-')}`;
        taskEl.draggable = true;

        taskEl.addEventListener('dragstart', (e) => handleDragStart(e, index, 'task'));
        taskEl.addEventListener('dragover', handleDragOver);
        taskEl.addEventListener('dragenter', handleDragEnter);
        taskEl.addEventListener('dragleave', handleDragLeave);
        taskEl.addEventListener('drop', (e) => handleDropTask(e, index));
        taskEl.addEventListener('dragend', handleDragEnd);

        taskEl.innerHTML = `
            <div class="task-header">
                <div style="font-size: 18px; line-height:1.2;">${badgeDisplay} ${task.title}</div>
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

function toggleDateField() { document.getElementById('new-task-date').classList.toggle('hidden'); }

function addTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const desc = document.getElementById('new-task-desc').value.trim();
    const priority = document.getElementById('new-task-priority').value;
    const hasDate = document.getElementById('new-task-has-date').checked;
    const dueDate = document.getElementById('new-task-date').value;

    if (!title) return alert("Enter a task name.");
    if (hasDate && !dueDate) return alert("Please select a due date.");
    
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    
    jobs[jobIndex].tasks.push({ 
        id: Date.now(), title: title, desc: desc, priority: priority, status: 'Not Started', notes: '', hasDate: hasDate, dueDate: dueDate
    });
    
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-desc').value = '';
    document.getElementById('new-task-priority').value = 'Normal';
    document.getElementById('new-task-has-date').checked = false;
    document.getElementById('new-task-date').value = '';
    document.getElementById('new-task-date').classList.add('hidden');
    
    saveData();
    renderTasks();
}

function updateTaskStatus(taskId, newStatus) {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === taskId);
    jobs[jobIndex].tasks[taskIndex].status = newStatus;
    saveData();
    renderTasks(); 
}

function updateTaskNotes(taskId, notes) {
    const jobIndex = jobs.findIndex(j => j.id === currentJobId);
    const taskIndex = jobs[jobIndex].tasks.findIndex(t => t.id === taskId);
    jobs[jobIndex].tasks[taskIndex].notes = notes;
    saveData();
}

function deleteTask(taskId) {
    if(confirm("Remove this task?")) {
        const jobIndex = jobs.findIndex(j => j.id === currentJobId);
        jobs[jobIndex].tasks = jobs[jobIndex].tasks.filter(t => t.id !== taskId);
        saveData();
        renderTasks();
    }
}

// --- ADMIN OVERVIEW LOGIC ---
function openAllUsersJobsModal() {
    const container = document.getElementById('all-users-container');
    container.innerHTML = '';
    let foundAny = false;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('jobTrackerData_')) {
            const rawName = key.replace('jobTrackerData_', '');
            const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            
            try {
                const userJobs = JSON.parse(localStorage.getItem(key)) || [];
                const activeJobs = userJobs.filter(j => !j.isArchived);
                foundAny = true;
                
                const userDiv = document.createElement('div');
                userDiv.style.marginBottom = '15px';
                userDiv.style.border = '1px solid var(--light-gray)';
                userDiv.style.borderRadius = '8px';
                userDiv.style.overflow = 'hidden';
                
                const userHeader = document.createElement('div');
                userHeader.style.background = 'var(--light-gray)';
                userHeader.style.padding = '12px 15px';
                userHeader.style.fontWeight = 'bold';
                userHeader.style.cursor = 'pointer';
                userHeader.style.display = 'flex';
                userHeader.style.justifyContent = 'space-between';
                userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▼</span>`;
                
                const jobsListContainer = document.createElement('div');
                jobsListContainer.style.display = 'none';
                jobsListContainer.style.background = 'white';
                
                if (activeJobs.length === 0) {
                    jobsListContainer.innerHTML = '<div style="padding:15px;"><em style="color: var(--gray); font-size: 14px;">No active jobs.</em></div>';
                } else {
                    activeJobs.forEach(job => {
                        const completed = job.tasks.filter(t => t.status === 'Complete').length;
                        const total = job.tasks.length;
                        
                        const jobRow = document.createElement('div');
                        jobRow.style.borderBottom = '1px solid #eee';
                        
                        const jobHeader = document.createElement('div');
                        jobHeader.style.padding = '12px 15px';
                        jobHeader.style.cursor = 'pointer';
                        jobHeader.style.display = 'flex';
                        jobHeader.style.justifyContent = 'space-between';
                        jobHeader.innerHTML = `<strong>${job.title}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▼</span>`;
                        
                        const taskList = document.createElement('div');
                        taskList.style.display = 'none';
                        taskList.style.padding = '10px 15px 15px 25px';
                        taskList.style.background = '#fafafa';
                        
                        if(total === 0) {
                            taskList.innerHTML = '<em style="color:var(--gray); font-size:13px;">No tasks.</em>';
                        } else {
                            let tHtml = '<ul style="margin:0; padding-left:15px; font-size:14px; line-height:1.6;">';
                            job.tasks.forEach(t => {
                                let color = t.status === 'Complete' ? 'var(--success)' : (t.status === 'In Progress' ? 'var(--primary)' : 'var(--gray)');
                                tHtml += `<li>${t.title} <span style="color:${color}; font-size:12px;">[${t.status}]</span></li>`;
                            });
                            tHtml += '</ul>';
                            taskList.innerHTML = tHtml;
                        }

                        jobHeader.onclick = (e) => {
                            e.stopPropagation();
                            if(taskList.style.display === 'none') {
                                taskList.style.display = 'block';
                                jobHeader.innerHTML = `<strong>${job.title}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▲</span>`;
                            } else {
                                taskList.style.display = 'none';
                                jobHeader.innerHTML = `<strong>${job.title}</strong> <span style="color: var(--gray); font-size: 13px;">(${completed}/${total}) ▼</span>`;
                            }
                        };

                        jobRow.appendChild(jobHeader);
                        jobRow.appendChild(taskList);
                        jobsListContainer.appendChild(jobRow);
                    });
                }
                
                userHeader.onclick = () => {
                    if (jobsListContainer.style.display === 'none') {
                        jobsListContainer.style.display = 'block';
                        userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▲</span>`;
                    } else {
                        jobsListContainer.style.display = 'none';
                        userHeader.innerHTML = `<span>👤 ${userName}</span> <span style="color: var(--primary);">${activeJobs.length} Active ▼</span>`;
                    }
                };
                
                userDiv.appendChild(userHeader);
                userDiv.appendChild(jobsListContainer);
                container.appendChild(userDiv);
            } catch (e) { console.error("Could not parse data for " + key); }
        }
    }
    if (!foundAny) container.innerHTML = '<p style="color: var(--gray); text-align: center; margin-top: 20px;">No users found.</p>';
    document.getElementById('all-users-modal').classList.remove('hidden');
}

function closeAllUsersJobsModal() { document.getElementById('all-users-modal').classList.add('hidden'); }

// --- PRINT LOGIC ---
function openPrintModal() {
    document.getElementById('print-modal').classList.remove('hidden');
    document.getElementById('print-archive-toggle').checked = false;
    generatePrintPreview();
}
function closePrintModal() { document.getElementById('print-modal').classList.add('hidden'); }

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
            let jAssignee = job.assignedTo ? ` (Assigned to: ${job.assignedTo})` : '';
            html += `<div style="margin-bottom: 25px;"><h3 style="font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">${jPriority}${job.title} ${job.isArchived ? '(Archived)' : ''}${jAssignee}</h3>`;
            
            if(job.tasks.length === 0) { html += `<p style="margin-left:15px;">No tasks.</p>`; } 
            else {
                html += `<ul style="margin-left: 25px; list-style-type: square; line-height: 1.6;">`;
                job.tasks.forEach(task => {
                    let tPriority = task.priority === 'High' ? '<strong style="color:red;">[HIGH]</strong> ' : '';
                    html += `<li style="margin-bottom: 10px;">${tPriority}<strong>${task.title}</strong> - Status: <em>${task.status}</em>`;
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

function executePrint() {
    document.getElementById('real-print-area').innerHTML = document.getElementById('print-preview-area').innerHTML;
    setTimeout(() => { window.print(); }, 100);
}

// --- MODAL LOGIC FOR ABOUT & CHANGELOG ---
function openAboutModal() { document.getElementById('about-modal').classList.remove('hidden'); }
function closeAboutModal() { document.getElementById('about-modal').classList.add('hidden'); }

let currentLogIndex = 0;
function openChangelogModal() {
    document.getElementById('changelog-modal').classList.remove('hidden');
    if (currentLogIndex === 0) { document.getElementById('changelog-container').innerHTML = ''; loadMoreLogs(); }
}
function closeChangelogModal() { document.getElementById('changelog-modal').classList.add('hidden'); }

function loadMoreLogs() {
    const container = document.getElementById('changelog-container');
    let loadedThisTime = 0;
    while (loadedThisTime < 2 && currentLogIndex < allLogs.length) {
        const logData = allLogs[currentLogIndex];
        let html = `<div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">`;
        html += `<h3 class="version-title">${logData.version}</h3><ul class="changelog-list">`;
        logData.changes.forEach(change => { html += `<li>${change}</li>`; });
        html += `</ul></div>`;
        container.innerHTML += html;
        currentLogIndex++; loadedThisTime++;
    }
    if (currentLogIndex >= allLogs.length) document.getElementById('load-more-logs-btn').classList.add('hidden');
    else document.getElementById('load-more-logs-btn').classList.remove('hidden');
}
