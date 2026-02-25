import { state } from './state.js';

// --- THEME ---
export function loadThemePreference() { 
    const isDark = localStorage.getItem('jobTrackerDarkMode') === 'true'; 
    if (isDark) { 
        document.body.classList.add('dark-mode'); 
        const toggle = document.getElementById('dark-mode-toggle'); 
        if(toggle) toggle.checked = true; 
    } 
}

export function toggleDarkMode() { 
    const isDark = document.getElementById('dark-mode-toggle').checked; 
    if (isDark) { 
        document.body.classList.add('dark-mode'); 
        localStorage.setItem('jobTrackerDarkMode', 'true'); 
    } else { 
        document.body.classList.remove('dark-mode'); 
        localStorage.setItem('jobTrackerDarkMode', 'false'); 
    } 
}

// --- BASIC MODALS ---
export function openAboutModal() { document.getElementById('about-modal').classList.remove('hidden'); }
export function closeAboutModal() { document.getElementById('about-modal').classList.add('hidden'); }
export function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
export function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }
export function openChangelogModal() { document.getElementById('changelog-modal').classList.remove('hidden'); }
export function closeChangelogModal() { document.getElementById('changelog-modal').classList.add('hidden'); }

// --- PRINTING UTILITIES ---
export function restoreAppAfterPrint() { 
    const printArea = document.getElementById('real-print-area'); 
    printArea.classList.add('hidden'); 
    printArea.style.display = 'none'; 
    printArea.innerHTML = ''; 
    document.getElementById('main-app-wrapper').style.display = 'block'; 
    document.querySelectorAll('.modal').forEach(m => m.style.display = ''); 
}

export function executePrint() { 
    const previewHTML = document.getElementById('print-preview-area').innerHTML; 
    if (!previewHTML) return alert("Nothing to print!"); 
    
    const printArea = document.getElementById('real-print-area'); 
    closePrintModal(); 
    
    document.getElementById('main-app-wrapper').style.display = 'none'; 
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
    
    printArea.classList.remove('hidden'); 
    printArea.style.display = 'block'; 
    printArea.style.background = 'white'; 
    printArea.style.color = 'black'; 
    
    printArea.innerHTML = `<button class="btn btn-primary no-print-btn" onclick="restoreAppAfterPrint()" style="margin-bottom: 25px;">⬅️ Return to App</button>${previewHTML}`; 
    
    setTimeout(() => { window.print(); }, 500); 
}

export function closePrintModal() { 
    document.getElementById('print-modal').classList.add('hidden'); 
}
