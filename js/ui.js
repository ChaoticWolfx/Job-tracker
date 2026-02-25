import { state } from './state.js';

/* =========================================
   THEME MANAGEMENT (Dark / Light Mode)
========================================= */
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

/* =========================================
   MODAL CONTROLS
========================================= */
// Settings Modal
export function openSettingsModal() { 
    document.getElementById('settings-modal').classList.remove('hidden'); 
}
export function closeSettingsModal() { 
    document.getElementById('settings-modal').classList.add('hidden'); 
}

// About Modal
export function openAboutModal() { 
    document.getElementById('about-modal').classList.remove('hidden'); 
}
export function closeAboutModal() { 
    document.getElementById('about-modal').classList.add('hidden'); 
}

// Updates/Changelog Modal
export function openChangelogModal() { 
    document.getElementById('changelog-modal').classList.remove('hidden'); 
    // Trigger the data load (logic is in app.js)
    if (window.loadMoreChangelogs) window.loadMoreChangelogs(true);
}
export function closeChangelogModal() { 
    document.getElementById('changelog-modal').classList.add('hidden'); 
}

/* =========================================
   UI HELPERS
========================================= */
export function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

export function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// Note: Print UI functions (executePrint, closePrintModal, etc.) 
// have been moved to js/print.js for better organization.
