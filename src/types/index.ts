export type UserRole = 'ceo' | 'manager' | 'shift_manager' | 'doctor' | 'nurse' | 'caregiver';

export type EmployeeJobTitle = 'doctor' | 'nurse' | 'caregiver';

export type ShiftType = 'morning' | 'afternoon' | 'night';

export type ShiftStatus = 'pending' | 'approved' | 'rejected';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  weeklyHours: number;
  isBlocked: boolean;
  blockOverride: boolean;
  createdAt: string;
  shiftManagerId?: string;
}

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  type: ShiftType;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationHours: number;
  status: ShiftStatus;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  durationDays: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'shift_approved' | 'shift_rejected' | 'leave_approved' | 'leave_rejected' | 'hours_limit';
  read: boolean;
  createdAt: string;
}

export type LoanStatus = 'available' | 'requested' | 'approved' | 'rejected';

export interface LoanRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  fromManagerId: string;   // מנהל המשמרת שמשאיל (הבעלים)
  toManagerId: string;     // מנהל המשמרת שמקבל
  date: string;            // YYYY-MM-DD — תמיד היום
  shiftType: ShiftType;
  status: LoanStatus;
  fromManagerApproved: boolean;
  toManagerApproved: boolean;
  createdAt: string;
}

export const SHIFT_CONFIG: Record<ShiftType, { label: string; start: string; end: string; hours: number }> = {
  morning: { label: 'בוקר', start: '07:00', end: '15:00', hours: 8 },
  afternoon: { label: 'צהוריים', start: '15:00', end: '23:00', hours: 8 },
  night: { label: 'לילה', start: '23:00', end: '07:00', hours: 8 },
};

export const SHIFT_RULES = {
  MAX_WEEKLY_HOURS: 60,
  MIN_SHIFT_HOURS: 8,
  MAX_SHIFT_HOURS: 12,
  MIN_REST_HOURS: 8,
  SHORT_LEAVE_MAX_DAYS: 2,
  SHORT_LEAVE_NOTICE_DAYS: 2,
  LONG_LEAVE_NOTICE_DAYS: 30,
  MAX_WORKERS_PER_SHIFT: {
    morning: 6,
    afternoon: 4,
    night: 1,
  } as Record<ShiftType, number>,
};
