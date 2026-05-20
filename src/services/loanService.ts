import {
  collection, addDoc, updateDoc, doc, query, where, getDocs, getDoc, runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { LoanRequest, ShiftType } from '../types';
import { todayString } from '../utils/dateUtils';

async function sendNotification(
  userId: string,
  title: string,
  body: string,
  type: 'shift_approved' | 'shift_rejected'
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId, title, body, type, read: false,
      createdAt: new Date().toISOString(),
    });
  } catch {}
}

// מנהל A מסמן עובד שלו כזמין להשאלה להיום
export async function markEmployeeAvailableForLoan(
  employeeId: string,
  fromManagerId: string,
  shiftType: ShiftType
): Promise<{ error?: string }> {
  const today = todayString();

  // בדוק שלא קיימת כבר בקשה פעילה לאותו עובד היום
  const q = query(
    collection(db, 'loanRequests'),
    where('employeeId', '==', employeeId),
    where('date', '==', today),
    where('status', 'in', ['available', 'requested', 'approved'])
  );
  const snap = await getDocs(q);
  if (!snap.empty) return { error: 'עובד זה כבר מסומן כזמין להשאלה היום' };

  const empSnap = await getDoc(doc(db, 'users', employeeId));
  if (!empSnap.exists()) return { error: 'עובד לא נמצא' };

  await addDoc(collection(db, 'loanRequests'), {
    employeeId,
    employeeName: empSnap.data()?.name ?? '',
    fromManagerId,
    toManagerId: '',
    date: today,
    shiftType,
    status: 'available',
    fromManagerApproved: true,
    toManagerApproved: false,
    createdAt: new Date().toISOString(),
  } satisfies Omit<LoanRequest, 'id'>);

  return {};
}

// מנהל B בוחר עובד זמין ומבקש אותו למחלקתו
export async function requestLoanedEmployee(
  loanId: string,
  toManagerId: string
): Promise<{ error?: string }> {
  const snap = await getDoc(doc(db, 'loanRequests', loanId));
  if (!snap.exists()) return { error: 'בקשת השאלה לא נמצאה' };
  const loan = snap.data() as LoanRequest;
  if (loan.status !== 'available') return { error: 'עובד זה כבר אינו זמין' };
  if (loan.fromManagerId === toManagerId) return { error: 'לא ניתן לבקש עובד מהמחלקה שלך' };

  await updateDoc(doc(db, 'loanRequests', loanId), {
    toManagerId,
    status: 'requested',
  });
  return {};
}

// מנהל A או B מאשרים — כשששניהם אישרו → approved + התראה לעובד
export async function approveLoan(
  loanId: string,
  approvingManagerId: string
): Promise<{ error?: string }> {
  let shouldNotify = false;
  let loanForNotification: LoanRequest | null = null;

  try {
    await runTransaction(db, async (tx) => {
      const loanRef = doc(db, 'loanRequests', loanId);
      const snap = await tx.get(loanRef);
      if (!snap.exists()) throw new Error('בקשה לא נמצאה');
      const loan = snap.data() as LoanRequest;

      if (loan.status === 'approved') throw new Error('בקשה כבר אושרה');
      if (loan.status === 'rejected') throw new Error('בקשה כבר נדחתה');
      if (loan.status === 'available') throw new Error('לא ניתן לאשר — עדיין לא הוגשה בקשה מהצד השני');

      const isFrom = approvingManagerId === loan.fromManagerId;
      const isTo = approvingManagerId === loan.toManagerId;
      if (!isFrom && !isTo) throw new Error('אין לך הרשאה לאשר בקשה זו');

      const newFrom = isFrom ? true : loan.fromManagerApproved;
      const newTo = isTo ? true : loan.toManagerApproved;
      const bothApproved = newFrom && newTo;

      tx.update(loanRef, {
        fromManagerApproved: newFrom,
        toManagerApproved: newTo,
        status: bothApproved ? 'approved' : 'requested',
      });

      if (bothApproved) {
        shouldNotify = true;
        loanForNotification = loan;
      }
    });
  } catch (e: any) {
    return { error: e.message };
  }

  if (shouldNotify && loanForNotification) {
    const l = loanForNotification as LoanRequest;
    await sendNotification(
      l.employeeId,
      'השאלה למחלקה אחרת ✅',
      `היום (${l.date}) אתה עובד במחלקה אחרת — משמרת ${l.shiftType === 'morning' ? 'בוקר' : l.shiftType === 'afternoon' ? 'צהוריים' : 'לילה'}`,
      'shift_approved'
    );
  }

  return {};
}

export async function rejectLoan(
  loanId: string,
  rejectingManagerId: string
): Promise<{ error?: string }> {
  const snap = await getDoc(doc(db, 'loanRequests', loanId));
  if (!snap.exists()) return { error: 'בקשה לא נמצאה' };
  const loan = snap.data() as LoanRequest;

  const isFrom = rejectingManagerId === loan.fromManagerId;
  const isTo = rejectingManagerId === loan.toManagerId;
  if (!isFrom && !isTo) return { error: 'אין לך הרשאה לדחות בקשה זו' };

  await updateDoc(doc(db, 'loanRequests', loanId), { status: 'rejected' });
  return {};
}

// עובדים זמינים להשאלה היום (לא מהמחלקה שלי)
export async function getAvailableLoans(myManagerId: string): Promise<LoanRequest[]> {
  const today = todayString();
  const q = query(
    collection(db, 'loanRequests'),
    where('date', '==', today),
    where('status', '==', 'available')
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LoanRequest))
    .filter(l => l.fromManagerId !== myManagerId);
}

// בקשות השאלה שקשורות אליי (כבעלים או כמקבל)
export async function getMyLoanRequests(managerId: string): Promise<LoanRequest[]> {
  const today = todayString();
  const [fromSnap, toSnap] = await Promise.all([
    getDocs(query(collection(db, 'loanRequests'), where('fromManagerId', '==', managerId), where('date', '==', today))),
    getDocs(query(collection(db, 'loanRequests'), where('toManagerId', '==', managerId), where('date', '==', today))),
  ]);
  const all = [
    ...fromSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoanRequest)),
    ...toSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoanRequest)),
  ];
  // הסר כפילויות
  return [...new Map(all.map(l => [l.id, l])).values()];
}
