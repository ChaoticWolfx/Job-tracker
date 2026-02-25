import { state } from './state.js';
import { saveData } from './api.js';
import { populateDropdowns, getAssigneeText } from './team.js';

// --- RENDERING ---
export function renderTasks() {
    const container = document.getElementById('tasks-container'); 
    if (!container) return;
    container.innerHTML = '';
    
    const job = state.jobs.find(j => j.id === state.currentJobId); 
    if (!job) return;

    const hideCompleted = document.getElementById('hide-completed-tasks-toggle').checked;
    
    // Update the Job Detail Header info
    document.getElementById('current-job-title').innerText = job.title || 'Untitled';
    
    // Calendar Sync Logic
    const calAction = document.getElementById('current-job-calendar-action'); 
    if (job.startDate) { 
        calAction.innerHTML = `<button class="btn-outline btn-small" style="color:var(--primary); border-color:var(--primary);" onclick="pushSavedJobToCalendar()">📅 Sync Job to Calendar</button>`; 
    } else { 
        calAction.innerHTML = ''; 
    }
    
    // Build Header Badges
    let topBadges = ''; 
    if(job.priority === 'High') topBadges += `<span class="badge badge-High">High Priority</span> `; 
    if(job.priority === 'Low') topBadges += `<span class="badge badge-Low">Low Priority</span> `; 
    if(job.assignedTo) topBadges += `<span class="badge badge-Assignee">Job Lead: ${getAssigneeText(job.assignedTo)}</span> `; 
    if(job.startDate) topBadges += `<span class="badge" style="background:var(--light-gray); color:var(--text); border:1px solid var(--border-color);">📅 Start: ${job.startDate} ${job.startTime ? job.startTime : ''}</span>`;
    
    document.getElementById('current-job-badges').innerHTML = topBadges;
    
    // Task Filtering Logic
    if (!job.tasks) job.tasks = []; 
    let displayTasks = job.tasks; 
    if (hideCompleted) displayTasks = displayTasks.filter(t => t.status !== 'Complete');
    
    if(displayTasks.length === 0) { 
        container.innerHTML = `<p style="text-align:center; color:var(--gray); margin-top:40px; padding:20px;">No tasks visible.</p>`; 
        return; 
    }
    
    displayTasks.forEach((task) => {
        let isComplete = task.status === 'Complete'; 
        let dateDisplay = ''; 
        let syncBtnDisplay = '';
        
        if (task.dueDate) { 
            const [year, month, day] = task.dueDate.split('-'); 
            const taskDate = new Date(year, month - 1, day); 
            const today = new Date(); 
            today.setHours(0,0,0,0); 
            const isPastDue = taskDate < today && !isComplete; 
            
            dateDisplay = `<div style="margin-top: 8px; font-size: 13px; color: ${isPastDue ? 'var(--danger)' : 'var(--gray)'}; font-weight: ${isPastDue ? 'bold' : 'normal'};">📅 Due: ${task.dueDate} ${task.dueTime ? 'at ' + task.dueTime : ''} ${isPastDue ? '(Past Due!)' : ''}</div>`; 
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
                    <span class="${titleClass}" style="font-weight: 600; color: var(--text);">${checkmark}${task.title}</span>
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
                <select style="margin: 0; padding: 8px; font-size: 14px; flex: 1; background: var(--bg-color); color: var(--text);" onchange="updateTaskStatus(${task.id}, this.value)">
                    <option value="Not Started" ${task.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                    <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Complete" ${task.status === 'Complete' ? 'selected' : ''}>✅ Complete</option>
                </select>
                ${syncBtnDisplay}
            </div>
            <textarea placeholder="Ongoing notes..." onchange="updateTaskNotes(${task.id}, this.value)" rows="1" style="margin-top: 10px; padding: 8px; font-size: 14px; font-style: italic; background: var(--bg-color); color: var(--text);">${task.notes || ''}</textarea>
        `;
        container.appendChild(taskEl);
    });
    
    // Task Sortable logic
    if (state.taskSortable) state.taskSortable.destroy();
    state.taskSortable = Sortable.create(container, { 
        handle: '.drag-handle', 
        animation: 150, 
        ghostClass: 'sortable-ghost', 
        onEnd: async function() { 
            const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
            const items = container.querySelectorAll('.task-row'); 
            let newOrderIds = Array.from(items).map(el => parseInt(el.dataset.id)); 
            
            const visibleTasks = state.jobs[jobIndex].tasks.filter(t => hideCompleted ? t.status !== 'Complete' : true); 
            const hiddenTasks = state.jobs[jobIndex].tasks.filter(t => hideCompleted ? t.status === 'Complete' : false); 
            
            visibleTasks.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id)); 
            state.jobs[jobIndex].tasks = [...visibleTasks, ...hiddenTasks]; 
            await saveData(); 
        } 
    });
}

// --- MODAL & DATA ACTIONS ---
export function openAddTaskModal() { 
    populateDropdowns(); 
    document.getElementById('new-task-title').value = ''; 
    document.getElementById('new-task-desc').value = ''; 
    document.getElementById('new-task-priority').value = 'Normal'; 
    document.getElementById('new-task-assignee').value = ''; 
    document.getElementById('new-task-date').value = ''; 
    document.getElementById('new-task-time').value = ''; 
    document.getElementById('add-task-modal').classList.remove('hidden'); 
}

export function closeAddTaskModal() { document.getElementById('add-task-modal').classList.add('hidden'); }

export async function addTask() { 
    const title = document.getElementById('new-task-title').value.trim(); 
    if (!title) return alert("Enter a task name."); 
    
    const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
    state.jobs[jobIndex].tasks.push({ 
        id: Date.now(), 
        title: title, 
        desc: document.getElementById('new-task-desc').value.trim(), 
        priority: document.getElementById('new-task-priority').value, 
        assignedTo: document.getElementById('new-task-assignee').value, 
        status: 'Not Started', 
        notes: '', 
        dueDate: document.getElementById('new-task-date').value, 
        dueTime: document.getElementById('new-task-time').value 
    }); 
    
    closeAddTaskModal(); 
    renderTasks(); 
    await saveData(); 
}

export function openEditTaskModal(taskId) { 
    state.editingTaskId = taskId; 
    populateDropdowns(); 
    const job = state.jobs.find(j => j.id === state.currentJobId); 
    const task = job.tasks.find(t => t.id === taskId); 
    
    document.getElementById('edit-task-title').value = task.title; 
    document.getElementById('edit-task-desc').value = task.desc || ''; 
    document.getElementById('edit-task-priority').value = task.priority || 'Normal'; 
    document.getElementById('edit-task-assignee').value = task.assignedTo || ''; 
    document.getElementById('edit-task-date').value = task.dueDate || ''; 
    document.getElementById('edit-task-time').value = task.dueTime || ''; 
    document.getElementById('edit-task-modal').classList.remove('hidden'); 
}

export function closeEditTaskModal() { 
    document.getElementById('edit-task-modal').classList.add('hidden'); 
    state.editingTaskId = null; 
}

export async function saveEditedTask() { 
    const title = document.getElementById('edit-task-title').value.trim(); 
    if (!title) return alert("Task name cannot be empty."); 
    
    const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
    const taskIndex = state.jobs[jobIndex].tasks.findIndex(t => t.id === state.editingTaskId); 
    
    state.jobs[jobIndex].tasks[taskIndex].title = title; 
    state.jobs[jobIndex].tasks[taskIndex].desc = document.getElementById('edit-task-desc').value.trim(); 
    state.jobs[jobIndex].tasks[taskIndex].priority = document.getElementById('edit-task-priority').value; 
    state.jobs[jobIndex].tasks[taskIndex].assignedTo = document.getElementById('edit-task-assignee').value; 
    state.jobs[jobIndex].tasks[taskIndex].dueDate = document.getElementById('edit-task-date').value; 
    state.jobs[jobIndex].tasks[taskIndex].dueTime = document.getElementById('edit-task-time').value; 
    
    closeEditTaskModal(); 
    renderTasks(); 
    await saveData(); 
}

export async function updateTaskStatus(taskId, newStatus) { 
    const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
    const taskIndex = state.jobs[jobIndex].tasks.findIndex(t => t.id === taskId); 
    state.jobs[jobIndex].tasks[taskIndex].status = newStatus; 
    
    if (newStatus === 'Complete') { 
        const completedTask = state.jobs[jobIndex].tasks.splice(taskIndex, 1)[0]; 
        state.jobs[jobIndex].tasks.push(completedTask); 
    } 
    
    renderTasks(); 
    await saveData(); 
}

export async function updateTaskNotes(taskId, notes) { 
    const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
    const taskIndex = state.jobs[jobIndex].tasks.findIndex(t => t.id === taskId); 
    state.jobs[jobIndex].tasks[taskIndex].notes = notes; 
    await saveData(); 
}

export async function deleteTask(taskId) { 
    if(confirm("Remove this task?")) { 
        const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
        state.jobs[jobIndex].tasks = state.jobs[jobIndex].tasks.filter(t => t.id !== taskId); 
        renderTasks(); 
        await saveData(); 
    } 
}

// --- CALENDAR INTEGRATION ---
export function createCalendarLink(title, startDate, startTime, description) { 
    if (!startDate) return alert("Select a Date first."); 
    let startDateTime = '', endDateTime = ''; 
    
    if (startDate && startTime) { 
        const [year, month, day] = startDate.split('-'); 
        const [hour, minute] = startTime.split(':'); 
        startDateTime = `${year}${month}${day}T${hour}${minute}00`; 
        const d = new Date(year, month - 1, day, hour, minute); 
        d.setHours(d.getHours() + 1); 
        endDateTime = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`; 
    } else { 
        const [year, month, day] = startDate.split('-'); 
        startDateTime = `${year}${month}${day}`; 
        const d = new Date(year, month - 1, day); 
        d.setDate(d.getDate() + 1); 
        endDateTime = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; 
    } 
    
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("TaskGrid: " + title)}&dates=${startDateTime}/${endDateTime}&details=${encodeURIComponent(description || "Added via TaskGrid")}`, '_blank'); 
}

export function pushSavedJobToCalendar() { 
    const job = state.jobs.find(j => j.id === state.currentJobId); 
    if(job) createCalendarLink(job.title, job.startDate, job.startTime, "Job Start Date"); 
}

export function pushSavedTaskToCalendar(taskId) { 
    const job = state.jobs.find(j => j.id === state.currentJobId); 
    const task = job.tasks.find(t => t.id === taskId); 
    if(task) createCalendarLink(task.title, task.dueDate, task.dueTime, task.desc); 
}
