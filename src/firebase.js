import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB0GlULzskkU2g3X2A1_0rtlKv34lAkTtY",
  authDomain: "ds-locker.firebaseapp.com",
  projectId: "ds-locker",
  storageBucket: "ds-locker.firebasestorage.app",
  messagingSenderId: "514012629826",
  appId: "1:514012629826:web:1da5b2e1cda3e7aa8956db"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
