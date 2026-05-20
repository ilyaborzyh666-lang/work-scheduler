import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  getEmployeeShifts, getAllPendingShifts, getPendingShiftsByEmployees, requestShift,
  updateShiftStatus, updateShiftHoursAndApprove, getWeeklyHours,
  approveAllPendingForEmployee,
} from '../../services/shiftService';
import { getMyEmployees } from '../../services/userService';
import { getAvailableLoans, getMyLoanRequests, requestLoanedEmployee, approveLoan, rejectLoan } from '../../services/loanService';
import { Shift, ShiftType, SHIFT_CONFIG, SHIFT_RULES, LoanRequest } from '../../types';
import { toLocalDateString } from '../../utils/dateUtils';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f39c12',
  approved: '#27ae60',
  rejected: '#e74c3c',
};

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// מחזיר את תאריכי ימי השבוע הבא (ראשון–שבת)
function getNextWeekDays(): { date: string; dayName: string }[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=ראשון
  // מציאת הראשון הבא
  const daysUntilNextSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilNextSunday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nextSunday);
    d.setDate(nextSunday.getDate() + i);
    return {
      date: toLocalDateString(d),
      dayName: DAY_NAMES[i],
    };
  });
}

function isSubmissionOpen(): boolean {
  // חלון הגשה: רביעי (3) עד שישי (5) בשעות 00:00–23:59
  const day = new Date().getDay();
  return day >= 3 && day <= 5;
}

