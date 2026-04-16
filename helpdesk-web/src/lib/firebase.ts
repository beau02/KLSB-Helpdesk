import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIcKHdCrqh3LHPJ99nPFRmb29T3cPHcNU",
  authDomain: "klsbhelpdesk.firebaseapp.com",
  projectId: "klsbhelpdesk",
  storageBucket: "klsbhelpdesk.firebasestorage.app",
  messagingSenderId: "828464230591",
  appId: "1:828464230591:web:74dcea73b0902ef7dd560a",
  measurementId: "G-XZWV6X8PSN",
};

export const firebaseReady = true;

const app = firebaseReady
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const analytics =
  app && typeof window !== "undefined" && firebaseConfig.measurementId
    ? getAnalytics(app)
    : null;