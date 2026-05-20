import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { registerUser } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { colors, spacing, radius, typography, shadow, MIN_TOUCH } from '../../theme';

const JOB_ROLES: { role: UserRole; label: string }[] = [
  { role: 'doctor', label: 'רופא/ה' },
  { role: 'nurse', label: 'אח/אחות' },
  { role: 'caregiver', label: 'מטפל/ת' },
];

export default function RegisterScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('caregiver');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert(t('common.error'), 'נא למלא את כל השדות');
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), 'הסיסמה חייבת להיות לפחות 6 תווים');
      return;
    }
    setLoading(true);
    try {
      const user = await registerUser(email.trim(), password, name.trim(), selectedRole);
      setUser(user);
    } catch (e: any) {
      const code = e?.code ?? '';
      const msg =
        code === 'auth/email-already-in-use'
          ? 'אימייל זה כבר רשום במערכת'
          : code === 'auth/invalid-email'
          ? 'כתובת אימייל לא תקינה'
          : code === 'auth/network-request-failed'
          ? 'בעיית רשת — בדוק חיבור לאינטרנט'
          : e.message;
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.appName}>סידור עבודה</Text>
          <Text style={styles.title}>{t('auth.register')}</Text>
          <Text style={styles.subtitle}>הרשמה כעובד</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.name')}</Text>
          <TextInput
            style={styles.input}
            placeholder="ישראל ישראלי"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            textAlign="right"
          />

          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder="example@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="right"
          />

          <Text style={styles.label}>תפקיד</Text>
          <View style={styles.roleRow}>
            {JOB_ROLES.map(({ role, label }) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleBtn, selectedRole === role && styles.roleBtnActive]}
                onPress={() => setSelectedRole(role)}
              >
                <Text style={[styles.roleBtnText, selectedRole === role && styles.roleBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder="לפחות 6 תווים"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textAlign="right"
          />

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('auth.registerBtn')}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>
              {t('auth.haveAccount')}{' '}
              <Text style={styles.linkBold}>{t('auth.login')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl,
  },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  appName: { ...typography.h1, color: colors.primary, marginBottom: spacing.xs, letterSpacing: 1 },
  title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: MIN_TOUCH,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'right',
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    ...shadow.sm,
  },
  btnText: { ...typography.bodyBold, color: '#fff', fontSize: 16 },
  linkRow: { marginTop: spacing.md, alignItems: 'center' },
  link: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  linkBold: { color: colors.primary, fontWeight: '700' },
  roleRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.xs },
  roleBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  roleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleBtnText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  roleBtnTextActive: { color: '#fff' },
});
