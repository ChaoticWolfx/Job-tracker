import { state } from './state.js';
import { getAssigneeText } from './team.js';

export function openPrintModal() {
    document.getElementById('print-modal').classList.remove('hidden');
    
    const isJobView = state.currentJobId !== null;
    document.getElementById('print-modal-title').innerText = isJobView ? "Print Task Checklist" : "Print Job List";
    
    document.getElementById('print-archive-label').style.display = isJobView ? 'none' : 'block';
    
    const container = document.getElementById('print-item-selection');
    container.innerHTML = '';

    if (isJobView) {
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

    // Add CSS to hide the "Return to App" button on the physical paper
    html += `<style>
        @media print {
            .no-print-btn { display: none !important; }
        }
    </style>`;

    if (state.currentJobId !== null) {
        // PREVIEW: Single Job Tasks
        const job = state.jobs.find(j => j.id === state.currentJobId);
        html += `<div style="color:black; font-family:sans-serif; background:white; padding:10px;">
                    <h2>${job.title} - Site Checklist</h2>
                    <p style="color: #666; font-size: 14px;">Generated: ${dateStr}</p>
                    <hr style="border: 1px solid #ccc; margin-bottom: 20px;">`;
        
        const tasksToPrint = (job.tasks || []).filter(t => selectedIds.includes(String(t.id)));
        
        if(tasksToPrint.length === 0) {
            html += `<p>No tasks selected.</p>`;
        } else {
            html += `<ul style="list-style:none; padding-left:0;">`;
            tasksToPrint.forEach(task => {
                let isComplete = task.status === 'Complete';
                let statusIcon = isComplete 
                    ? `<span style="font-size: 18px; margin-right: 10px;">✅</span>` 
                    : `<div style="display:inline-block; width:16px; height:16px; border:2px solid black; margin-right: 10px; vertical-align:middle;"></div>`;
                
                let textStyle = isComplete ? 'text-decoration: line-through; color: #666;' : 'color: black; font-weight: bold;';

                html += `
                    <li style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom:10px;">
                        <div style="font-size:16px; display: flex; align-items: center;">
                            ${statusIcon} <span style="${textStyle}">${task.title}</span>
                        </div>
                        <div style="margin-left:32px; font-size:14px; color:#444;">
                            ${task.assignedTo ? `<div>Lead: ${getAssigneeText(task.assignedTo)}</div>` : ''}
                            ${task.dueDate ? `<div>Due: ${task.dueDate}</div>` : ''}
                            ${task.desc ? `<div style="margin-top:4px; font-style: italic;">${task.desc}</div>` : ''}
                        </div>
                    </li>`;
            });
            html += `</ul>`;
        }
        html += `</div>`;
    } else {
        // PREVIEW: List of all Jobs
        html += `<div style="color:black; font-family:sans-serif; background:white; padding:10px;">
                    <h2>${state.currentUserName}'s Job Overview</h2>
                    <p style="color: #666; font-size: 14px;">Generated: ${dateStr}</p>
                    <hr style="border: 1px solid #ccc; margin-bottom: 20px;">`;
        
        const jobsToPrint = state.jobs.filter(j => selectedIds.includes(String(j.id)));
        
        if(jobsToPrint.length === 0) {
            html += `<p>No jobs selected.</p>`;
        } else {
            jobsToPrint.forEach(job => {
                html += `<div style="margin-bottom:30px;">
                            <h3 style="margin-bottom: 10px; border-bottom: 1px solid #eaeaea; padding-bottom: 5px;">${job.title || 'Untitled'}</h3>`;
                if(!job.tasks || job.tasks.length === 0) {
                    html += `<p style="color: #888; font-style: italic; margin-left: 10px;">No tasks listed.</p>`;
                } else {
                    html += `<ul style="list-style: none; padding-left: 10px;">`;
                    job.tasks.forEach(t => {
                        let isComplete = t.status === 'Complete';
                        let statusIcon = isComplete 
                            ? `<span style="font-size: 16px; margin-right: 8px;">✅</span>` 
                            : `<div style="display:inline-block; width:14px; height:14px; border:2px solid black; margin-right: 8px; vertical-align:middle;"></div>`;
                        
                        let textStyle = isComplete ? 'text-decoration: line-through; color: #666;' : 'color: black;';

                        html += `<li style="margin-bottom: 8px; font-size: 15px; display: flex; align-items: center;">
                                    ${statusIcon} <span style="${textStyle}">${t.title}</span>
                                 </li>`;
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

    document.getElementById('main-app-wrapper').style.display = 'none';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

    printArea.classList.remove('hidden');
    printArea.style.display = 'block';
    
    // Wrapped the button in a div with the no-print-btn class
    printArea.innerHTML = `
        <div class="no-print-btn" style="padding: 15px; background: var(--bg-color); text-align: center;">
            <button class="btn btn-primary" onclick="restoreAppAfterPrint()">⬅️ Return to App</button>
        </div>
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
