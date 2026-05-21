import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, UserRole } from '../types';

const ALLOWED_SELF_REGISTER_ROLES: UserRole[] = ['doctor', 'nurse', 'caregiver'];

export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: UserRole
): Promise<User> {
  if (!ALLOWED_SELF_REGISTER_ROLES.includes(role)) {
    throw new Error('לא ניתן להירשם עם תפקיד זה');
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user: User = {
    id: cred.user.uid,
    email,
    name,
    role,
    weeklyHours: 0,
    isBlocked: false,
    blockOverride: false,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', cred.user.uid), user);
  return user;
}

export async function loginUser(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));

  if (!snap.exists()) {
    await signOut(auth);
    throw new Error('חשבון לא נמצא במערכת — פנה למנהל');
  }

  return snap.data() as User;
}

function isPopupSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return false; // Electron
  // במובייל (iOS/Android WebView) popup לא עובד
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  return !isMobile;
}

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();

  if (!isPopupSupported()) {
    await signInWithRedirect(auth, provider);
    // הדף יעשה redirect — הפונקציה לא תחזיר ערך כאן
    return new Promise(() => {});
  }

  const cred = await signInWithPopup(auth, provider);
  return _resolveGoogleUser(cred.user);
}

export async function handleGoogleRedirectResult(): Promise<User | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  return _resolveGoogleUser(result.user);
}

async function _resolveGoogleUser(firebaseUser: { uid: string; email: string | null; displayName: string | null }): Promise<User> {
  const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (snap.exists()) return snap.data() as User;

  const user: User = {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? '',
    role: 'caregiver',
    weeklyHours: 0,
    isBlocked: false,
    blockOverride: false,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', firebaseUser.uid), user);
  return user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function fetchUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}
