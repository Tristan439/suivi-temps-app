import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged, User } from 'firebase/auth';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import TimerScreen from './screens/TimerScreen';
import PomodoroScreen from './screens/PomodoroScreen';
import TasksScreen from './screens/TasksScreen';
import SettingsScreen from './screens/SettingsScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import { auth } from './services/firebase';
import { colors } from './styles/global';
import { configureGlobalNotificationHandler } from './utils/notifications';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

configureGlobalNotificationHandler();

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
  Accueil: { focused: 'home', default: 'home-outline' },
  Minuteur: { focused: 'timer', default: 'timer-outline' },
  Pomodoro: { focused: 'flame', default: 'flame-outline' },
  Tâches: { focused: 'checkmark-done', default: 'checkmark-done-outline' },
  Paramètres: { focused: 'settings', default: 'settings-outline' },
};

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
  },
};

const styles = StyleSheet.create({
  tabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabContainer: {
    flexDirection: 'row',
    width: '88%',
    backgroundColor: colors.darkGray,
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 26,
    marginHorizontal: 5,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
  },
});

const TabBar = ({ state, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 16);

  return (
    <View pointerEvents="box-none" style={[styles.tabWrapper, { paddingBottom: bottomOffset }]}>
      <View style={styles.tabContainer}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const iconConfig = TAB_ICONS[route.name];
          const iconName = focused ? iconConfig.focused : iconConfig.default;
          const color = focused ? colors.white : colors.secondary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              style={[styles.tabItem, focused && styles.tabItemActive]}
              activeOpacity={0.9}
            >
              <Ionicons name={iconName} size={20} color={color} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

function MainApp() {
  return (
    <Tab.Navigator
      initialRouteName="Accueil"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Minuteur" component={TimerScreen} />
      <Tab.Screen name="Pomodoro" component={PomodoroScreen} />
      <Tab.Screen name="Accueil" component={HomeScreen} />
      <Tab.Screen name="Tâches" component={TasksScreen} />
      <Tab.Screen name="Paramètres" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, [initializing]);

  if (initializing) {
    return null;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {user ? <MainApp /> : <AuthStack />}
    </NavigationContainer>
  );
}
