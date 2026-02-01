import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { environment } from 'src/environments/environment';

// Initialize Firebase once
const app = initializeApp(environment.firebase);

// Export Singletons
export const db = getFirestore(app);
export const auth = getAuth(app);
export const firebaseApp = app;
