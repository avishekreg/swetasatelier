import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';

/** Temporary Firebase config retained until Phase 2 Auth/data cutover to Supabase. */
const firebaseConfig = {
  projectId: 'gen-lang-client-0826866258',
  appId: '1:887342511162:web:3e1dc85917fcf750e6b103',
  apiKey: 'AIzaSyD1zprj26H_9cr_sDEupzhw6uE_J8IKb4M',
  authDomain: 'gen-lang-client-0826866258.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-d29633d9-6f61-4611-a0e6-17f3f0b59e6e',
  storageBucket: 'gen-lang-client-0826866258.firebasestorage.app',
  messagingSenderId: '887342511162',
  measurementId: '',
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const sendAdminPasswordReset = (email: string) => sendPasswordResetEmail(auth, email);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firestore connection established.');
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('unavailable') || error.message.includes('offline'))
    ) {
      console.warn(
        'Firestore connectivity warning: The client may be operating in offline mode.',
        error.message
      );
    }
  }
}
testConnection();
