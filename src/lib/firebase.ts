import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyAPt_zFUuZw8XwmfhpqgoNhO5BDD1cCMAM",
  authDomain: "family-sync-app-5105d.firebaseapp.com",
  databaseURL: "https://family-sync-app-5105d-default-rtdb.firebaseio.com",
  projectId: "family-sync-app-5105d",
  storageBucket: "family-sync-app-5105d.firebasestorage.app",
  messagingSenderId: "20209035920",
  appId: "1:20209035920:web:6b2d01a1a602eae0518615",
  measurementId: "G-9VRTW7421N"
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
export { app, auth, db };