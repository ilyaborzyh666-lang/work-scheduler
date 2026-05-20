import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import { Shift, ShiftType, ShiftStatus, SHIFT_CONFIG, SHIFT_RULES } from '../types';
import { getWeekStart, getWeekEnd } from '../utils/dateUtils';

async function createNotification(
  userId: string,
  type: 'shift_approved' | 'shift_rejected' | 'hours_limit',
  title: string,
  body: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      body,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // notification failure is non-critical
  }
}

async function syncEmployeeWeeklyHours(employeeId: string, shiftDate: string): Promise<void> {
  try {
    const weekDate = new Date(shiftDate);
    const weekStart = getWeekStart(weekDate);
    const weekEnd = getWeekEnd(weekDate);
    const q = query(
      collection(db, 'shifts'),
      where('employeeId', '==', employeeId),
      where('status', '==', 'approved'),
      where('date', '>=', weekStart),
      where('date', '<=', weekEnd)
    );
    const snap = await getDocs(q);
    const totalHours = snap.docs
      .map(d => d.data() as Shift)
      .reduce((sum, s) => sum + s.durationHours, 0);
    const userSnap = await getDoc(doc(db, 'users', employeeId));
    const blockOverride = userSnap.exists() ? (userSnap.data().blockOverride ?? false) : false;
    const isBlocked = !blockOverride && totalHours >= SHIFT_RULES.MAX_WEEKLY_HOURS;
    await updateDoc(doc(db, 'users', employeeId), { weeklyHours: totalHours, isBlocked });
  } catch {
    // sync failure is non-critical — approval already saved
  }
}

export async function approveAllPendingForEmployee(employeeId: string): Promise<number> {
  const q = query(
    collection(db, 'shifts'),
    where('employeeId', '==', employeeId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { status: 'approved' })));
  const firstDate = (snap.docs[0].data() as Shift).date;
  await syncEmployeeWeeklyHours(employeeId, firstDate);
  return snap.docs.length;
}

export async function getWeeklyHours(employeeId: string, weekDate: Date): Promise<number> {
  const weekStart = getWeekStart(weekDate);
  const weekEnd = getWeekEnd(weekDate);
  const q = query(
    collection(db, 'shifts'),
    where('employeeId', '==', employeeId),
    where('status', '==', 'approved'),
    where('date', '>=', weekStart),
    where('date', '<=', weekEnd)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data() as Shift)
    .reduce((sum, s) => sum + s.durationHours, 0);
}

export function validateShiftRequest(
  shiftType: ShiftType,
  customHours: number | null,
  lastShiftEnd: string | null,
  newShiftStart: string
): string | null {
  const hours = customHours ?? SHIFT_CONFIG[shiftType].hours;
  if (hours < SHIFT_RULES.MIN_SHIFT_HOURS) return `משמרת מינימום ${SHIFT_RULES.MIN_SHIFT_HOURS} שעות`;
  if (hours > SHIFT_RULES.MAX_SHIFT_HOURS) return `משמרת מקסימום ${SHIFT_RULES.MAX_SHIFT_HOURS} שעות`;

  if (lastShiftEnd) {
    const last = new Date(lastShiftEnd).getTime();
    const next = new Date(newShiftStart).getTime();
    const restHours = (next - last) / (1000 * 60 * 60);
    if (restHours < SHIFT_RULES.MIN_REST_HOURS)
      return `חובה ${SHIFT_RULES.MIN_REST_HOURS} שעות מנוחה בין משמרות`;
  }
  return null;
}

export async function requestShift(
  employeeId: string,
  employeeName: string,
  date: string,
  type: ShiftType,
  weeklyHours: number
): Promise<{ shift: Shift | null; error: string | null }> {
  if (!auth.currentUser || auth.currentUser.uid !== employeeId) {
    return { shift: null, error: 'לא מורשה לבצע פעולה זו' };
  }
  const day = new Date().getDay();
  if (day < 3 || day > 5) {
    return { shift: null, error: 'ניתן להגיש בקשות משמרת רק ביום רביעי עד שישי' };
  }
  const config = SHIFT_CONFIG[type];
  const newTotal = weeklyHours + config.hours;

  if (newTotal > SHIFT_RULES.MAX_WEEKLY_HOURS) {
    return { shift: null, error: `חרגת ממכסת ${SHIFT_RULES.MAX_WEEKLY_HOURS} שעות שבועיות` };
  }

  const validationError = validateShiftRequest(type, null, null, `${date}T${config.start}`);
  if (validationError) return { shift: null, error: validationError };

  const dupQ = query(
    collection(db, 'shifts'),
    where('employeeId', '==', employeeId),
    where('date', '==', date),
    where('type', '==', type),
    where('status', 'in', ['pending', 'approved'])
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) {
    return { shift: null, error: 'כבר קיימת בקשה לאותה משמרת בתאריך זה' };
  }

  const shift: Omit<Shift, 'id'> = {
    employeeId,
    employeeName,
    date,
    type,
    startTime: config.start,
    endTime: config.end,
    durationHours: config.hours,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, 'shifts'), shift);
  return { shift: { ...shift, id: ref.id }, error: null };
}

