import { state } from './state.js';
import { db } from './firebase.js';
import { saveData, loadData } from './api.js';
import { renderJobs } from './jobs.js';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- UI & MODALS ---
export function openTeamModal() { 
    renderTeamList(); 
    document.getElementById('team-modal').classList.remove('hidden'); 
}

export function closeTeamModal() { 
    document.getElementById('team-modal').classList.add('hidden'); 
}

export function switchTeamTab(tab) { 
    if(tab === 'manual') { 
        document.getElementById('team-tab-manual').classList.remove('hidden'); 
        document.getElementById('team-tab-invite').classList.add('hidden'); 
        document.getElementById('tab-btn-manual').className = 'btn btn-primary'; 
        document.getElementById('tab-btn-invite').className = 'btn btn-outline'; 
    } else { 
        document.getElementById('team-tab-manual').classList.add('hidden'); 
        document.getElementById('team-tab-invite').classList.remove('hidden'); 
        document.getElementById('tab-btn-manual').className = 'btn btn-outline'; 
        document.getElementById('tab-btn-invite').className = 'btn btn-primary'; 
    } 
}

export function populateDropdowns() { 
    let optionsHTML = '<option value="">Unassigned</option>'; 
    state.teamMembers.forEach(member => { 
        optionsHTML += `<option value="${member.name}">${member.name} (${member.role})</option>`; 
    }); 
    
    ['add-job-assignee', 'new-task-assignee', 'edit-job-assignee', 'edit-task-assignee'].forEach(id => { 
        const el = document.getElementById(id); 
        if(el) el.innerHTML = optionsHTML; 
    }); 
}

export function getAssigneeText(name) { 
    if (!name) return ''; 
    const member = state.teamMembers.find(m => m.name === name); 
    return (member && member.role) ? `${name} (${member.role})` : name; 
}

export function renderTeamList() { 
    const list = document.getElementById('team-list'); 
    list.innerHTML = ''; 
    
    if(state.teamMembers.length === 0) list.innerHTML = '<li style="color:var(--gray); font-size:14px;">No manual team members added.</li>'; 
    
    state.teamMembers.forEach((member, index) => { 
        list.innerHTML += `<li style="display:flex; justify-content:space-between; align-items: center; margin-bottom:10px; padding:10px; background:var(--light-gray); border-radius:6px;">
            <div>
                <strong>${member.name}</strong><br>
                <span style="font-size:12px; color:var(--gray);">${member.role}</span>
            </div>
            <button class="btn-icon" onclick="removeTeamMember(${index})" style="color:red; font-weight:bold;">X</button>
        </li>`; 
    }); 
}

// --- DATA ACTIONS ---
export async function addTeamMember() { 
    const name = document.getElementById('new-team-member').value.trim(); 
    const role = document.getElementById('new-team-role').value.trim() || 'Team Member'; 
    
    if(name) { 
        const exists = state.teamMembers.find(m => m.name.toLowerCase() === name.toLowerCase()); 
        if(!exists) { 
            state.teamMembers.push({name: name, role: role}); 
            renderTeamList(); 
            await saveData(); 
        } 
        document.getElementById('new-team-member').value = ''; 
        document.getElementById('new-team-role').value = ''; 
    } 
}

export async function removeTeamMember(index) { 
    const member = state.teamMembers[index]; 
    await deleteDoc(doc(db, "team", member.firebaseId || member.name.replace(/[^a-zA-Z0-9]/g, ''))); 
    state.teamMembers.splice(index, 1); 
    renderTeamList(); 
}

// --- INVITE SYSTEM ---
export async function sendTeamInvite() {
    const email = document.getElementById('invite-team-email').value.trim().toLowerCase(); 
    const role = document.getElementById('invite-team-role').value; 
    if(!email) return alert("Please enter an email address.");
    
    try {
        await addDoc(collection(db, "invites"), { fromUid: state.currentUserUid, fromName: state.currentUserName, toEmail: email, role: role, status: 'pending', createdAt: Date.now() });
        const subject = encodeURIComponent("You're invited to join my crew on TaskGrid"); 
        const body = encodeURIComponent(`Hey!\n\nI am using TaskGrid to manage our jobs. I've officially invited you to join the crew as a ${role}.\n\nGo to:\n${window.location.origin}${window.location.pathname}\n\nMake sure you log in with this exact email address (${email}) to automatically accept the invite.\n\nSee you on the site,\n${state.currentUserName}`);
        
        const a = document.createElement('a'); 
        a.href = `mailto:${email}?subject=${subject}&body=${body}`; 
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
        
        document.getElementById('invite-team-email').value = ''; 
        closeTeamModal();
    } catch (e) { alert("Failed to send invite: " + e.message); }
}

export async function checkForPendingInvites() { 
    try { 
        const q = query(collection(db, "invites"), where("toEmail", "==", state.currentUserEmail), where("status", "==", "pending")); 
        const snapshot = await getDocs(q); 
        if (!snapshot.empty) { 
            state.currentPendingInvite = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }; 
            document.getElementById('invite-sender-name').innerText = state.currentPendingInvite.fromName; 
            document.getElementById('invite-role-name').innerText = state.currentPendingInvite.role; 
            document.getElementById('pending-invite-modal').classList.remove('hidden'); 
        } 
    } catch(e) { console.error("Error checking invites", e); } 
}

export async function acceptTeamInvite() { 
    if(!state.currentPendingInvite) return; 
    try { 
        await updateDoc(doc(db, "invites", state.currentPendingInvite.id), { status: 'accepted' }); 
        
        const teamDocId = state.currentUserName.replace(/[^a-zA-Z0-9]/g, '') + "_" + state.currentPendingInvite.fromUid; 
        await setDoc(doc(db, "team", teamDocId), { name: state.currentUserName, email: state.currentUserEmail, uid: state.currentUserUid, role: state.currentPendingInvite.role, ownerUid: state.currentPendingInvite.fromUid, owner: state.currentPendingInvite.fromName }); 
        
        await setDoc(doc(db, "users", state.currentUserUid), { bossUid: state.currentPendingInvite.fromUid }, { merge: true }); 
        
        alert("Invite accepted!"); 
        document.getElementById('pending-invite-modal').classList.add('hidden'); 
        
        await loadData(); 
        renderJobs(); 
    } catch(e) { alert("Error: " + e.message); } 
}

export async function declineTeamInvite() { 
    if(!state.currentPendingInvite) return; 
    try { 
        await updateDoc(doc(db, "invites", state.currentPendingInvite.id), { status: 'declined' }); 
        document.getElementById('pending-invite-modal').classList.add('hidden'); 
    } catch(e) { console.error("Error declining invite", e); } 
}
