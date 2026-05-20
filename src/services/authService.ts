import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
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

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();

  // ב-Electron (file://) popup לא עובד — נשתמש ב-redirect
  const isElectron = typeof window !== 'undefined' &&
    window.location.protocol === 'file:';

  if (isElectron) {
    throw new Error('ELECTRON_ENV');
  }

  const cred = await signInWithPopup(auth, provider);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));

  if (snap.exists()) {
    return snap.data() as User;
  }

  // משתמש Google חדש — נוצר כעובד (caregiver) עד שמנהל ישנה תפקיד
  const user: User = {
    id: cred.user.uid,
    email: cred.user.email ?? '',
    name: cred.user.displayName ?? cred.user.email?.split('@')[0] ?? '',
    role: 'caregiver',
    weeklyHours: 0,
    isBlocked: false,
    blockOverride: false,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', cred.user.uid), user);
  return user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function fetchUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}
