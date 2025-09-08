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
import RoutineBuilderScreen from "./RoutineBuilderScreen";
import WorkoutSessionScreen from "./WorkoutSessionScreen";
import WorkoutsHomeScreen from "./WorkoutsHomeScreen";
import RoutinesScreen from "./RoutinesScreen";
import MealPlannerScreen from "./MealPlannerScreen";
import ProfileScreen from "./ProfileScreen";
import SettingsScreen from "./SettingsScreen";
import LibraryScreen from "./LibraryScreen";
import EditProfileScreen from "./EditProfileScreen";
import EditGoalsScreen from "./EditGoalsScreen";
import StrengthStatsScreen from "./StrengthStatsScreen";
import WorkoutTemplatesScreen from "./WorkoutTemplatesScreen";

import ErrorBoundary from "../src/components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../src/ui/ThemeProvider";
import { ToastProvider } from "../src/ui/components/Toast";
import { configureForegroundNotifications } from "../src/utils/notifications";

export type RootTabParamList = {
  Home: undefined;
  Scan: undefined;
  Plan: undefined;
  Workouts: undefined;
  Coach: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator();

function applyAccessibilityDefaults() {
  try {
    if ((Text as any) && (Text as any).defaultProps == null)
      (Text as any).defaultProps = {};
    (Text as any).defaultProps.maxFontSizeMultiplier = 1.3;

    if ((TextInput as any) && (TextInput as any).defaultProps == null)
      (TextInput as any).defaultProps = {};
    (TextInput as any).defaultProps.maxFontSizeMultiplier = 1.3;
  } catch {}
}

function PlanStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={({ navigation, route }) => ({
        headerStyle: { backgroundColor: theme.colors.surface },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.appBg },
        headerLeft: () => {
          const origin = (route.params as any)?.origin;
          if (origin === "home") {
            return (
              <Ionicons
                name="chevron-back"
                size={24}
                color={theme.colors.text}
                onPress={() => navigation.navigate("Home" as never)}
              />
            );
          }
          return undefined;
        },
      })}
    >
      <Stack.Screen
        name="Planner"
        component={MealPlannerScreen}
        options={{ title: "Plan" }}
      />
      <Stack.Screen
        name="FoodSearch"
        component={require("./FoodSearchScreen").default}
        options={{ title: "Search Food" }}
      />
      <Stack.Screen
        name="FoodAdd"
        component={require("./FoodAddScreen").default}
        options={{ title: "Add Food" }}
      />
      <Stack.Screen
        name="MealsDiary"
        component={require("./MealsDiaryScreen").default}
        options={{ title: "Today’s Meals" }}
      />
      <Stack.Screen
        name="Recipes"
        component={require("./RecipesScreen").default}
        options={{ title: "My Recipes" }}
      />
      <Stack.Screen
        name="RecipeImport"
        component={require("./RecipeImportScreen").default}
        options={{ title: "Import Recipe" }}
      />
      <Stack.Screen
        name="Grocery"
        component={require("./GroceryListScreen").default}
        options={{ title: "Grocery List" }}
      />
      <Stack.Screen
        name="Pantry"
        component={require("./PantryScreen").default}
        options={{ title: "Pantry" }}
      />
      <Stack.Screen
        name="WeeklyCheckIn"
        component={require("./WeeklyCheckInScreen").default}
        options={{ title: "Weekly Check‑in" }}
      />
      <Stack.Screen
        name="WeeklyReport"
        component={require("./WeeklyReportScreen").default}
        options={{ title: "AI Weekly Report" }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: "History" }}
      />
      <Stack.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: "Meal Library" }}
      />
    </Stack.Navigator>
  );
}

function WorkoutsStack() {
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
      <Stack.Screen
        name="WorkoutsHome"
        component={WorkoutsHomeScreen}
        options={{ title: "Workouts" }}
      />
      <Stack.Screen
        name="Programs"
        component={ProgramsScreen}
        options={{ title: "Browse Exercises" }}
      />
      <Stack.Screen
        name="Routines"
        component={RoutinesScreen}
        options={{ title: "My Routines" }}
      />
      <Stack.Screen
        name="RoutineBuilder"
        component={RoutineBuilderScreen}
        options={{ title: "Workout Builder" }}
      />
      <Stack.Screen
        name="WorkoutSession"
        component={WorkoutSessionScreen}
        options={{ title: "Session" }}
      />
      <Stack.Screen
        name="StrengthStats"
        component={StrengthStatsScreen}
        options={{ title: "Strength Stats" }}
      />
      <Stack.Screen
        name="WorkoutTemplates"
        component={WorkoutTemplatesScreen}
        options={{ title: "Templates" }}
      />
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
      <Stack.Screen
        name="Assistance"
        component={AssistanceScreen}
        options={{ title: "Coach" }}
      />
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
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="Setup"
        component={ProfileSetupScreen}
        options={{ title: "Complete Profile" }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: "Edit Profile" }}
      />
      <Stack.Screen
        name="EditGoals"
        component={EditGoalsScreen}
        options={{ title: "Edit Goals" }}
      />
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
      case "Workouts":
        return focused ? "barbell" : "barbell-outline";
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
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface,
          opacity: 0.92,
        }}
      />
    ) : (
      <BlurView
        intensity={35}
        tint={theme.isDark ? "dark" : "light"}
        style={{ flex: 1 }}
      />
    );

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={iconFor(route.name as keyof RootTabParamList, focused)}
              size={size}
              color={color}
            />
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
        <Tab.Screen
          name="Home"
          component={DietaryScreen}
          options={{ title: "Home" }}
        />
        <Tab.Screen
          name="Scan"
          component={ScanFoodScreen}
          options={{ title: "Scan" }}
        />
        <Tab.Screen
          name="Plan"
          component={PlanStack}
          options={{ title: "Plan" }}
        />
        <Tab.Screen
          name="Workouts"
          component={WorkoutsStack}
          options={{ title: "Workouts" }}
        />
        <Tab.Screen
          name="Coach"
          component={CoachStack}
          options={{ title: "Coach" }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{ title: "Profile" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function AppShell() {
  const { user } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    applyAccessibilityDefaults();
    configureForegroundNotifications();
  }, []);

  if (!user) return <AuthScreen />;

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