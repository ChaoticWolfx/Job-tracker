import { state } from './state.js';
import { saveData } from './api.js';
import { renderTasks } from './tasks.js';
import { populateDropdowns, getAssigneeText } from './team.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';

// --- NAVIGATION ---
export function goHome() { 
    state.currentJobId = null; 
    document.getElementById('home-view').classList.remove('hidden'); 
    document.getElementById('job-detail-view').classList.add('hidden'); 
    renderJobs(); 
}

export function viewJob(jobId) { 
    state.currentJobId = jobId; 
    document.getElementById('home-view').classList.add('hidden'); 
    document.getElementById('job-detail-view').classList.remove('hidden'); 
    populateDropdowns(); 
    renderTasks(); 
}

// --- VIEW CONTROLS ---
export function toggleArchives() { 
    state.viewingArchives = !state.viewingArchives; 
    const btn = document.getElementById('toggle-archive-btn'); 
    btn.innerText = state.viewingArchives ? "Show Active" : "Show Archives"; 
    btn.style.background = state.viewingArchives ? "var(--warning)" : "var(--light-gray)"; 
    btn.style.color = state.viewingArchives ? "white" : "var(--text)"; 
    renderJobs(); 
}

// --- RENDERING ---
export function renderJobs() {
    const container = document.getElementById('jobs-container'); 
    if (!container) return;
    container.innerHTML = '';
    
    // Filter based on Archive state
    const displayJobs = state.jobs.filter(j => state.viewingArchives ? j.isArchived : !j.isArchived);
    
    if(displayJobs.length === 0) { 
        container.innerHTML = `<p style="text-align:center; color:var(--gray); margin-top:40px; padding: 20px;">${state.viewingArchives ? "No archived jobs." : "No active jobs."}</p>`; 
        return; 
    }
    
    displayJobs.forEach((job) => {
        // Calculate Progress Stats
        const total = job.tasks ? job.tasks.length : 0; 
        const completed = job.tasks ? job.tasks.filter(t => t.status === 'Complete').length : 0; 
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        
        // Dynamic Bar Color Logic
        let barColor = 'var(--danger)'; 
        if (percent === 100) barColor = 'var(--success)'; 
        else if (percent >= 50) barColor = 'var(--warning)'; 
        if (total === 0) barColor = 'var(--gray)';
        
        // Generate Badges for the card
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
            <h3 style="padding-right: 70px; margin: 0 0 5px 0; color: var(--text);">
                ${job.title || 'Untitled Job'} ${job.isArchived ? '(Archived)' : ''}
            </h3>
            <p style="color: var(--gray); font-size: 14px; margin: 0 0 10px 0;">
                ${total > 0 ? `${completed}/${total} Tasks Done (${percent}%)` : 'No tasks'}
            </p>
            <div class="progress-container">
                <div class="progress-fill" style="width: ${percent}%; background-color: ${barColor};"></div>
            </div>
        `;
        container.appendChild(card);
    });
    
    // Sortable initialization
    if (state.jobSortable) state.jobSortable.destroy();
    state.jobSortable = Sortable.create(container, { 
        handle: '.drag-handle', 
        animation: 150, 
        ghostClass: 'sortable-ghost', 
        onEnd: async function () { 
            const items = container.querySelectorAll('.card'); 
            let newOrderIds = Array.from(items).map(el => parseInt(el.dataset.id)); 
            const visibleJobs = state.jobs.filter(j => state.viewingArchives ? j.isArchived : !j.isArchived); 
            const hiddenJobs = state.jobs.filter(j => state.viewingArchives ? !j.isArchived : j.isArchived); 
            
            visibleJobs.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id)); 
            state.jobs = [...visibleJobs, ...hiddenJobs]; 
            await saveData(); 
        } 
    });
}

// --- MODAL & DATA ACTIONS ---
export function openAddJobModal() { 
    populateDropdowns(); 
    document.getElementById('add-job-title').value = ''; 
    document.getElementById('add-job-priority').value = 'Normal'; 
    document.getElementById('add-job-date').value = ''; 
    document.getElementById('add-job-time').value = ''; 
    document.getElementById('add-job-modal').classList.remove('hidden'); 
}

export function closeAddJobModal() { document.getElementById('add-job-modal').classList.add('hidden'); }

export async function saveNewJob() { 
    const title = document.getElementById('add-job-title').value.trim(); 
    if (!title) return alert("Please enter a job title."); 
    
    state.jobs.push({ 
        id: Date.now(), 
        title: title, 
        priority: document.getElementById('add-job-priority').value, 
        assignedTo: document.getElementById('add-job-assignee').value, 
        startDate: document.getElementById('add-job-date').value, 
        startTime: document.getElementById('add-job-time').value, 
        tasks: [], 
        isArchived: false, 
        isShared: false 
    }); 
    
    if(state.viewingArchives) { 
        state.viewingArchives = false; 
        document.getElementById('toggle-archive-btn').innerText = "Show Archives"; 
        document.getElementById('toggle-archive-btn').style.background = "var(--light-gray)"; 
        document.getElementById('toggle-archive-btn').style.color = "var(--text)"; 
    } 
    
    closeAddJobModal(); 
    renderJobs(); 
    await saveData(); 
}

export function openEditJobModal() { 
    populateDropdowns(); 
    const job = state.jobs.find(j => j.id === state.currentJobId); 
    if(!job) return;
    document.getElementById('edit-job-title').value = job.title; 
    document.getElementById('edit-job-priority').value = job.priority || 'Normal'; 
    document.getElementById('edit-job-assignee').value = job.assignedTo || ''; 
    document.getElementById('edit-job-date').value = job.startDate || ''; 
    document.getElementById('edit-job-time').value = job.startTime || ''; 
    document.getElementById('edit-job-modal').classList.remove('hidden'); 
}

export function closeEditJobModal() { document.getElementById('edit-job-modal').classList.add('hidden'); }

export async function saveEditedJob() { 
    const title = document.getElementById('edit-job-title').value.trim(); 
    if (!title) return alert("Title cannot be empty."); 
    
    const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
    state.jobs[jobIndex].title = title; 
    state.jobs[jobIndex].priority = document.getElementById('edit-job-priority').value; 
    state.jobs[jobIndex].assignedTo = document.getElementById('edit-job-assignee').value; 
    state.jobs[jobIndex].startDate = document.getElementById('edit-job-date').value; 
    state.jobs[jobIndex].startTime = document.getElementById('edit-job-time').value; 
    
    closeEditJobModal(); 
    renderTasks(); 
    await saveData(); 
}

export async function deleteJobFromHome(jobId) { 
    if(confirm("PERMANENTLY delete this job?")) { 
        const job = state.jobs.find(j => j.id === jobId); 
        await deleteDoc(doc(db, "jobs", job.firebaseId || job.id.toString())); 
        state.jobs = state.jobs.filter(j => j.id !== jobId); 
        renderJobs(); 
    } 
}

export async function deleteCurrentJob() { 
    if(confirm("PERMANENTLY delete this job?")) { 
        const job = state.jobs.find(j => j.id === state.currentJobId); 
        await deleteDoc(doc(db, "jobs", job.firebaseId || job.id.toString())); 
        state.jobs = state.jobs.filter(j => j.id !== state.currentJobId); 
        goHome(); 
    } 
}

export async function archiveCurrentJob() { 
    if(!confirm("Archive job?")) return; 
    const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
    state.jobs[jobIndex].isArchived = !state.jobs[jobIndex].isArchived; 
    goHome(); 
    await saveData(); 
}

export async function shareCurrentJob() { 
    const jobIndex = state.jobs.findIndex(j => j.id === state.currentJobId); 
    if(jobIndex < 0) return; 
    
    state.jobs[jobIndex].isShared = true; 
    await saveData(); 
    
    const shareUrl = window.location.origin + window.location.pathname + '?job=' + (state.jobs[jobIndex].firebaseId || state.jobs[jobIndex].id.toString()); 
    try { 
        await navigator.clipboard.writeText(shareUrl); 
        alert("🔗 Link copied!"); 
    } catch (err) { 
        alert("Share this link: \n" + shareUrl); 
    } 
}
