window.onerror = function(msg, url, line) { alert("Code Crash: " + msg + " (Line: " + line + ")"); };

// --- CORE IMPORTS ---
import { state } from './state.js';
import { db } from './firebase.js';
import { saveData } from './api.js';
import { doc, getDoc, collection, addDoc, getDocs, query, orderBy, startAfter, limit, setDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- FEATURE IMPORTS ---
import { toggleAuthMode, handleEmailAuth, loginWithGoogle, logout, initAuthListener } from './auth.js';
import { loadThemePreference, toggleDarkMode, openAboutModal, closeAboutModal, openSettingsModal, closeSettingsModal, openChangelogModal, closeChangelogModal } from './ui.js';
import { renderJobs, openAddJobModal, closeAddJobModal, saveNewJob, openEditJobModal, closeEditJobModal, saveEditedJob, goHome, viewJob, toggleArchives, shareCurrentJob, deleteJobFromHome, deleteCurrentJob, archiveCurrentJob } from './jobs.js';
import { renderTasks, openAddTaskModal, closeAddTaskModal, addTask, openEditTaskModal, closeEditTaskModal, saveEditedTask, updateTaskStatus, updateTaskNotes, deleteTask, pushSavedJobToCalendar, pushSavedTaskToCalendar } from './tasks.js';
import { openTeamModal, closeTeamModal, switchTeamTab, sendTeamInvite, addTeamMember, removeTeamMember, acceptTeamInvite, declineTeamInvite } from './team.js';
import { openPrintModal, closePrintModal, generatePrintPreview, executePrint, restoreAppAfterPrint } from './print.js';

// --- INITIALIZATION & ROUTING ---
loadThemePreference();

const urlParams = new URLSearchParams(window.location.search);
const sharedJobId = urlParams.get('job');

if (sharedJobId) { 
    // MODE 1: Viewing a Public Shared Link
    document.getElementById('login-view').classList.add('hidden'); 
    document.getElementById('app-footer').classList.add('hidden'); // Ensure footer is hidden
    loadSharedJob(sharedJobId); 
} else {
    // MODE 2: Normal App Login/Usage
    initAuthListener();
}

async function loadSharedJob(firebaseDocId) {
    try {
        const docRef = doc(db, "jobs", firebaseDocId); 
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().isShared === true) {
            state.sharedJobData = docSnap.data(); 
            document.getElementById('shared-job-view').classList.remove('hidden'); 
            document.getElementById('shared-job-title').innerText = state.sharedJobData.title || "Untitled Job"; 
            document.getElementById('shared-job-owner').innerText = "Created by: " + (state.sharedJobData.owner || "Unknown User");
            
            const container = document.getElementById('shared-tasks-container'); 
            container.innerHTML = '';
            
            if(!state.sharedJobData.tasks || state.sharedJobData.tasks.length === 0) { 
                container.innerHTML = '<p style="color:var(--gray); text-align:center;">No tasks found.</p>'; 
            } else {
                state.sharedJobData.tasks.forEach(task => {
                    let isComplete = task.status === 'Complete'; 
                    let color = isComplete ? 'var(--success)' : (task.status === 'In Progress' ? 'var(--primary)' : 'var(--gray)'); 
                    let checkmark = isComplete ? '✅ ' : ''; 
                    let titleStyle = isComplete ? 'text-decoration: line-through; color: var(--gray);' : '';
                    let dateStr = task.dueDate ? `<br><span style="font-size:13px; color:#d9534f;">📅 Due: ${task.dueDate}</span>` : ''; 
                    let desc = task.desc ? `<p style="font-size:14px; color:var(--gray); margin-top:5px;">${task.desc}</p>` : '';
                    
                    container.innerHTML += `
                        <div style="background:var(--light-gray); padding:15px; border-radius:6px; margin-bottom:10px; border:1px solid var(--border-color);">
                            <strong style="${titleStyle}">${checkmark}${task.title}</strong> 
                            <span style="color:${color}; font-size:12px; font-weight:bold; float:right;">[${task.status}]</span>
                            ${desc}${dateStr}
                        </div>`;
                });
            }
        } else { 
            alert("Link is invalid."); 
            window.location.href = window.location.pathname; 
        }
    } catch (e) { 
        alert("Error loading job."); 
        window.location.href = window.location.pathname; 
    }
}

