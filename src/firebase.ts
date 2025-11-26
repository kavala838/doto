// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyA6Kg9xN_kgp_XUuJIVek2vB8utpn0O02w",
    authDomain: "doto-8ee56.firebaseapp.com",
    databaseURL: "https://doto-8ee56-default-rtdb.firebaseio.com",
    projectId: "doto-8ee56",
    storageBucket: "doto-8ee56.firebasestorage.app",
    messagingSenderId: "335709821304",
    appId: "1:335709821304:web:6709effe81dbfdd9f9108d",
    measurementId: "G-MN6BLENTFP"
  };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
