import { state } from './state.js';
import { getAssigneeText } from './team.js';

export function openPrintModal() {
    document.getElementById('print-modal').classList.remove('hidden');
    
    const isJobView = state.currentJobId !== null;
    document.getElementById('print-modal-title').innerText = isJobView ? "Print Task Checklist" : "Print Job List";
    
    // Hide archive toggle if we are inside a specific job
    document.getElementById('print-archive-label').style.display = isJobView ? 'none' : 'block';
    
    const container = document.getElementById('print-item-selection');
    container.innerHTML = '';

    if (isJobView) {
        // Mode: Printing tasks for one specific job
        const job = state.jobs.find(j => j.id === state.currentJobId);
        if(!job.tasks || job.tasks.length === 0) {
            container.innerHTML = '<p>No tasks found in this job.</p>';
        } else {
            job.tasks.forEach(task => {
                container.innerHTML += `
                    <label style="display:block; margin-bottom:10px; color: var(--text);">
                        <input type="checkbox" class="print-item-cb" value="${task.id}" checked onchange="generatePrintPreview()"> 
                        ${task.title}
                    </label>`;
            });
        }
    } else {
        // Mode: Printing the list of Jobs
        const includeArchives = document.getElementById('print-archive-toggle').checked;
        const filteredJobs = state.jobs.filter(job => includeArchives || !job.isArchived);
        
        if(filteredJobs.length === 0) {
            container.innerHTML = '<p>No jobs to list.</p>';
        } else {
            filteredJobs.forEach(job => {
                container.innerHTML += `
                    <label style="display:block; margin-bottom:10px; color: var(--text);">
                        <input type="checkbox" class="print-item-cb" value="${job.id}" checked onchange="generatePrintPreview()"> 
                        ${job.title || 'Untitled'} ${job.isArchived ? '(Archived)' : ''}
                    </label>`;
            });
        }
    }
    generatePrintPreview();
}

export function closePrintModal() {
    document.getElementById('print-modal').classList.add('hidden');
}

export function generatePrintPreview() {
    const selectedIds = Array.from(document.querySelectorAll('.print-item-cb'))
                            .filter(cb => cb.checked)
                            .map(cb => String(cb.value));
                            
    const printArea = document.getElementById('print-preview-area');
    const dateStr = new Date().toLocaleDateString();
    let html = '';

    if (state.currentJobId !== null) {
        // PREVIEW: Single Job Tasks
        const job = state.jobs.find(j => j.id === state.currentJobId);
        html = `<div style="color:black; font-family:sans-serif; background:white; padding:10px;">
                    <h2>${job.title} - Site Checklist</h2>
                    <p>Generated: ${dateStr}</p>
                    <hr>`;
        
        const tasksToPrint = (job.tasks || []).filter(t => selectedIds.includes(String(t.id)));
        
        if(tasksToPrint.length === 0) {
            html += `<p>No tasks selected.</p>`;
        } else {
            html += `<ul style="list-style:none; padding:0;">`;
            tasksToPrint.forEach(task => {
                let isComplete = task.status === 'Complete';
                let statusIcon = isComplete ? `✅` : `<div style="display:inline-block; width:18px; height:18px; border:2px solid black; vertical-align:middle;"></div>`;
                html += `
                    <li style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom:10px;">
                        <div style="font-size:18px;">${statusIcon} <strong>${task.title}</strong></div>
                        <div style="margin-left:25px; font-size:14px; color:#444;">
                            ${task.assignedTo ? `<div>Lead: ${getAssigneeText(task.assignedTo)}</div>` : ''}
                            ${task.dueDate ? `<div>Due: ${task.dueDate}</div>` : ''}
                            ${task.desc ? `<div style="margin-top:5px;"><em>${task.desc}</em></div>` : ''}
                        </div>
                    </li>`;
            });
            html += `</ul>`;
        }
        html += `</div>`;
    } else {
        // PREVIEW: List of all Jobs
        html = `<div style="color:black; font-family:sans-serif; background:white; padding:10px;">
                    <h2>${state.currentUserName}'s Job Overview</h2>
                    <p>Generated: ${dateStr}</p>
                    <hr>`;
        
        const jobsToPrint = state.jobs.filter(j => selectedIds.includes(String(j.id)));
        
        if(jobsToPrint.length === 0) {
            html += `<p>No jobs selected.</p>`;
        } else {
            jobsToPrint.forEach(job => {
                html += `<div style="margin-bottom:30px;">
                            <h3>${job.title || 'Untitled'}</h3>`;
                if(!job.tasks || job.tasks.length === 0) {
                    html += `<p>No tasks listed.</p>`;
                } else {
                    html += `<ul>`;
                    job.tasks.forEach(t => {
                        html += `<li>[${t.status}] ${t.title}</li>`;
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

export function executePrint() {
    const previewHTML = document.getElementById('print-preview-area').innerHTML;
    if (!previewHTML) return alert("Nothing selected to print!");

    const printArea = document.getElementById('real-print-area');
    closePrintModal();

    // Hide the app UI
    document.getElementById('main-app-wrapper').style.display = 'none';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

    printArea.classList.remove('hidden');
    printArea.style.display = 'block';
    
    printArea.innerHTML = `
        <button class="btn btn-primary no-print-btn" onclick="restoreAppAfterPrint()" style="margin-bottom: 25px;">⬅️ Return to App</button>
        ${previewHTML}`;

    setTimeout(() => { window.print(); }, 500);
}

export function restoreAppAfterPrint() {
    const printArea = document.getElementById('real-print-area');
    printArea.classList.add('hidden');
    printArea.style.display = 'none';
    printArea.innerHTML = '';
    
    document.getElementById('main-app-wrapper').style.display = 'block';
    document.querySelectorAll('.modal').forEach(m => m.style.display = '');
}
