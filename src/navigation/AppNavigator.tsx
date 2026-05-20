import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, TouchableOpacity, Alert, Text, StyleSheet } from 'react-native';
import { logoutUser } from '../services/authService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTranslation } from 'react-i18next';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ShiftsScreen from '../screens/shifts/ShiftsScreen';
import EmployeesScreen from '../screens/employees/EmployeesScreen';
import LeavesScreen from '../screens/leaves/LeavesScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isManager = user?.role === 'manager' || user?.role === 'ceo';
  const isShiftManager = user?.role === 'shift_manager';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.id),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size));
    return unsub;
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: focused ? 'calendar' : 'calendar-outline',
            Shifts: focused ? 'time' : 'time-outline',
            Employees: focused ? 'people' : 'people-outline',
            Leaves: focused ? 'umbrella' : 'umbrella-outline',
            Notifications: focused ? 'notifications' : 'notifications-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1a1a2e',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: t('nav.dashboard') }} />
      <Tab.Screen name="Shifts" component={ShiftsScreen} options={{ title: t('nav.shifts') }} />
      {(isManager || isShiftManager) && (
        <Tab.Screen name="Employees" component={EmployeesScreen} options={{ title: t('nav.employees') }} />
      )}
      <Tab.Screen name="Leaves" component={LeavesScreen} options={{ title: t('nav.leaves') }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: t('nav.notifications'),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

function MainHeader() {
  const { i18n, t } = useTranslation();
  const isHebrew = i18n.language === 'he';

  async function handleLogout() {
    const confirmed = typeof window !== 'undefined' && window.confirm
      ? window.confirm(isHebrew ? 'האם אתה בטוח שרוצה לצאת?' : 'Are you sure you want to logout?')
      : await new Promise<boolean>(resolve =>
          Alert.alert(
            isHebrew ? 'יציאה' : 'Logout',
            isHebrew ? 'האם אתה בטוח שרוצה לצאת?' : 'Are you sure you want to logout?',
            [
              { text: isHebrew ? 'ביטול' : 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: isHebrew ? 'יציאה' : 'Logout', style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        );

    if (!confirmed) return;
    try {
      await logoutUser();
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לצאת כרגע, נסה שוב');
    }
  }

  function toggleLanguage() {
    i18n.changeLanguage(isHebrew ? 'en' : 'he');
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 14 }}>
        {t('nav.appTitle')}
      </Text>
      <TouchableOpacity
        onPress={toggleLanguage}
        style={styles.langBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.langBtnText}>{isHebrew ? 'EN' : 'HE'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleLogout}
        style={{ marginLeft: 10 }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="log-out-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  langBtn: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 14,
  },
  langBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: '#1a1a2e' },
              headerTintColor: '#fff',
              headerTitleAlign: 'center',
              headerTitleStyle: { fontSize: 17, fontWeight: '700' },
              headerTitle: '',
              headerLeft: () => <MainHeader />,
            }}
          />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
