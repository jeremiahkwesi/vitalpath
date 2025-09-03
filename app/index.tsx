// app/index.tsx
import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Platform, View, Text, TextInput } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ActivityProvider } from "../src/context/ActivityContext";

import AuthScreen from "./AuthScreen";
import ProfileSetupScreen from "./ProfileSetupScreen";
import DietaryScreen from "./DietaryScreen";
import AssistanceScreen from "./AssistanceScreen";
import HistoryScreen from "./HistoryScreen";
import ScanFoodScreen from "./ScanFoodScreen";
import ProgramsScreen from "./ProgramsScreen";
import MealPlannerScreen from "./MealPlannerScreen";
import ProfileScreen from "./ProfileScreen";
import SettingsScreen from "./SettingsScreen";
import LibraryScreen from "./LibraryScreen";

import ErrorBoundary from "../src/components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../src/ui/ThemeProvider";
import { ToastProvider } from "../src/ui/components/Toast";

export type RootTabParamList = {
  Home: undefined;
  Scan: undefined;
  Plan: undefined;
  Coach: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator();

function applyAccessibilityDefaults() {
  try {
    // Limit extreme font scaling to prevent layout breakage but still respect user settings
    // You can tweak these later if desired
    // @ts-ignore
    if (Text && Text.defaultProps == null) Text.defaultProps = {};
    // @ts-ignore
    Text.defaultProps.maxFontSizeMultiplier = 1.3;

    // @ts-ignore
    if (TextInput && TextInput.defaultProps == null) TextInput.defaultProps = {};
    // @ts-ignore
    TextInput.defaultProps.maxFontSizeMultiplier = 1.3;
  } catch {}
}

function PlanStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.appBg },
      }}
    >
      <Stack.Screen name="Planner" component={MealPlannerScreen} options={{ title: "Plan" }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
      <Stack.Screen name="Library" component={LibraryScreen} options={{ title: "Meal Library" }} />
    </Stack.Navigator>
  );
}

function CoachStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.appBg },
      }}
    >
      <Stack.Screen name="Assistance" component={AssistanceScreen} options={{ title: "Coach" }} />
      <Stack.Screen name="Programs" component={ProgramsScreen} options={{ title: "Programs" }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.appBg },
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Stack.Navigator>
  );
}

function TabNav() {
  const { theme, navTheme } = useTheme();

  const iconFor = (route: keyof RootTabParamList, focused: boolean) => {
    switch (route) {
      case "Home":
        return focused ? "home" : "home-outline";
      case "Scan":
        return focused ? "scan" : "scan-outline";
      case "Plan":
        return focused ? "calendar" : "calendar-outline";
      case "Coach":
        return focused ? "chatbubble" : "chatbubble-outline";
      case "Profile":
        return focused ? "person" : "person-outline";
      default:
        return "ellipse-outline";
    }
  };

  const TabBarBackground = () =>
    Platform.OS === "web" ? (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: 0.92 }} />
    ) : (
      <BlurView intensity={35} tint={theme.isDark ? "dark" : "light"} style={{ flex: 1 }} />
    );

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconFor(route.name as keyof RootTabParamList, focused)} size={size} color={color} />
          ),
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          headerShown: false,
          tabBarStyle: {
            height: 64,
            borderTopWidth: Platform.OS === "android" ? 0.5 : 0,
            borderTopColor: theme.colors.border,
            backgroundColor: "transparent",
          },
          tabBarBackground: TabBarBackground,
          tabBarLabelStyle: { fontSize: 12, paddingBottom: 6 },
          tabBarHideOnKeyboard: true,
        })}
      >
        <Tab.Screen name="Home" component={DietaryScreen} options={{ title: "Home" }} />
        <Tab.Screen name="Scan" component={ScanFoodScreen} options={{ title: "Scan" }} />
        <Tab.Screen name="Plan" component={PlanStack} options={{ title: "Plan" }} />
        <Tab.Screen name="Coach" component={CoachStack} options={{ title: "Coach" }} />
        <Tab.Screen name="Profile" component={ProfileStack} options={{ title: "Profile" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function AppShell() {
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    applyAccessibilityDefaults();
  }, []);

  if (!user) return <AuthScreen />;
  if (!userProfile || !userProfile.name) return <ProfileSetupScreen />;

  return (
    <ActivityProvider>
      <ErrorBoundary>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <TabNav />
      </ErrorBoundary>
    </ActivityProvider>
  );
}

export default function Index() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <AppShell />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}