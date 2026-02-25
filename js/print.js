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
            container.innerHTML = '<p style="color: var(--gray); text-align: center;">No tasks found in this job.</p>';
        } else {
            job.tasks.forEach(task => {
                container.innerHTML += `
                    <label style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px; cursor: pointer; color: var(--text);">
                        <input type="checkbox" class="print-item-cb" value="${task.id}" checked onchange="generatePrintPreview()" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0; cursor: pointer;"> 
                        <span style="font-weight: 500;">${task.title}</span>
                    </label>`;
            });
        }
    } else {
        const includeArchives = document.getElementById('print-archive-toggle').checked;
        const filteredJobs = state.jobs.filter(job => includeArchives || !job.isArchived);
        
        if(filteredJobs.length === 0) {
            container.innerHTML = '<p style="color: var(--gray); text-align: center;">No jobs to list.</p>';
        } else {
            filteredJobs.forEach(job => {
                container.innerHTML += `
                    <label style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px; cursor: pointer; color: var(--text);">
                        <input type="checkbox" class="print-item-cb" value="${job.id}" checked onchange="generatePrintPreview()" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0; cursor: pointer;"> 
                        <span style="font-weight: 500;">${job.title || 'Untitled'} ${job.isArchived ? '<span style="color: var(--danger); font-size: 12px; margin-left: 5px;">(Archived)</span>' : ''}</span>
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
                    <li style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom:12px;">
                        <div style="font-size:16px; display: flex; align-items: center;">
                            ${statusIcon} <span style="${textStyle}">${task.title}</span>
                        </div>
                        <div style="margin-left:32px; font-size:14px; color:#444; margin-top: 6px;">
                            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                                ${task.assignedTo ? `<span><strong>Lead:</strong> ${getAssigneeText(task.assignedTo)}</span>` : ''}
                                ${task.priority && task.priority !== 'Normal' ? `<span><strong>Priority:</strong> ${task.priority}</span>` : ''}
                                ${task.dueDate ? `<span><strong>Due:</strong> ${task.dueDate} ${task.dueTime || ''}</span>` : ''}
                            </div>
                            ${task.desc ? `<div style="margin-top:6px; font-style: italic; color: #555;">📝 ${task.desc}</div>` : ''}
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
                        
                        let textStyle = isComplete ? 'text-decoration: line-through; color: #666;' : 'color: black; font-weight: 500;';

                        html += `<li style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee;">
                                    <div style="font-size: 15px; display: flex; align-items: center;">
                                        ${statusIcon} <span style="${textStyle}">${t.title}</span>
                                    </div>
                                    <div style="margin-left: 26px; font-size: 13px; color: #555; margin-top: 5px;">
                                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                                            ${t.assignedTo ? `<span><strong>Lead:</strong> ${getAssigneeText(t.assignedTo)}</span>` : ''}
                                            ${t.priority && t.priority !== 'Normal' ? `<span><strong>Priority:</strong> ${t.priority}</span>` : ''}
                                            ${t.dueDate ? `<span><strong>Due:</strong> ${t.dueDate} ${t.dueTime || ''}</span>` : ''}
                                        </div>
                                        ${t.desc ? `<div style="margin-top: 4px; font-style: italic;">📝 ${t.desc}</div>` : ''}
                                    </div>
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