function printSharedJob() { 
    if(!state.sharedJobData) return; 
    const printArea = document.getElementById('real-print-area'); 
    document.getElementById('main-app-wrapper').style.display = 'none'; 
    printArea.classList.remove('hidden'); 
    printArea.style.display = 'block'; 
    printArea.style.background = 'white'; 
    printArea.style.color = 'black'; 
    
    const dateStr = new Date().toLocaleDateString();
    
    let html = `<style>
        @media print {
            .no-print-btn { display: none !important; }
        }
    </style>`;
    
    html += `<div class="no-print-btn" style="padding: 15px; background: var(--bg-color); text-align: center;">
                <button class="btn btn-primary" onclick="restoreAppAfterPrint()">⬅️ Return to App</button>
             </div>
             <div style="color:black; font-family:sans-serif; background:white; padding:10px;">
                <h2>${state.sharedJobData.title || 'Untitled'} - Site Checklist</h2>
                <p style="color: #666; font-size: 14px;">Created by: ${state.sharedJobData.owner || 'Unknown'} | Printed: ${dateStr}</p>
                <hr style="border: 1px solid #ccc; margin-bottom: 20px;">`;
    
    let tasksHTML = '<ul style="list-style:none; padding-left:0;">'; 
    if(state.sharedJobData.tasks && state.sharedJobData.tasks.length > 0) { 
        state.sharedJobData.tasks.forEach(task => { 
            let isComplete = task.status === 'Complete'; 
            let statusIcon = isComplete 
                ? `<span style="font-size: 18px; margin-right: 10px;">✅</span>` 
                : `<div style="display:inline-block; width:16px; height:16px; border:2px solid black; margin-right: 10px; vertical-align:middle;"></div>`;
            
            let textStyle = isComplete ? 'text-decoration: line-through; color: #666;' : 'color: black; font-weight: bold;'; 
            
            tasksHTML += `
                <li style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom:12px;">
                    <div style="font-size:16px; display: flex; align-items: center;">
                        ${statusIcon} <span style="${textStyle}">${task.title}</span>
                    </div>
                    <div style="margin-left:32px; font-size:14px; color:#444; margin-top: 6px;">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            ${task.priority && task.priority !== 'Normal' ? `<span><strong>Priority:</strong> ${task.priority}</span>` : ''}
                            ${task.dueDate ? `<span><strong>Due:</strong> ${task.dueDate} ${task.dueTime || ''}</span>` : ''}
                        </div>
                        ${task.desc ? `<div style="margin-top:6px; font-style: italic; color: #555;">📝 ${task.desc}</div>` : ''}
                    </div>
                </li>`; 
        }); 
    } else {
        tasksHTML += '<p>No tasks found.</p>';
    }
    tasksHTML += '</ul></div>'; 
    
    printArea.innerHTML = html + tasksHTML; 
    setTimeout(() => { window.print(); }, 500); 
}

// --- ADMIN PANEL LOGIC ---
async function banUser(uid, userName) { 
    if(!confirm(`Ban ${userName}?`)) return; 
    await setDoc(doc(db, "banned_users", uid), { bannedAt: Date.now(), name: userName }); 
    alert(`Banned.`); 
    openAllUsersJobsModal(); 
}

async function unbanUser(uid, userName) { 
    if(!confirm(`Unban ${userName}?`)) return; 
    await deleteDoc(doc(db, "banned_users", uid)); 
    alert(`Unbanned.`); 
    openAllUsersJobsModal(); 
}

async function deleteUserData(uid, userName) { 
    if(!confirm(`Wipe data for ${userName}?`)) return; 
    const snapJobs = await getDocs(query(collection(db, "jobs"), where("ownerUid", "==", uid))); 
    snapJobs.forEach(async (d) => await deleteDoc(doc(db, "jobs", d.id))); 
    alert(`Wiped.`); 
    openAllUsersJobsModal(); 
}

