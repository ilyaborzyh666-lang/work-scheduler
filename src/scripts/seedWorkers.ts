import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, addDoc, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// מנכ"ל ומנהל נוצרים בנפרד למעלה — כאן רק שאר העובדים
const WORKERS: { name: string; email: string; role: string }[] = [
  // מנהלי משמרת (9)
  { name: 'מנהל משמרת 1', email: 'shift.manager1@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 2', email: 'shift.manager2@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 3', email: 'shift.manager3@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 4', email: 'shift.manager4@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 5', email: 'shift.manager5@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 6', email: 'shift.manager6@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 7', email: 'shift.manager7@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 8', email: 'shift.manager8@company.com', role: 'shift_manager' },
  { name: 'מנהל משמרת 9', email: 'shift.manager9@company.com', role: 'shift_manager' },
];

const FIXED_SHIFTS: { date: string; type: string }[] = [];

const SHIFT_CONFIG: Record<string, { start: string; end: string; hours: number }> = {
  morning:   { start: '07:00', end: '15:00', hours: 8 },
  afternoon: { start: '15:00', end: '23:00', hours: 8 },
  night:     { start: '23:00', end: '07:00', hours: 8 },
};

async function seed() {
  console.log('Starting seed...');

  // יצירת המנהל
  const managerEmail = process.env.SEED_MANAGER_EMAIL!;
  const managerPassword = process.env.SEED_MANAGER_PASSWORD!;
  try {
    const cred = await createUserWithEmailAndPassword(auth, managerEmail, managerPassword);
    await setDoc(doc(db, 'users', cred.user.uid), {
      id: cred.user.uid,
      email: managerEmail,
      name: 'מנהל',
      role: 'manager',
      weeklyHours: 0,
      isBlocked: false,
      blockOverride: false,
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Manager created');
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      // המשתמש קיים ב-Auth אבל נמחק מ-Firestore — מוסיף רק את הפרופיל
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const cred = await signInWithEmailAndPassword(auth, managerEmail, managerPassword);
      await setDoc(doc(db, 'users', cred.user.uid), {
        id: cred.user.uid,
        email: managerEmail,
        name: 'מנהל',
        role: 'manager',
        weeklyHours: 0,
        isBlocked: false,
        blockOverride: false,
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Manager profile restored');
    } else {
      console.error('❌ Manager error:', e.message);
    }
  }

  for (const worker of WORKERS) {
    const { name, email, role } = worker;
    const password = 'Test1234!';

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        id: uid,
        email,
        name,
        role,
        weeklyHours: 0,
        isBlocked: false,
        blockOverride: false,
        createdAt: new Date().toISOString(),
      });

      for (const shift of FIXED_SHIFTS) {
        const config = SHIFT_CONFIG[shift.type];
        await addDoc(collection(db, 'shifts'), {
          employeeId: uid,
          employeeName: name,
          date: shift.date,
          type: shift.type,
          startTime: config.start,
          endTime: config.end,
          durationHours: config.hours,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }

      console.log(`✅ Created ${name} (${email}) with ${FIXED_SHIFTS.length} shifts`);
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        console.log(`⚠️  ${email} already exists, skipping`);
      } else {
        console.error(`❌ Error for ${name}:`, e.message);
      }
    }
  }

  console.log('Seed complete!');
  process.exit(0);
}

seed();
