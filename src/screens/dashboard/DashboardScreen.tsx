import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Calendar, DateData, WeekCalendar, CalendarProvider } from 'react-native-calendars';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeShifts, getAllShifts, getShiftManagerShifts } from '../../services/shiftService';
import { Shift } from '../../types';
import { todayString, formatDateHE } from '../../utils/dateUtils';
import { colors, spacing, radius, typography, shadow } from '../../theme';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning,
  approved: colors.success,
  rejected: colors.danger,
};

const SHIFT_LABELS: Record<string, string> = {
  morning: 'בוקר 07:00–15:00',
  afternoon: 'צהוריים 15:00–23:00',
  night: 'לילה 23:00–07:00',
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selected, setSelected] = useState(todayString());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      try {
        const allShifts = (user!.role === 'manager' || user!.role === 'ceo')
          ? await getAllShifts()
          : user!.role === 'shift_manager'
            ? await getShiftManagerShifts(user!.id)
            : await getEmployeeShifts(user!.id);

        if (cancelled) return;

        const result = allShifts.filter(s => s.date === selected);

        setShifts(result);

        const marks: Record<string, any> = {};
        allShifts.forEach(s => {
          // מעדיף pending על approved, approved על rejected
          const existing = marks[s.date];
          const priority: Record<string, number> = { pending: 2, approved: 1, rejected: 0 };
          if (!existing || (priority[s.status] ?? 0) > (priority[existing.dotStatus] ?? 0)) {
            marks[s.date] = { marked: true, dotColor: STATUS_COLORS[s.status] ?? '#888', dotStatus: s.status };
          }
        });
        marks[selected] = { ...marks[selected], selected: true, selectedColor: colors.primary };
        setMarkedDates(marks);
      } catch {
        // שגיאת טעינה — המסך נשאר ריק, הspinner מוסר
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [user, selected]);

  function renderShift({ item }: { item: Shift }) {
    const statusColor = STATUS_COLORS[item.status];
    return (
      <View style={[styles.shiftCard, { borderRightColor: statusColor }]}>
        <View style={styles.shiftTop}>
          <Text style={styles.shiftName}>{item.employeeName}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor }]}>
            <Text style={styles.badgeText}>{t(`shifts.${item.status}`)}</Text>
          </View>
        </View>
        <Text style={styles.shiftInfo}>
          {SHIFT_LABELS[item.type] ?? item.type} · {item.durationHours}h
        </Text>
      </View>
    );
  }

  const calendarTheme = {
    selectedDayBackgroundColor: colors.primary,
    todayTextColor: colors.accent,
    arrowColor: colors.primary,
    monthTextColor: colors.primary,
    textDayFontSize: 14,
    textMonthFontSize: 15,
    textDayHeaderFontSize: 12,
  };

  return (
    <View style={styles.container}>
      {(user?.role === 'doctor' || user?.role === 'nurse' || user?.role === 'caregiver') ? (
        <CalendarProvider date={selected} onDateChanged={setSelected}>
          <WeekCalendar
            markedDates={markedDates}
            theme={calendarTheme}
            firstDay={0}
            allowShadow
          />
          <Text style={styles.dateLabel}>{formatDateHE(selected)}</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} size="large" />
          ) : shifts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>{t('shifts.noShifts')}</Text>
            </View>
          ) : (
            <FlatList
              data={shifts}
              keyExtractor={i => i.id}
              renderItem={renderShift}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </CalendarProvider>
      ) : (
        <>
          <View style={styles.calendarWrapper}>
            <Calendar
              onDayPress={(day: DateData) => setSelected(day.dateString)}
              markedDates={markedDates}
              theme={calendarTheme}
            />
          </View>
          <Text style={styles.dateLabel}>{formatDateHE(selected)}</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} size="large" />
          ) : shifts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>{t('shifts.noShifts')}</Text>
            </View>
          ) : (
            <FlatList
              data={shifts}
              keyExtractor={i => i.id}
              renderItem={renderShift}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.primary, textAlign: 'center', paddingTop: spacing.lg, paddingBottom: spacing.sm },
  calendarWrapper: {
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  dateLabel: {
    ...typography.caption, color: colors.textSecondary,
    textAlign: 'center', paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  shiftCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderRightWidth: 4, ...shadow.sm,
  },
  shiftTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  shiftName: { ...typography.bodyBold, color: colors.textPrimary },
  shiftInfo: { ...typography.caption, color: colors.textSecondary, textAlign: 'right' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { ...typography.tiny, color: '#fff', fontWeight: '700' },
  emptyWrap: { alignItems: 'center', marginTop: 40 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
