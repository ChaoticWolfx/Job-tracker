import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyBpeJ6rGw24Mf_xcno9zj9Q6MQW-2HuuMA", 
    authDomain: "jobtracker-4d6eb.firebaseapp.com", 
    projectId: "jobtracker-4d6eb", 
    storageBucket: "jobtracker-4d6eb.firebasestorage.app", 
    messagingSenderId: "1074805891410", 
    appId: "1:1074805891410:web:e4dde23db3ced1b9061a8b", 
    measurementId: "G-PV9V64CJZ5" 
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
