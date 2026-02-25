export const state = {
    // User Data
    currentUserUid: null, 
    currentUserEmail: null, 
    currentUserName: null, 
    currentUserPhoto: null,
    ADMIN_UID: "7cX7BVQxqwMTrsX0NVH5hIruLBW2",

    // Core App Data
    jobs: [], 
    teamMembers: [], 
    adminViewJobs: [], 
    currentPendingInvite: null,
    sharedJobData: null, 

    // UI View States
    currentJobId: null, 
    viewingArchives: false, 
    isSignUpMode: false,
    editingTaskId: null,
    lastChangelogVisible: null,

    // Plugin States
    jobSortable: null,
    taskSortable: null
};