async function countApprovedForShift(date: string, type: ShiftType, excludeShiftId?: string): Promise<number> {
  const q = query(
    collection(db, 'shifts'),
    where('date', '==', date),
    where('type', '==', type),
    where('status', '==', 'approved')
  );
  const snap = await getDocs(q);
  return snap.docs.filter(d => d.id !== excludeShiftId).length;
}

export async function updateShiftStatus(
  shiftId: string,
  status: ShiftStatus,
  employeeId?: string,
  shiftDate?: string,
  shiftType?: ShiftType
): Promise<{ error?: string }> {
  if (status === 'approved' && shiftDate && shiftType) {
    const max = SHIFT_RULES.MAX_WORKERS_PER_SHIFT[shiftType];
    const current = await countApprovedForShift(shiftDate, shiftType, shiftId);
    if (current >= max) {
      return { error: `משמרת ${shiftType === 'morning' ? 'בוקר' : shiftType === 'afternoon' ? 'צהוריים' : 'לילה'} בתאריך ${shiftDate} מלאה (מקסימום ${max} עובדים)` };
    }
  }
  await updateDoc(doc(db, 'shifts', shiftId), { status });
  if (employeeId && shiftDate) {
    const dateLabel = shiftDate;
    const typeLabel = shiftType ? (SHIFT_CONFIG[shiftType] ? shiftType : '') : '';
    if (status === 'approved') {
      await syncEmployeeWeeklyHours(employeeId, shiftDate);
      await createNotification(
        employeeId,
        'shift_approved',
        'המשמרת שלך אושרה ✅',
        `משמרת ${typeLabel} בתאריך ${dateLabel} אושרה על ידי המנהל`
      );
    } else if (status === 'rejected') {
      await createNotification(
        employeeId,
        'shift_rejected',
        'המשמרת שלך נדחתה ❌',
        `משמרת ${typeLabel} בתאריך ${dateLabel} נדחתה על ידי המנהל`
      );
    }
  }
  return {};
}

export async function deleteShift(shiftId: string): Promise<void> {
  await deleteDoc(doc(db, 'shifts', shiftId));
}

export async function getShiftsByDate(date: string): Promise<Shift[]> {
  const q = query(collection(db, 'shifts'), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Shift))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function getEmployeeShifts(employeeId: string): Promise<Shift[]> {
  const q = query(
    collection(db, 'shifts'),
    where('employeeId', '==', employeeId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Shift))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getShiftManagerShifts(shiftManagerId: string): Promise<Shift[]> {
  const { getMyEmployees } = await import('./userService');
  const employees = await getMyEmployees(shiftManagerId);
  if (employees.length === 0) return [];
  const ids = employees.slice(0, 30).map(e => e.id);
  const q = query(collection(db, 'shifts'), where('employeeId', 'in', ids));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Shift))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getAllShifts(): Promise<Shift[]> {
  const snap = await getDocs(collection(db, 'shifts'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Shift))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getAllPendingShifts(): Promise<Shift[]> {
  const q = query(collection(db, 'shifts'), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Shift))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPendingShiftsByEmployees(employeeIds: string[]): Promise<Shift[]> {
  if (employeeIds.length === 0) return [];
  // Firestore מגביל 'in' ל-30 ערכים — מספיק למחלקה רגילה
  const ids = employeeIds.slice(0, 30);
  const q = query(
    collection(db, 'shifts'),
    where('status', '==', 'pending'),
    where('employeeId', 'in', ids)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Shift))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateShiftHoursAndApprove(
  shiftId: string,
  startTime: string,
  endTime: string,
  durationHours: number,
  employeeId: string,
  shiftDate: string,
  originalHours?: number,
  shiftType?: ShiftType
): Promise<{ error?: string }> {
  if (shiftType) {
    const max = SHIFT_RULES.MAX_WORKERS_PER_SHIFT[shiftType];
    const current = await countApprovedForShift(shiftDate, shiftType, shiftId);
    if (current >= max) {
      return { error: `משמרת ${shiftType === 'morning' ? 'בוקר' : shiftType === 'afternoon' ? 'צהוריים' : 'לילה'} בתאריך ${shiftDate} מלאה (מקסימום ${max} עובדים)` };
    }
  }
  await updateDoc(doc(db, 'shifts', shiftId), {
    startTime,
    endTime,
    durationHours,
    status: 'approved',
  });
  await syncEmployeeWeeklyHours(employeeId, shiftDate);

  const typeLabel = shiftType ?? '';
  const hoursChanged = originalHours !== undefined && originalHours !== durationHours;
  const body = hoursChanged
    ? `משמרת ${typeLabel} בתאריך ${shiftDate} אושרה — שעות עודכנו מ-${originalHours} ל-${durationHours} שעות (${startTime}–${endTime})`
    : `משמרת ${typeLabel} בתאריך ${shiftDate} אושרה — ${startTime}–${endTime} (${durationHours} שעות)`;

  await createNotification(employeeId, 'shift_approved', 'המשמרת שלך אושרה ✅', body);
  return {};
}

