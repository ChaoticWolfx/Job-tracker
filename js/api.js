import { db } from './firebase.js';
import { state } from './state.js';
import { doc, setDoc, getDoc, collection, getDocs, query, where, deleteDoc, addDoc, orderBy, limit, startAfter, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function loadData() { 
    if (!state.currentUserUid) return; 
    
    state.jobs = []; 
    state.teamMembers = []; 
    
    const userDoc = await getDoc(doc(db, "users", state.currentUserUid)); 
    let queryUid = state.currentUserUid; 
    
    // If user has a boss, load the boss's jobs
    if (userDoc.exists() && userDoc.data().bossUid) { 
        queryUid = userDoc.data().bossUid; 
    }
    
    // Load Jobs
    const qJobs = query(collection(db, "jobs"), where("ownerUid", "==", queryUid)); 
    const querySnapshotJobs = await getDocs(qJobs);
    
    querySnapshotJobs.forEach((doc) => { 
        let data = doc.data(); 
        data.firebaseId = doc.id; 
        
        // Data sanitation defaults
        if(!data.id) data.id = data.createdAt || Date.now(); 
        if(!data.tasks) data.tasks = []; 
        if(typeof data.isArchived === 'undefined') data.isArchived = false; 
        if(typeof data.isShared === 'undefined') data.isShared = false; 
        
        state.jobs.push(data); 
    });
    
    state.jobs.sort((a,b) => a.id - b.id); 
    
    // Load Team
    const qTeam = query(collection(db, "team"), where("ownerUid", "==", queryUid)); 
    const querySnapshotTeam = await getDocs(qTeam);
    
    querySnapshotTeam.forEach((doc) => { 
        let data = doc.data(); 
        data.firebaseId = doc.id; 
        state.teamMembers.push(data); 
    });
}

export async function saveData() { 
    if (!state.currentUserUid) return; 
    
    const userDoc = await getDoc(doc(db, "users", state.currentUserUid)); 
    let saveUid = state.currentUserUid; 
    
    if (userDoc.exists() && userDoc.data().bossUid) { 
        saveUid = userDoc.data().bossUid; 
    }
    
    for (const job of state.jobs) { 
        await setDoc(doc(db, "jobs", job.firebaseId || job.id.toString()), { ...job, ownerUid: saveUid }); 
    }
    
    // Only the actual boss saves team members
    if (saveUid === state.currentUserUid) { 
        for (const member of state.teamMembers) { 
            await setDoc(doc(db, "team", member.firebaseId || member.name.replace(/[^a-zA-Z0-9]/g, '')), { 
                ...member, 
                owner: state.currentUserName, 
                ownerUid: state.currentUserUid 
            }); 
        } 
    }
}
