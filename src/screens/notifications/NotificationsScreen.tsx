import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Notification } from '../../types';
import { colors, spacing, radius, typography, shadow } from '../../theme';

const TYPE_ICONS: Record<string, string> = {
  shift_approved: '✅',
  shift_rejected: '❌',
  leave_approved: '🌴',
  leave_rejected: '🚫',
  hours_limit: '⚠️',
};

const TYPE_COLORS: Record<string, string> = {
  shift_approved: colors.success,
  shift_rejected: colors.danger,
  leave_approved: colors.success,
  leave_rejected: colors.danger,
  hours_limit: colors.warning,
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', user.id));
      const snap = await getDocs(q);
      setNotifications(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Notification))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
      const unread = snap.docs.filter(d => !d.data().read);
      if (unread.length > 0) {
        await Promise.all(unread.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true })));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNotifications(); }, [user]);

  function renderItem({ item }: { item: Notification }) {
    const accentColor = TYPE_COLORS[item.type] ?? colors.primary;
    return (
      <View style={[styles.card, !item.read && styles.cardUnread, { borderRightColor: accentColor }]}>
        <Text style={styles.icon}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
        <View style={styles.content}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString('he-IL')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.empty}>{t('notifications.noNotifications')}</Text>
            </View>
          }
          onRefresh={loadNotifications}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.primary, textAlign: 'center', padding: spacing.lg },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    borderRightWidth: 4,
    ...shadow.sm,
  },
  cardUnread: { backgroundColor: '#f8f9ff' },
  icon: { fontSize: 26, marginLeft: spacing.sm },
  content: { flex: 1 },
  notifTitle: { ...typography.bodyBold, color: colors.textPrimary, textAlign: 'right' },
  body: { ...typography.caption, color: colors.textSecondary, marginTop: 4, textAlign: 'right' },
  time: { ...typography.tiny, color: colors.textMuted, marginTop: 6, textAlign: 'right' },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
