import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  requestLeave, getEmployeeLeaves,
  getAllPendingLeaves, updateLeaveStatus,
} from '../../services/leaveService';
import { LeaveRequest } from '../../types';
import { colors, spacing, radius, typography, shadow, MIN_TOUCH } from '../../theme';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning,
  approved: colors.success,
  rejected: colors.danger,
};

export default function LeavesScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const isApprover = user?.role === 'manager' || user?.role === 'ceo' || user?.role === 'shift_manager';

  async function loadLeaves() {
    if (!user) return;
    setLoading(true);
    try {
      setLeaves(isApprover
        ? await getAllPendingLeaves()
        : await getEmployeeLeaves(user.id));
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { loadLeaves(); }, [user]));

  async function handleRequest() {
    if (!user) return;
    if (!startDate || !endDate || !reason.trim()) {
      Alert.alert(t('common.error'), 'נא למלא את כל השדות');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate) ||
        isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
      Alert.alert(t('common.error'), 'תאריך לא תקין — יש להזין בפורמט YYYY-MM-DD');
      return;
    }
    const { leave, error } = await requestLeave(user.id, user.name, startDate, endDate, reason.trim());
    if (error) {
      Alert.alert(t('common.error'), error);
    } else {
      Alert.alert(t('common.success'), 'בקשת החופשה נשלחה לאישור');
      setModal(false);
      setStartDate(''); setEndDate(''); setReason('');
      loadLeaves();
    }
  }

  function renderLeave({ item }: { item: LeaveRequest }) {
    const color = STATUS_COLORS[item.status];
    return (
      <View style={[styles.card, { borderRightColor: color }]}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName}>{item.employeeName}</Text>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{t(`leaves.${item.status}`)}</Text>
          </View>
        </View>
        <Text style={styles.cardDates}>
          {item.startDate} ← {item.endDate} · {item.durationDays} {t('leaves.days')}
        </Text>
        <Text style={styles.reason}>{item.reason}</Text>

        {isApprover && item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.approveBtn} onPress={async () => {
              await updateLeaveStatus(item.id, 'approved');
              loadLeaves();
            }}>
              <Text style={styles.actionText}>{t('common.approve')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={async () => {
              await updateLeaveStatus(item.id, 'rejected');
              loadLeaves();
            }}>
              <Text style={styles.actionText}>{t('common.reject')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={i => i.id}
          renderItem={renderLeave}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🌴</Text>
              <Text style={styles.empty}>{t('leaves.noLeaves')}</Text>
            </View>
          }
          onRefresh={loadLeaves}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!isApprover && (
        <TouchableOpacity style={styles.fab} onPress={() => setModal(true)} activeOpacity={0.85}>
          <Text style={styles.fabText}>+ {t('leaves.request')}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('leaves.request')}</Text>

            <Text style={styles.fieldLabel}>{t('leaves.startDate')}</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
              textAlign="right"
            />

            <Text style={styles.fieldLabel}>{t('leaves.endDate')}</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
              textAlign="right"
            />

            <Text style={styles.fieldLabel}>{t('leaves.reason')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="סיבת החופשה..."
              placeholderTextColor={colors.textMuted}
              value={reason}
              onChangeText={setReason}
              multiline
              textAlign="right"
              textAlignVertical="top"
            />

            <View style={styles.hint}>
              <Text style={styles.hintText}>
                חופשה קצרה (1-2 ימים) — יומיים הודעה מראש{'\n'}
                חופשה ארוכה (3+ ימים) — חודש הודעה מראש
              </Text>
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.approveBtn} onPress={handleRequest}>
                <Text style={styles.actionText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => setModal(false)}>
                <Text style={styles.actionText}>{t('common.cancel')}</Text>
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
  title: { ...typography.h2, color: colors.primary, textAlign: 'center', padding: spacing.lg },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderRightWidth: 4, ...shadow.sm,
  },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardName: { ...typography.bodyBold, color: colors.textPrimary },
  cardDates: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginBottom: 4 },
  reason: { ...typography.caption, color: colors.textMuted, textAlign: 'right', fontStyle: 'italic' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { ...typography.tiny, color: '#fff', fontWeight: '700' },
  actionRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.sm },
  approveBtn: {
    flex: 1, backgroundColor: colors.success, borderRadius: radius.sm,
    minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    flex: 1, backgroundColor: colors.danger, borderRadius: radius.sm,
    minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center',
  },
  actionText: { ...typography.bodyBold, color: '#fff' },
  fab: {
    position: 'absolute', bottom: spacing.xl, right: spacing.lg,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    ...shadow.lg,
  },
  fabText: { ...typography.bodyBold, color: '#fff' },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  sheetTitle: { ...typography.h3, color: colors.primary, textAlign: 'center', marginBottom: spacing.md },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, minHeight: MIN_TOUCH,
    fontSize: 15, borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 80, paddingTop: spacing.sm },
  hint: {
    backgroundColor: '#fff8e1', borderRadius: radius.sm,
    padding: spacing.sm, marginTop: spacing.sm,
  },
  hintText: { ...typography.tiny, color: '#b8860b', textAlign: 'right', lineHeight: 18 },
  sheetActions: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.lg },
});
