import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import { LeaveRequest, LeaveStatus, SHIFT_RULES } from '../types';
import { daysBetween, daysFromNow } from '../utils/dateUtils';

export function validateLeaveRequest(
  startDate: string,
  endDate: string
): string | null {
  const duration = daysBetween(startDate, endDate);
  const daysAhead = daysFromNow(startDate);

  if (duration <= 1) return 'תאריך סיום חייב להיות לפחות יום אחד אחרי תאריך התחלה';

  if (duration <= SHIFT_RULES.SHORT_LEAVE_MAX_DAYS) {
    if (daysAhead < SHIFT_RULES.SHORT_LEAVE_NOTICE_DAYS)
      return `חופשה קצרה דורשת ${SHIFT_RULES.SHORT_LEAVE_NOTICE_DAYS} ימי הודעה מראש`;
  } else {
    if (daysAhead < SHIFT_RULES.LONG_LEAVE_NOTICE_DAYS)
      return `חופשה ארוכה דורשת ${SHIFT_RULES.LONG_LEAVE_NOTICE_DAYS} ימי הודעה מראש`;
  }

  return null;
}

export async function requestLeave(
  employeeId: string,
  employeeName: string,
  startDate: string,
  endDate: string,
  reason: string
): Promise<{ leave: LeaveRequest | null; error: string | null }> {
  if (auth.currentUser && auth.currentUser.uid !== employeeId) {
    return { leave: null, error: 'לא מורשה לבצע פעולה זו' };
  }
  const validationError = validateLeaveRequest(startDate, endDate);
  if (validationError) return { leave: null, error: validationError };

  const leave: Omit<LeaveRequest, 'id'> = {
    employeeId,
    employeeName,
    startDate,
    endDate,
    durationDays: daysBetween(startDate, endDate),
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, 'leaves'), leave);
  return { leave: { ...leave, id: ref.id }, error: null };
}

export async function updateLeaveStatus(
  leaveId: string,
  status: LeaveStatus
): Promise<void> {
  await updateDoc(doc(db, 'leaves', leaveId), { status });

  try {
    const snap = await getDoc(doc(db, 'leaves', leaveId));
    if (!snap.exists()) return;
    const leave = snap.data() as LeaveRequest;
    const title = status === 'approved' ? 'החופשה שלך אושרה ✅' : 'החופשה שלך נדחתה ❌';
    const body = status === 'approved'
      ? `חופשה מ-${leave.startDate} עד ${leave.endDate} אושרה`
      : `חופשה מ-${leave.startDate} עד ${leave.endDate} נדחתה`;
    await addDoc(collection(db, 'notifications'), {
      userId: leave.employeeId,
      title,
      body,
      type: status === 'approved' ? 'leave_approved' : 'leave_rejected',
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // notification failure is non-critical
  }
}

export async function getEmployeeLeaves(employeeId: string): Promise<LeaveRequest[]> {
  const q = query(collection(db, 'leaves'), where('employeeId', '==', employeeId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAllPendingLeaves(): Promise<LeaveRequest[]> {
  const q = query(collection(db, 'leaves'), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