async function openAllUsersJobsModal() { 
    const container = document.getElementById('all-users-container'); 
    container.innerHTML = '<p>Fetching...</p>'; 
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
        state.adminViewJobs = []; 
        
        jobsSnap.forEach((doc) => { 
            const data = doc.data(); 
            data.firebaseId = doc.id; 
            state.adminViewJobs.push(data); 
            if(data.ownerUid) { 
                if(!jobsByUid[data.ownerUid]) jobsByUid[data.ownerUid] = []; 
                jobsByUid[data.ownerUid].push(data); 
            } 
        }); 
        
        container.innerHTML = ''; 
        if (allUsers.length === 0) return container.innerHTML = '<p>No users found.</p>';

        allUsers.forEach((userData) => { 
            const userName = userData.name || "Unknown"; 
            const userUid = userData.uid; 
            const activeJobs = (jobsByUid[userUid] || []).filter(j => !j.isArchived); 
            const banBtn = bannedUids.includes(userUid) ? `<button class="btn-success btn-small" onclick="unbanUser('${userUid}', '${userName}')">Unban</button>` : `<button class="btn-warning btn-small" onclick="banUser('${userUid}', '${userName}')">Ban</button>`; 
            
            const userDiv = document.createElement('div'); 
            userDiv.style.marginBottom = '15px'; 
            userDiv.style.border = '1px solid var(--border-color)'; 
            userDiv.style.borderRadius = '8px'; 
            userDiv.style.overflow = 'hidden'; 
            
            const userHeader = document.createElement('div'); 
            userHeader.style.background = 'var(--light-gray)'; 
            userHeader.style.padding = '12px 15px'; 
            userHeader.innerHTML = `
                <div style="display:flex; justify-content:space-between; cursor:pointer;" id="toggle-${userUid}">
                    <div style="display:flex; gap:10px;">
                        <img src="${userData.photoURL || 'https://via.placeholder.com/32'}" style="width:32px; border-radius:50%;">
                        <div>
                            <strong>${userName}</strong><br>
                            <span style="font-size:12px;">${userData.email}</span>
                        </div>
                    </div>
                    <span>${activeJobs.length} Active ▼</span>
                </div>
                <div style="display:flex; gap:5px; justify-content:flex-end; padding-top:5px; border-top:1px solid var(--border-color);">
                    ${banBtn}
                    <button class="btn-danger btn-small" onclick="deleteUserData('${userUid}', '${userName}')">Wipe</button>
                </div>
            `; 
            
            const listCont = document.createElement('div'); 
            listCont.style.display = 'none'; 
            activeJobs.forEach(job => { 
                const row = document.createElement('div'); 
                row.style.padding = '10px'; 
                row.style.borderBottom = '1px solid var(--border-color)'; 
                row.innerHTML = `<strong>${job.title}</strong> <button class="btn-primary btn-small" style="float:right;" onclick="cloneJob('${job.firebaseId}')">📥 Import</button>`; 
                listCont.appendChild(row); 
            }); 
            
            userHeader.querySelector(`#toggle-${userUid}`).onclick = () => listCont.style.display = listCont.style.display === 'none' ? 'block' : 'none'; 
            userDiv.appendChild(userHeader); 
            userDiv.appendChild(listCont); 
            container.appendChild(userDiv); 
        }); 
    } catch (e) { container.innerHTML = `<p>Error: ${e.message}</p>`; } 
}

function closeAllUsersJobsModal() { document.getElementById('all-users-modal').classList.add('hidden'); }

async function cloneJob(firebaseId) { 
    const originalJob = state.adminViewJobs.find(j => j.firebaseId === firebaseId); 
    if(!originalJob || !confirm(`Import "${originalJob.title}"?`)) return; 
    
    const newJob = JSON.parse(JSON.stringify(originalJob)); 
    newJob.id = Date.now(); 
    newJob.firebaseId = newJob.id.toString(); 
    newJob.owner = state.currentUserName; 
    newJob.ownerUid = state.currentUserUid; 
    newJob.title += " (Imported)"; 
    newJob.isShared = false; 
    
    if(newJob.tasks) newJob.tasks.forEach((t, i) => t.id = Date.now() + i + 1); 
    
    state.jobs.push(newJob); 
    alert(`Imported!`); 
    renderJobs(); 
    await saveData(); 
}

async function postNewChangelog() { 
    const version = document.getElementById('admin-changelog-version').value.trim(); 
    const text = document.getElementById('admin-changelog-text').value.trim(); 
    if (!version || !text) return alert("Fill out both boxes."); 
    try { 
        await addDoc(collection(db, "changelogs"), { version, details: text, timestamp: Date.now() }); 
        alert("Success!"); 
        document.getElementById('admin-changelog-version').value = '';
        document.getElementById('admin-changelog-text').value = '';
    } catch(e) { alert("Error: " + e.message); } 
}

