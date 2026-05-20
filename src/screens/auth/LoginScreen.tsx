import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, I18nManager, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { loginUser, loginWithGoogle } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography, shadow, MIN_TOUCH } from '../../theme';

I18nManager.forceRTL(true);

export default function LoginScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      setUser(user);
    } catch (e: any) {
      if (e?.message === 'ELECTRON_ENV') {
        // ב-Electron — פתח דפדפן עם הכתובת של האפליקציה
        if (typeof window !== 'undefined' && (window as any).require) {
          const { shell } = (window as any).require('electron');
          shell.openExternal('http://localhost:8081');
        } else {
          Alert.alert(
            'כניסה עם Google',
            'כניסה עם Google זמינה רק דרך הדפדפן.\nפתח את האפליקציה בדפדפן: localhost:8081',
            [{ text: 'אישור' }]
          );
        }
      } else if (e?.code !== 'auth/popup-closed-by-user') {
        Alert.alert(t('common.error'), 'כניסה עם Google נכשלה — נסה שוב');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('common.error'), 'נא למלא אימייל וסיסמה');
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(email.trim(), password);
      setUser(user);
    } catch (e: any) {
      const code = e?.code ?? '';
      const msg =
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'אימייל או סיסמה שגויים'
          : code === 'auth/too-many-requests'
          ? 'יותר מדי ניסיונות — נסה שוב מאוחר יותר'
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
          <Text style={styles.title}>{t('auth.login')}</Text>
        </View>

        <View style={styles.form}>
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

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textAlign="right"
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('auth.loginBtn')}</Text>
            }
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>או</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <View style={styles.googleBtnInner}>
                <Image
                  source={require('../../../assets/google-logo.png')}
                  style={{ width: 20, height: 20 }}
                />
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>
              {t('auth.noAccount')}{' '}
              <Text style={styles.linkBold}>{t('auth.register')}</Text>
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
  appName: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  title: { ...typography.body, color: colors.textSecondary },
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
  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    ...typography.caption, color: colors.textMuted,
    marginHorizontal: spacing.sm,
  },
  googleBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  googleBtnText: { ...typography.bodyBold, color: colors.textPrimary, fontSize: 15 },
});
