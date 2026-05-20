import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal,
  TouchableOpacity, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getAllEmployees, getMyEmployees, setBlockOverride, assignEmployeeToShiftManager } from '../../services/userService';
import { markEmployeeAvailableForLoan } from '../../services/loanService';
import { useAuth } from '../../context/AuthContext';
import { User, ShiftType, SHIFT_CONFIG, SHIFT_RULES } from '../../types';
import { colors, spacing, radius, typography, shadow, MIN_TOUCH } from '../../theme';

const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: 'בוקר 07:00–15:00',
  afternoon: 'צהוריים 15:00–23:00',
  night: 'לילה 23:00–07:00',
};

export default function EmployeesScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addId, setAddId] = useState('');
  const [adding, setAdding] = useState(false);
  const [loanEmployee, setLoanEmployee] = useState<User | null>(null);
  const [loanShiftType, setLoanShiftType] = useState<ShiftType>('morning');
  const [loaning, setLoaning] = useState(false);

  const isShiftManager = user?.role === 'shift_manager';

  async function loadEmployees() {
    setLoading(true);
    try {
      if (isShiftManager && user) {
        setEmployees(await getMyEmployees(user.id));
      } else {
        setEmployees(await getAllEmployees());
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { loadEmployees(); }, [user]));

  async function handleAddEmployee() {
    const id = addId.trim();
    if (!id) return;
    setAdding(true);
    try {
      const result = await assignEmployeeToShiftManager(id, user!.id);
      if (result.error) {
        Alert.alert('שגיאה', result.error);
      } else {
        setAddId('');
        Alert.alert('בוצע', 'העובד שויך אליך בהצלחה');
        loadEmployees();
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleMarkForLoan() {
    if (!loanEmployee || !user) return;
    setLoaning(true);
    try {
      const result = await markEmployeeAvailableForLoan(loanEmployee.id, user.id, loanShiftType);
      if (result.error) {
        Alert.alert('שגיאה', result.error);
      } else {
        setLoanEmployee(null);
        Alert.alert('בוצע', `${loanEmployee.name} סומן כזמין להשאלה להיום`);
      }
    } finally {
      setLoaning(false);
    }
  }

  async function handleRemoveBlock(emp: User) {
    Alert.alert(
      t('shifts.removeBlock'),
      `הסר חסימה מ-${emp.name}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            await setBlockOverride(emp.id, true);
            Alert.alert(t('common.success'), t('shifts.blockRemoved'));
            loadEmployees();
          },
        },
      ]
    );
  }

  function renderEmployee({ item }: { item: User }) {
    const isBlocked = item.isBlocked && !item.blockOverride;
    const pct = Math.min((item.weeklyHours / SHIFT_RULES.MAX_WEEKLY_HOURS) * 100, 100);
    const barColor = pct >= 100 ? colors.danger : pct >= 80 ? colors.warning : colors.success;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isBlocked ? colors.danger : colors.success }]}>
            <Text style={styles.statusText}>
              {isBlocked ? t('employees.blocked') : t('employees.active')}
            </Text>
          </View>
        </View>

        <View style={styles.hoursRow}>
          <Text style={styles.hoursLabel}>{t('employees.weeklyHours')}</Text>
          <Text style={[styles.hoursValue, { color: barColor }]}>
            {item.weeklyHours}/{SHIFT_RULES.MAX_WEEKLY_HOURS}
          </Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>

        {isShiftManager && (
          <TouchableOpacity style={styles.loanBtn} onPress={() => {
            setLoanShiftType('morning');
            setLoanEmployee(item);
          }}>
            <Text style={styles.loanBtnText}>השאל למחלקה אחרת</Text>
          </TouchableOpacity>
        )}

        {isBlocked && !isShiftManager && (
          <TouchableOpacity style={styles.unblockBtn} onPress={() => handleRemoveBlock(item)}>
            <Text style={styles.unblockText}>{t('shifts.removeBlock')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isShiftManager && (
        <View style={styles.addBox}>
          <Text style={styles.addTitle}>הוסף עובד לפי ID</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="הכנס ID של עובד..."
              placeholderTextColor={colors.textMuted}
              value={addId}
              onChangeText={setAddId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.addBtn, (!addId.trim() || adding) && styles.addBtnDisabled]}
              onPress={handleAddEmployee}
              disabled={!addId.trim() || adding}
            >
              {adding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.addBtnText}>הוסף</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={i => i.id}
          renderItem={renderEmployee}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t('employees.noEmployees')}</Text>}
          onRefresh={loadEmployees}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal בחירת משמרת להשאלה */}
      <Modal visible={!!loanEmployee} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>השאל עובד להיום</Text>
            <Text style={styles.modalSub}>{loanEmployee?.name}</Text>

            <Text style={styles.modalLabel}>בחר משמרת:</Text>
            {(Object.keys(SHIFT_CONFIG) as ShiftType[]).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.shiftOption, loanShiftType === type && styles.shiftOptionActive]}
                onPress={() => setLoanShiftType(type)}
              >
                <Text style={[styles.shiftOptionText, loanShiftType === type && styles.shiftOptionTextActive]}>
                  {SHIFT_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, loaning && styles.confirmBtnDisabled]}
                onPress={handleMarkForLoan}
                disabled={loaning}
              >
                {loaning
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.confirmBtnText}>סמן כזמין</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLoanEmployee(null)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  name: { ...typography.bodyBold, color: colors.textPrimary, textAlign: 'right' },
  email: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusText: { ...typography.tiny, color: '#fff', fontWeight: '700' },
  hoursRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  hoursLabel: { ...typography.caption, color: colors.textSecondary },
  hoursValue: { ...typography.caption, fontWeight: '700' },
  progressBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  loanBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanBtnText: { ...typography.bodyBold, color: '#fff' },
  unblockBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockText: { ...typography.bodyBold, color: '#fff' },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 60 },
  addBox: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginBottom: 0,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  addTitle: { ...typography.bodyBold, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.sm },
  addRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'right',
    minHeight: MIN_TOUCH,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { ...typography.bodyBold, color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  modalSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  modalLabel: { ...typography.bodyBold, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.sm },
  shiftOption: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing.md,
    marginBottom: spacing.sm, alignItems: 'center',
  },
  shiftOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  shiftOptionText: { ...typography.body, color: colors.textPrimary },
  shiftOptionTextActive: { color: '#fff', fontWeight: '700' },
  modalActions: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.md },
  confirmBtn: {
    flex: 1, backgroundColor: colors.success,
    borderRadius: radius.sm, minHeight: MIN_TOUCH,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { ...typography.bodyBold, color: '#fff' },
  cancelBtn: {
    flex: 1, backgroundColor: colors.danger,
    borderRadius: radius.sm, minHeight: MIN_TOUCH,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { ...typography.bodyBold, color: '#fff' },
});