async function loadMoreChangelogs(isInitialLoad = false) { 
    const container = document.getElementById('changelog-container'); 
    const loadBtn = document.getElementById('load-more-logs-btn'); 
    if (isInitialLoad) container.innerHTML = ''; 
    try { 
        let logQuery = query(collection(db, "changelogs"), orderBy("timestamp", "desc"), limit(3)); 
        if (state.lastChangelogVisible && !isInitialLoad) {
            logQuery = query(collection(db, "changelogs"), orderBy("timestamp", "desc"), startAfter(state.lastChangelogVisible), limit(3));
        }
        const snapshot = await getDocs(logQuery); 
        snapshot.forEach(doc => {
            const data = doc.data();
            container.innerHTML += `<div style="margin-bottom:15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                                        <h3 style="color:var(--primary); margin:0 0 5px 0;">${data.version}</h3>
                                        <p style="margin:0; white-space: pre-wrap;">${data.details}</p>
                                    </div>`;
        });
        state.lastChangelogVisible = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.empty) loadBtn.style.display = 'none';
        else loadBtn.style.display = 'block';
    } catch (e) { console.error(e); } 
}

// ==========================================
// EXPOSE TO WINDOW FOR HTML ONCLICK HANDLERS
// ==========================================
// Auth & UI
window.toggleAuthMode = toggleAuthMode; window.handleEmailAuth = handleEmailAuth; window.loginWithGoogle = loginWithGoogle; window.logout = logout;
window.openSettingsModal = openSettingsModal; window.closeSettingsModal = closeSettingsModal; window.toggleDarkMode = toggleDarkMode;
window.openChangelogModal = openChangelogModal; window.closeChangelogModal = closeChangelogModal; window.openAboutModal = openAboutModal; window.closeAboutModal = closeAboutModal; 

// Jobs
window.goHome = goHome; window.viewJob = viewJob; window.toggleArchives = toggleArchives; 
window.openAddJobModal = openAddJobModal; window.closeAddJobModal = closeAddJobModal; window.saveNewJob = saveNewJob; 
window.openEditJobModal = openEditJobModal; window.closeEditJobModal = closeEditJobModal; window.saveEditedJob = saveEditedJob;
window.shareCurrentJob = shareCurrentJob; window.deleteJobFromHome = deleteJobFromHome; window.deleteCurrentJob = deleteCurrentJob; window.archiveCurrentJob = archiveCurrentJob; 

// Tasks
window.renderTasks = renderTasks; window.openAddTaskModal = openAddTaskModal; window.closeAddTaskModal = closeAddTaskModal; window.addTask = addTask; 
window.openEditTaskModal = openEditTaskModal; window.closeEditTaskModal = closeEditTaskModal; window.saveEditedTask = saveEditedTask;
window.updateTaskStatus = updateTaskStatus; window.updateTaskNotes = updateTaskNotes; window.deleteTask = deleteTask; 
window.pushSavedJobToCalendar = pushSavedJobToCalendar; window.pushSavedTaskToCalendar = pushSavedTaskToCalendar;

// Team
window.openTeamModal = openTeamModal; window.closeTeamModal = closeTeamModal; window.switchTeamTab = switchTeamTab; window.sendTeamInvite = sendTeamInvite; 
window.addTeamMember = addTeamMember; window.removeTeamMember = removeTeamMember; window.acceptTeamInvite = acceptTeamInvite; window.declineTeamInvite = declineTeamInvite;

// Print Logic
window.openPrintModal = openPrintModal; window.closePrintModal = closePrintModal; window.generatePrintPreview = generatePrintPreview; window.executePrint = executePrint; window.restoreAppAfterPrint = restoreAppAfterPrint; window.printSharedJob = printSharedJob;

// Admin
window.postNewChangelog = postNewChangelog; window.loadMoreChangelogs = loadMoreChangelogs; window.openAllUsersJobsModal = openAllUsersJobsModal; window.closeAllUsersJobsModal = closeAllUsersJobsModal; window.banUser = banUser; window.unbanUser = unbanUser; window.deleteUserData = deleteUserData; window.cloneJob = cloneJob;