export default function ShiftsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState(user?.weeklyHours ?? 0);
  const [requestModal, setRequestModal] = useState(false);
  const [editModal, setEditModal] = useState<Shift | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editHours, setEditHours] = useState('');

  // בקשת שבוע: מפה מתאריך לרשימת משמרות (עד 2 — בוקר+לילה בלבד)
  const [weekSelections, setWeekSelections] = useState<Record<string, ShiftType[]>>({});
  const [searchId, setSearchId] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shifts' | 'loans'>('shifts');
  const [availableLoans, setAvailableLoans] = useState<LoanRequest[]>([]);
  const [myLoanRequests, setMyLoanRequests] = useState<LoanRequest[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const nextWeekDays = getNextWeekDays();
  const submissionOpen = isSubmissionOpen();

  const isBlocked = (user?.isBlocked && !user?.blockOverride) ?? false;
  const isShiftManager = user?.role === 'shift_manager';

  async function loadShifts() {
    if (!user) return;
    setLoading(true);
    try {
      if (user.role === 'manager' || user.role === 'ceo') {
        setShifts(await getAllPendingShifts());
      } else if (user.role === 'shift_manager') {
        const myEmployees = await getMyEmployees(user.id);
        const ids = myEmployees.map(e => e.id);
        setShifts(await getPendingShiftsByEmployees(ids));
      } else {
        setShifts(await getEmployeeShifts(user.id));
        setWeeklyHours(await getWeeklyHours(user.id, new Date()));
      }
    } catch (e: any) {
      console.error('loadShifts error:', e);
      Alert.alert(t('common.error'), e?.message ?? 'שגיאה בטעינת משמרות');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { loadShifts(); }, [user]));

  async function loadLoans() {
    if (!user || !isShiftManager) return;
    setLoansLoading(true);
    try {
      const [available, mine] = await Promise.all([
        getAvailableLoans(user.id),
        getMyLoanRequests(user.id),
      ]);
      setAvailableLoans(available);
      setMyLoanRequests(mine);
    } finally {
      setLoansLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'loans') loadLoans();
  }, [activeTab, user]);

  async function handleRequestLoan(loanId: string) {
    if (!user) return;
    const { error } = await requestLoanedEmployee(loanId, user.id);
    if (error) { Alert.alert(t('common.error'), error); return; }
    Alert.alert(t('common.success'), 'הבקשה נשלחה — ממתין לאישור הצד השני');
    loadLoans();
  }

  async function handleApproveLoan(loanId: string) {
    if (!user) return;
    const { error } = await approveLoan(loanId, user.id);
    if (error) { Alert.alert(t('common.error'), error); return; }
    Alert.alert(t('common.success'), 'אישרת את ההשאלה');
    loadLoans();
  }

  async function handleRejectLoan(loanId: string) {
    if (!user) return;
    const { error } = await rejectLoan(loanId, user.id);
    if (error) { Alert.alert(t('common.error'), error); return; }
    loadLoans();
  }

  function renderLoanItem(loan: LoanRequest) {
    const shiftLabel = loan.shiftType === 'morning' ? 'בוקר' : loan.shiftType === 'afternoon' ? 'צהוריים' : 'לילה';
    const isMine = loan.toManagerId === user?.id;
    const myApproved = isMine ? loan.toManagerApproved : loan.fromManagerApproved;

    return (
      <View key={loan.id} style={loanStyles.card}>
        <Text style={loanStyles.name}>{loan.employeeName}</Text>
        <Text style={loanStyles.info}>משמרת {shiftLabel} · {loan.date}</Text>
        {loan.status === 'available' && (
          <TouchableOpacity style={loanStyles.requestBtn} onPress={() => handleRequestLoan(loan.id)}>
            <Text style={loanStyles.btnText}>בקש עובד זה</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'requested' && (
          <View>
            <Text style={loanStyles.statusText}>
              {loan.fromManagerApproved ? '✅' : '⏳'} מנהל שולח {'  '}
              {loan.toManagerApproved ? '✅' : '⏳'} מנהל מקבל
            </Text>
            {!myApproved && (
              <View style={loanStyles.actionRow}>
                <TouchableOpacity style={loanStyles.approveBtn} onPress={() => handleApproveLoan(loan.id)}>
                  <Text style={loanStyles.btnText}>אשר</Text>
                </TouchableOpacity>
                <TouchableOpacity style={loanStyles.rejectBtn} onPress={() => handleRejectLoan(loan.id)}>
                  <Text style={loanStyles.btnText}>דחה</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {loan.status === 'approved' && (
          <Text style={loanStyles.approvedText}>✅ השאלה אושרה</Text>
        )}
        {loan.status === 'rejected' && (
          <Text style={loanStyles.rejectedText}>❌ השאלה נדחתה</Text>
        )}
      </View>
    );
  }

  function toggleDayShift(date: string, type: ShiftType) {
    setWeekSelections(prev => {
      const current = prev[date] ?? [];
      const alreadySelected = current.includes(type);

      if (alreadySelected) {
        // הסר משמרת
        const updated = current.filter(t => t !== type);
        return { ...prev, [date]: updated };
      }

      // באותו יום: רק בוקר+לילה מותר (8 שעות מנוחה)
      // צהוריים+בוקר של יום המחרת — מותר (נבדק ב-backend)
      if (current.length === 1) {
        const existing = current[0];
        const allowed =
          (existing === 'morning' && type === 'night') ||
          (existing === 'night' && type === 'morning');
        if (!allowed) {
          Alert.alert('קומבינציה לא חוקית', 'ניתן לשלב באותו יום רק בוקר + לילה (8 שעות מנוחה ביניהן)');
          return prev;
        }
      }

      if (current.length >= 2) {
        Alert.alert('מגבלה', 'ניתן לבחור עד 2 משמרות ביום');
        return prev;
      }

      return { ...prev, [date]: [...current, type] };
    });
  }

  async function handleSubmitWeek() {
    if (!user) return;
    if (isBlocked) {
      Alert.alert(t('common.error'), t('shifts.blocked'));
      return;
    }

    // שטח את כל הבחירות לרשימה של {date, type}
    const allShifts: { date: string; type: ShiftType }[] = [];
    for (const [date, types] of Object.entries(weekSelections)) {
      for (const type of types) {
        allShifts.push({ date, type });
      }
    }

    if (allShifts.length === 0) {
      Alert.alert(t('common.error'), 'לא בחרת אף משמרת');
      return;
    }

    // ימים ייחודיים — מקסימום 6
    const uniqueDays = new Set(allShifts.map(s => s.date)).size;
    if (uniqueDays > 6) {
      Alert.alert(t('common.error'), 'לפי החוק חובה יום מנוחה אחד בשבוע — ניתן לבחור עד 6 ימים');
      return;
    }

    // בדיקת סה"כ שעות
    const totalNewHours = allShifts.reduce((sum, s) => sum + SHIFT_CONFIG[s.type].hours, 0);
    if (weeklyHours + totalNewHours > SHIFT_RULES.MAX_WEEKLY_HOURS) {
      Alert.alert(t('common.error'), `סה"כ שעות יחרוג מ-${SHIFT_RULES.MAX_WEEKLY_HOURS} — בחר פחות משמרות`);
      return;
    }

    setLoading(true);
    let accumulatedHours = weeklyHours;
    let successCount = 0;
    let errors: string[] = [];

    for (const { date, type } of allShifts) {
      const { error } = await requestShift(user.id, user.name, date, type, accumulatedHours);
      if (error) {
        errors.push(`${date} ${type}: ${error}`);
      } else {
        accumulatedHours += SHIFT_CONFIG[type].hours;
        successCount++;
      }
    }

    setLoading(false);
    setRequestModal(false);
    setWeekSelections({});

    if (errors.length > 0) {
      Alert.alert('חלק מהבקשות נכשלו', errors.join('\n'));
    } else {
      Alert.alert(t('common.success'), `${successCount} משמרות נשלחו לאישור המנהל`);
    }
    loadShifts();
  }

  async function handleApprove(shift: Shift) {
    try {
      const { error } = await updateShiftStatus(shift.id, 'approved', shift.employeeId, shift.date, shift.type);
      if (error) { Alert.alert(t('common.error'), error); return; }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? 'שגיאה באישור');
      return;
    }
    loadShifts();
  }

  async function handleReject(shift: Shift) {
    try {
      await updateShiftStatus(shift.id, 'rejected', shift.employeeId, shift.date, shift.type);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? 'שגיאה בדחייה');
      return;
    }
    loadShifts();
  }

  async function handleApproveAll(employeeId: string, employeeName: string) {
    Alert.alert(
      'אשר הכל',
      `לאשר את כל המשמרות הממתינות של ${employeeName}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'אשר הכל',
          onPress: async () => {
            try {
              const count = await approveAllPendingForEmployee(employeeId);
              Alert.alert(t('common.success'), `${count} משמרות אושרו`);
              loadShifts();
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message ?? 'שגיאה באישור המוני');
            }
          },
        },
      ]
    );
  }

  async function handleEditHours() {
    if (!editModal) return;
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(editStart) || !timeRegex.test(editEnd)) {
      Alert.alert(t('common.error'), 'שעות בפורמט HH:MM (לדוגמה 07:00)');
      return;
    }
    const h = parseFloat(editHours);
    if (isNaN(h) || h < SHIFT_RULES.MIN_SHIFT_HOURS || h > SHIFT_RULES.MAX_SHIFT_HOURS) {
      Alert.alert(t('common.error'), `שעות חייבות להיות בין ${SHIFT_RULES.MIN_SHIFT_HOURS} ל-${SHIFT_RULES.MAX_SHIFT_HOURS}`);
      return;
    }
    const { error } = await updateShiftHoursAndApprove(editModal.id, editStart, editEnd, h, editModal.employeeId, editModal.date, editModal.durationHours, editModal.type);
    if (error) { Alert.alert(t('common.error'), error); return; }
    setEditModal(null);
    Alert.alert(t('common.success'), `המשמרת עודכנה ואושרה — ${editStart}–${editEnd} (${h} שעות)`);
    loadShifts();
  }

  function renderShift({ item }: { item: Shift }) {
    return (
      <View style={[styles.card, { borderLeftColor: STATUS_COLORS[item.status] }]}>
        <Text style={styles.cardName}>{item.employeeName}</Text>
        <Text style={styles.cardInfo}>
          {t(`shifts.${item.type}`)} · {item.date} · {item.startTime}–{item.endTime} · {item.durationHours}h
        </Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] }]}>
          <Text style={styles.badgeText}>{t(`shifts.${item.status}`)}</Text>
        </View>

        {(user?.role === 'manager' || user?.role === 'ceo' || user?.role === 'shift_manager') && item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
              <Text style={styles.actionBtnText}>{t('common.approve')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
              <Text style={styles.actionBtnText}>{t('common.reject')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={() => {
              setEditModal(item);
              setEditStart(item.startTime);
              setEditEnd(item.endTime);
              setEditHours(String(item.durationHours));
            }}>
              <Text style={styles.actionBtnText}>{t('common.edit')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  const selectedCount = Object.values(weekSelections).reduce((sum, types) => sum + types.length, 0);

  const filteredShifts = searchId.trim()
    ? shifts.filter(s => s.employeeName.toLowerCase().includes(searchId.trim().toLowerCase()))
    : shifts;

  const firstFiltered = filteredShifts[0];

  // ── Manager grouping ──────────────────────────────────────────────
  type ShiftGroup = {
    date: string;
    type: ShiftType;
    shifts: Shift[];
    max: number;
  };

  const SHIFT_ORDER: Record<ShiftType, number> = { morning: 0, afternoon: 1, night: 2 };

  const allGroups = useMemo<ShiftGroup[]>(() => {
    const map = new Map<string, ShiftGroup>();
    for (const s of filteredShifts) {
      const key = `${s.date}__${s.type}`;
      if (!map.has(key)) {
        map.set(key, {
          date: s.date,
          type: s.type as ShiftType,
          shifts: [],
          max: SHIFT_RULES.MAX_WORKERS_PER_SHIFT[s.type as ShiftType],
        });
      }
      map.get(key)!.shifts.push(s);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return SHIFT_ORDER[a.type] - SHIFT_ORDER[b.type];
    });
  }, [filteredShifts]);

  // ימים ייחודיים ממוינים
  const uniqueDays = useMemo(() =>
    [...new Set(allGroups.map(g => g.date))].sort(), [allGroups]);

  const currentDay = selectedDay ?? uniqueDays[0] ?? null;
  const currentDayIndex = uniqueDays.indexOf(currentDay ?? '');
  const shiftGroups = allGroups.filter(g => g.date === currentDay);

  async function handleApproveDay() {
    if (!currentDay) return;
    const pending = shiftGroups.flatMap(g => g.shifts);
    if (pending.length === 0) return;
    Alert.alert(
      'אשר יום',
      `לאשר את כל ${pending.length} הבקשות הממתינות ל-${formatGroupDate(currentDay)}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'אשר הכל',
          onPress: async () => {
            const results = await Promise.all(
              pending.map(shift =>
                updateShiftStatus(shift.id, 'approved', shift.employeeId, shift.date, shift.type)
              )
            );
            const approved = results.filter(r => !r.error).length;
            const blocked = results.filter(r => !!r.error).length;
            const msg = blocked > 0
              ? `אושרו ${approved} משמרות, ${blocked} נחסמו (משמרת מלאה)`
              : `${approved} משמרות אושרו`;
            Alert.alert(t('common.success'), msg);
            loadShifts();
          },
        },
      ]
    );
  }

  function groupHeaderColor(group: ShiftGroup): string {
    const pct = group.shifts.length / group.max;
    if (pct >= 1) return '#e74c3c';
    if (pct >= 0.8) return '#f39c12';
    return '#27ae60';
  }

  function formatGroupDate(isoDate: string): string {
    // isoDate: "YYYY-MM-DD" → "DD/MM"
    const parts = isoDate.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return isoDate;
  }

  function shiftTypeLabel(type: ShiftType): string {
    const map: Record<ShiftType, string> = { morning: 'בוקר', afternoon: 'צהוריים', night: 'לילה' };
    return map[type];
  }

  return (
    <View style={styles.container}>
      {isShiftManager && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'shifts' && styles.tabBtnActive]}
            onPress={() => setActiveTab('shifts')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'shifts' && styles.tabBtnTextActive]}>משמרות</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'loans' && styles.tabBtnActive]}
            onPress={() => setActiveTab('loans')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'loans' && styles.tabBtnTextActive]}>השאלות</Text>
          </TouchableOpacity>
        </View>
      )}

      {isShiftManager && activeTab === 'loans' ? (
        loansLoading ? (
          <ActivityIndicator color="#1a1a2e" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={loanStyles.list}>
            <Text style={loanStyles.sectionTitle}>עובדים זמינים להשאלה מהיום</Text>
            {availableLoans.length === 0 && (
              <Text style={loanStyles.empty}>אין עובדים זמינים להשאלה כרגע</Text>
            )}
            {availableLoans.map(renderLoanItem)}

            <Text style={[loanStyles.sectionTitle, { marginTop: 20 }]}>בקשות השאלה שלי</Text>
            {myLoanRequests.length === 0 && (
              <Text style={loanStyles.empty}>אין בקשות פעילות</Text>
            )}
            {myLoanRequests.map(renderLoanItem)}
          </ScrollView>
        )
      ) : (
      <>
      {(user?.role === 'doctor' || user?.role === 'nurse' || user?.role === 'caregiver') && (
        <View style={styles.hoursBar}>
          <Text style={styles.hoursText}>
            {t('shifts.weeklyHours')}: {weeklyHours}/{SHIFT_RULES.MAX_WEEKLY_HOURS}
          </Text>
          {isBlocked && (
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedText}>{t('shifts.blocked')}</Text>
            </View>
          )}
        </View>
      )}

      {(user?.role === 'manager' || user?.role === 'ceo' || user?.role === 'shift_manager') && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="חפש לפי שם עובד או ID..."
            placeholderTextColor="#aaa"
            value={searchId}
            onChangeText={setSearchId}
            textAlign="right"
          />
          {searchId.trim() !== '' && firstFiltered && (
            <TouchableOpacity
              style={styles.approveAllBtn}
              onPress={() => handleApproveAll(firstFiltered.employeeId, firstFiltered.employeeName)}
            >
              <Text style={styles.approveAllText}>✓ אשר הכל</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#1a1a2e" style={{ marginTop: 40 }} />
      ) : (user?.role === 'manager' || user?.role === 'ceo' || user?.role === 'shift_manager') ? (
        // ── Manager: day-by-day view ───────────────────────────────
        <>
          {/* Day navigator */}
          <View style={styles.dayNav}>
            <TouchableOpacity
              style={[styles.dayNavArrow, currentDayIndex <= 0 && styles.dayNavArrowDisabled]}
              onPress={() => currentDayIndex > 0 && setSelectedDay(uniqueDays[currentDayIndex - 1])}
              disabled={currentDayIndex <= 0}
            >
              <Text style={styles.dayNavArrowText}>›</Text>
            </TouchableOpacity>

            <View style={styles.dayNavCenter}>
              <Text style={styles.dayNavDate}>
                {currentDay ? formatGroupDate(currentDay) : '—'}
              </Text>
              <Text style={styles.dayNavCount}>
                {shiftGroups.reduce((s, g) => s + g.shifts.length, 0)} בקשות ממתינות
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.dayNavArrow, currentDayIndex >= uniqueDays.length - 1 && styles.dayNavArrowDisabled]}
              onPress={() => currentDayIndex < uniqueDays.length - 1 && setSelectedDay(uniqueDays[currentDayIndex + 1])}
              disabled={currentDayIndex >= uniqueDays.length - 1}
            >
              <Text style={styles.dayNavArrowText}>‹</Text>
            </TouchableOpacity>
          </View>

          {shiftGroups.length > 0 && (
            <TouchableOpacity style={styles.approveDayBtn} onPress={handleApproveDay}>
              <Text style={styles.approveDayText}>✓ אשר את כל היום ({shiftGroups.reduce((s, g) => s + g.shifts.length, 0)} בקשות)</Text>
            </TouchableOpacity>
          )}

          <ScrollView contentContainerStyle={styles.list}>
            {shiftGroups.length === 0 ? (
              <Text style={styles.empty}>אין בקשות ממתינות ליום זה</Text>
            ) : (
              shiftGroups.map(group => {
                const headerColor = groupHeaderColor(group);
                const title = `${shiftTypeLabel(group.type)} · ${group.shifts.length}/${group.max} עובדים`;
                return (
                  <View key={`${group.date}__${group.type}`} style={styles.groupCard}>
                    <View style={[styles.groupHeader, { borderLeftColor: headerColor }]}>
                      <Text style={[styles.groupTitle, { color: headerColor }]}>{title}</Text>
                    </View>
                    {group.shifts.map(item => (
                      <View key={item.id} style={styles.groupRow}>
                        <Text style={styles.groupEmployeeName}>{item.employeeName}</Text>
                        <Text style={styles.groupEmployeeInfo}>
                          {item.startTime}–{item.endTime} · {item.durationHours}h
                        </Text>
                        <View style={styles.groupActionRow}>
                          <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                            <Text style={styles.actionBtnText}>{t('common.approve')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                            <Text style={styles.actionBtnText}>{t('common.reject')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.editBtn} onPress={() => {
                            setEditModal(item);
                            setEditStart(item.startTime);
                            setEditEnd(item.endTime);
                            setEditHours(String(item.durationHours));
                          }}>
                            <Text style={styles.actionBtnText}>{t('common.edit')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      ) : (
        // ── Employee: flat list (unchanged) ───────────────────────
        <FlatList
          data={filteredShifts}
          keyExtractor={i => i.id}
          renderItem={renderShift}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t('shifts.noShifts')}</Text>}
        />
      )}

      {(user?.role === 'doctor' || user?.role === 'nurse' || user?.role === 'caregiver') && !isBlocked && (
        <TouchableOpacity
          style={[styles.fab, !submissionOpen && styles.fabDisabled]}
          onPress={() => {
            if (!submissionOpen) {
              Alert.alert('חלון הגשה סגור', 'ניתן להגיש בקשות רק ביום רביעי לשבוע הבא');
              return;
            }
            setRequestModal(true);
          }}
        >
          <Text style={styles.fabText}>+ {t('shifts.request')}</Text>
        </TouchableOpacity>
      )}

      {/* Weekly Request Modal */}
      <Modal visible={requestModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalLarge}>
            <Text style={styles.modalTitle}>בקשת משמרות לשבוע הבא</Text>
            <Text style={styles.modalSubtitle}>בחר יום ומשמרת לכל יום שרוצה</Text>

            <ScrollView style={styles.weekList} showsVerticalScrollIndicator={false}>
              {nextWeekDays.map(({ date, dayName }) => {
                const selectedTypes = weekSelections[date] ?? [];
                return (
                  <View key={date} style={styles.dayRow}>
                    <Text style={styles.dayName}>יום {dayName} | {date.slice(5).replace('-', '/')}</Text>
                    <View style={styles.shiftBtns}>
                      {(Object.keys(SHIFT_CONFIG) as ShiftType[]).map(type => {
                        const isSelected = selectedTypes.includes(type);

                        // בדוק אם יום הקודם בחרו לילה — אז בוקר של היום הזה אסור
                        const dayIndex = nextWeekDays.findIndex(d => d.date === date);
                        const prevDate = dayIndex > 0 ? nextWeekDays[dayIndex - 1].date : null;
                        const prevTypes = prevDate ? (weekSelections[prevDate] ?? []) : [];
                        const prevHadNight = prevTypes.includes('night');
                        const isBlockedByPrevNight = type === 'morning' && prevHadNight;

                        // צהוריים אסור אם כבר בחרו משמרת אחרת באותו יום
                        const isAfternoonDisabled = type === 'afternoon' && selectedTypes.length > 0 && !isSelected;

                        const isDisabled = (isBlockedByPrevNight || isAfternoonDisabled) && !isSelected;

                        return (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.shiftBtn,
                              isSelected && styles.shiftBtnActive,
                              isDisabled && styles.shiftBtnDisabled,
                            ]}
                            onPress={() => {
                              if (isBlockedByPrevNight) {
                                Alert.alert('לא ניתן', 'אחרי משמרת לילה אין מספיק מנוחה לפני בוקר');
                                return;
                              }
                              toggleDayShift(date, type);
                            }}
                          >
                            <Text style={[styles.shiftBtnText, isSelected && { color: '#fff' }]}>
                              {t(`shifts.${type}`)}
                            </Text>
                            <Text style={[styles.shiftBtnTime, isSelected && { color: '#ddd' }]} >
                              {`‎${SHIFT_CONFIG[type].start}–${SHIFT_CONFIG[type].end}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              {/* בר שעות שבועיות */}
              {(() => {
                const selectedHours = Object.entries(weekSelections).reduce((sum, [, types]) =>
                  sum + types.reduce((s, t) => s + SHIFT_CONFIG[t].hours, 0), 0);
                const totalHours = weeklyHours + selectedHours;
                const pct = Math.min((totalHours / SHIFT_RULES.MAX_WEEKLY_HOURS) * 100, 100);
                const barColor = pct >= 100 ? '#e74c3c' : pct >= 80 ? '#f39c12' : '#27ae60';
                return (
                  <View style={styles.hoursBarWrap}>
                    <View style={styles.hoursBarRow}>
                      <Text style={[styles.hoursBarLabel, { color: barColor }]}>
                        {totalHours}/{SHIFT_RULES.MAX_WEEKLY_HOURS} שעות שבועיות
                      </Text>
                      <Text style={styles.hoursBarNew}>
                        +{selectedHours} חדשות
                      </Text>
                    </View>
                    <View style={styles.hoursProgressBg}>
                      <View style={[styles.hoursProgressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                    </View>
                    {totalHours > SHIFT_RULES.MAX_WEEKLY_HOURS && (
                      <Text style={styles.hoursWarning}>⚠️ חורג מגבול 60 שעות!</Text>
                    )}
                  </View>
                );
              })()}
              <Text style={styles.selectedCount}>
                נבחרו {selectedCount} משמרות
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.approveBtn, selectedCount === 0 && { opacity: 0.4 }]}
                  onPress={handleSubmitWeek}
                  disabled={selectedCount === 0}
                >
                  <Text style={styles.actionBtnText}>שלח בקשה</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => {
                  setRequestModal(false);
                  setWeekSelections({});
                }}>
                  <Text style={styles.actionBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Hours Modal */}
      <Modal visible={!!editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('shifts.editHours')}</Text>
            {editModal && (
              <Text style={styles.editShiftInfo}>
                {editModal.employeeName} · {editModal.date} · {t(`shifts.${editModal.type}`)}
              </Text>
            )}
            <Text style={styles.inputLabel}>{t('shifts.startTime')}</Text>
            <TextInput
              style={styles.input}
              placeholder="07:00"
              value={editStart}
              onChangeText={setEditStart}
              textAlign="right"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.inputLabel}>{t('shifts.endTime')}</Text>
            <TextInput
              style={styles.input}
              placeholder="19:00"
              value={editEnd}
              onChangeText={setEditEnd}
              textAlign="right"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.inputLabel}>{`${t('shifts.hours')} (${SHIFT_RULES.MIN_SHIFT_HOURS}–${SHIFT_RULES.MAX_SHIFT_HOURS})`}</Text>
            <TextInput
              style={styles.input}
              placeholder="8"
              value={editHours}
              onChangeText={setEditHours}
              keyboardType="decimal-pad"
              textAlign="right"
            />
            <Text style={styles.editHint}>השינויים יאשרו את המשמרת אוטומטית</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.approveBtn} onPress={handleEditHours}>
                <Text style={styles.actionBtnText}>ערוך ואשר</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => setEditModal(null)}>
                <Text style={styles.actionBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', padding: 16, color: '#1a1a2e' },
  hoursBar: { backgroundColor: '#fff', padding: 12, marginHorizontal: 12, borderRadius: 10, marginBottom: 8 },
  hoursText: { fontSize: 14, textAlign: 'right', color: '#333' },
  blockedBadge: { backgroundColor: '#e74c3c', borderRadius: 6, padding: 6, marginTop: 6 },
  blockedText: { color: '#fff', fontSize: 12, textAlign: 'center' },
  list: { padding: 12, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 10, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardName: { fontSize: 16, fontWeight: 'bold', textAlign: 'right', color: '#1a1a2e' },
  cardInfo: { fontSize: 13, color: '#555', marginTop: 4, textAlign: 'right' },
  badge: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  approveBtn: { backgroundColor: '#27ae60', borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#e74c3c', borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' },
  editBtn: { backgroundColor: '#3498db', borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: '#1a1a2e', borderRadius: 30,
    paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  fabDisabled: { backgroundColor: '#888' },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 16 },
  searchBar: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, borderWidth: 1, borderColor: '#ddd', color: '#1a1a2e' },
  approveAllBtn: { backgroundColor: '#27ae60', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  approveAllText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalLarge: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#1a1a2e' },
  modalSubtitle: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 16 },
  weekList: { flexGrow: 0 },
  dayRow: {
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  dayName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', textAlign: 'right', marginBottom: 8 },
  shiftBtns: { flexDirection: 'row-reverse', gap: 8 },
  shiftBtn: {
    flex: 1, borderWidth: 1, borderColor: '#1a1a2e',
    borderRadius: 10, padding: 8, alignItems: 'center',
  },
  shiftBtnActive: { backgroundColor: '#1a1a2e' },
  shiftBtnDisabled: { opacity: 0.3, borderColor: '#aaa' },
  shiftBtnText: { fontSize: 12, fontWeight: '700', color: '#1a1a2e' },
  shiftBtnTime: { fontSize: 10, color: '#666', marginTop: 2 },
  modalFooter: { paddingTop: 12 },
  selectedCount: { textAlign: 'center', fontSize: 13, color: '#555', marginBottom: 8 },
  modalActions: { flexDirection: 'row-reverse', gap: 10 },
  hoursBarWrap: { marginBottom: 10 },
  hoursBarRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  hoursBarLabel: { fontSize: 13, fontWeight: '700' },
  hoursBarNew: { fontSize: 12, color: '#888' },
  hoursProgressBg: { height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' },
  hoursProgressFill: { height: '100%', borderRadius: 4 },
  hoursWarning: { fontSize: 12, color: '#e74c3c', textAlign: 'center', marginTop: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12,
    marginBottom: 8, fontSize: 15, borderWidth: 1, borderColor: '#ddd',
  },
  inputLabel: { fontSize: 12, color: '#888', textAlign: 'right', marginBottom: 4 },
  editShiftInfo: {
    fontSize: 13, color: '#555', textAlign: 'center',
    marginBottom: 14, fontStyle: 'italic',
  },
  editHint: {
    fontSize: 12, color: '#27ae60', textAlign: 'center',
    marginBottom: 12, fontWeight: '600',
  },
  // Day navigator
  dayNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a1a2e', paddingHorizontal: 8, paddingVertical: 10,
  },
  dayNavArrow: { padding: 10 },
  dayNavArrowDisabled: { opacity: 0.2 },
  dayNavArrowText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  dayNavCenter: { alignItems: 'center' },
  dayNavDate: { color: '#fff', fontSize: 20, fontWeight: '800' },
  dayNavCount: { color: '#aaa', fontSize: 12, marginTop: 2 },
  approveDayBtn: {
    backgroundColor: '#27ae60', marginHorizontal: 12, marginTop: 8,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  approveDayText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Manager grouped view
  groupCard: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  groupHeader: {
    borderLeftWidth: 5, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  groupTitle: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  groupRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  groupEmployeeName: { fontSize: 15, fontWeight: '700', textAlign: 'right', color: '#1a1a2e' },
  groupEmployeeInfo: { fontSize: 12, color: '#777', textAlign: 'right', marginTop: 2 },
  groupActionRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  tabRow: { flexDirection: 'row-reverse', backgroundColor: '#1a1a2e' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#4f8ef7' },
  tabBtnText: { color: '#aaa', fontWeight: '600', fontSize: 13 },
  tabBtnTextActive: { color: '#fff' },
});

const loanStyles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 80 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textAlign: 'right', marginBottom: 8, marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  name: { fontSize: 16, fontWeight: '700', textAlign: 'right', color: '#1a1a2e' },
  info: { fontSize: 12, color: '#666', textAlign: 'right', marginTop: 2, marginBottom: 8 },
  requestBtn: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10, alignItems: 'center' },
  actionRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  approveBtn: { flex: 1, backgroundColor: '#27ae60', borderRadius: 8, padding: 10, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#e74c3c', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  statusText: { fontSize: 13, color: '#555', textAlign: 'right', marginBottom: 6 },
  approvedText: { fontSize: 13, color: '#27ae60', textAlign: 'right', fontWeight: '700' },
  rejectedText: { fontSize: 13, color: '#e74c3c', textAlign: 'right', fontWeight: '700' },
});
