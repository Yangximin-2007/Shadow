import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAPFr1AwJhZsWHf60GD72L8vd69UFiDNTI",
  authDomain: "shadow-capital-db.firebaseapp.com",
  projectId: "shadow-capital-db",
  storageBucket: "shadow-capital-db.firebasestorage.app",
  messagingSenderId: "65564690552",
  appId: "1:65564690552:web:eafa250e24343fabf5c58d",
  measurementId: "G-KVWT5SEY7Z"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
