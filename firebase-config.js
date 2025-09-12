// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQvr257MnUMdv-i4VkgjaGUPnSho3F_x0",
  authDomain: "minehead-badminton-tournament.firebaseapp.com",
  projectId: "minehead-badminton-tournament",
  storageBucket: "minehead-badminton-tournament.firebasestorage.app",
  messagingSenderId: "237720155580",
  appId: "1:237720155580:web:8faed76ef425f262d727b9",
  measurementId: "G-RG7J53MLE2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };