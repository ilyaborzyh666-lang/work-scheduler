import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

export async function getAllEmployees(): Promise<User[]> {
  const q = query(collection(db, 'users'), where('role', 'in', ['doctor', 'nurse', 'caregiver']));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as User);
}

export async function getMyEmployees(shiftManagerId: string): Promise<User[]> {
  const q = query(collection(db, 'users'), where('shiftManagerId', '==', shiftManagerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as User);
}

export async function getUserById(userId: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return snap.data() as User;
}

export async function assignEmployeeToShiftManager(
  employeeId: string,
  shiftManagerId: string
): Promise<{ error?: string }> {
  const emp = await getUserById(employeeId);
  if (!emp) return { error: 'משתמש לא נמצא' };
  if (!['doctor', 'nurse', 'caregiver'].includes(emp.role)) {
    return { error: 'משתמש זה אינו עובד (רופא/אח/מטפל)' };
  }
  if (emp.shiftManagerId) {
    return { error: 'העובד כבר משויך למנהל משמרת אחר' };
  }
  await updateDoc(doc(db, 'users', employeeId), { shiftManagerId });
  return {};
}

export async function setBlockOverride(
  userId: string,
  override: boolean
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { blockOverride: override });
}

export async function updateWeeklyHours(
  userId: string,
  hours: number
): Promise<void> {
  const isBlocked = hours >= 60;
  await updateDoc(doc(db, 'users', userId), {
    weeklyHours: hours,
    isBlocked,
  });
}
