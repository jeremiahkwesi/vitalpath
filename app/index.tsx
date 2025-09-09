import "react-native-gesture-handler";
import React, { useEffect, Suspense } from "react";
import {
  Platform,
  View,
  Text,
  ActivityIndicator,
  TextInput,
} from "react-native";
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
import { ThemeProvider, useTheme } from "../src/ui/ThemeProvider";
import { ToastProvider } from "../src/ui/components/Toast";
import ErrorBoundary from "../src/components/ErrorBoundary";
import { configureForegroundNotifications } from "../src/utils/notifications";

// Lazy screens (top-level to avoid re-creating lazies on re-render)
const AuthScreen = React.lazy(() => import("./AuthScreen"));
const ProfileSetupScreen = React.lazy(() => import("./ProfileSetupScreen"));
const DietaryScreen = React.lazy(() => import("./DietaryScreen"));
const AssistanceScreen = React.lazy(() => import("./AssistanceScreen"));
const HistoryScreen = React.lazy(() => import("./HistoryScreen"));
const ScanFoodScreen = React.lazy(() => import("./ScanFoodScreen"));
const ProgramsScreen = React.lazy(() => import("./ProgramsScreen"));
const RoutineBuilderScreen = React.lazy(() => import("./RoutineBuilderScreen"));
const WorkoutSessionScreen = React.lazy(() => import("./WorkoutSessionScreen"));
const WorkoutsHomeScreen = React.lazy(() => import("./WorkoutsHomeScreen"));
const RoutinesScreen = React.lazy(() => import("./RoutinesScreen"));
const MealPlannerScreen = React.lazy(() => import("./MealPlannerScreen"));
const ProfileScreen = React.lazy(() => import("./ProfileScreen"));
const SettingsScreen = React.lazy(() => import("./SettingsScreen"));
const EditProfileScreen = React.lazy(() => import("./EditProfileScreen"));
const EditGoalsScreen = React.lazy(() => import("./EditGoalsScreen"));
const StrengthStatsScreen = React.lazy(() => import("./StrengthStatsScreen"));
const WorkoutTemplatesScreen = React.lazy(
  () => import("./WorkoutTemplatesScreen")
);
const FoodSearchScreen = React.lazy(() => import("./FoodSearchScreen"));
const FoodAddScreen = React.lazy(() => import("./FoodAddScreen"));
const MealsDiaryScreen = React.lazy(() => import("./MealsDiaryScreen"));
const RecipesScreen = React.lazy(() => import("./RecipesScreen"));
const RecipeImportScreen = React.lazy(() => import("./RecipeImportScreen"));
const PantryScreen = React.lazy(() => import("./PantryScreen"));
const PantryMealIdeasScreen = React.lazy(
  () => import("./PantryMealIdeasScreen")
);
const WeeklyCheckInScreen = React.lazy(() => import("./WeeklyCheckInScreen"));
const WeeklyReportScreen = React.lazy(() => import("./WeeklyReportScreen"));
const PlanDetailsScreen = React.lazy(() => import("./PlanDetailsScreen"));

export type RootTabParamList = {
  Home: undefined;
  Plan: undefined;
  Workouts: undefined;
  Coach: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator();

function applyAccessibilityDefaults() {
  try {
    (Text as any).defaultProps = (Text as any).defaultProps || {};
    (Text as any).defaultProps.maxFontSizeMultiplier = 1.3;
    (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
    (TextInput as any).defaultProps.maxFontSizeMultiplier = 1.3;
  } catch (e) {
    // no-op
  }
}

const LoadingScreen = React.memo(() => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.appBg,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text
        style={{
          marginTop: 16,
          color: theme.colors.text,
          fontSize: 16,
        }}
      >
        Loading...
      </Text>
    </View>
  );
});

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
                style={{ marginRight: 8 }}
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
        component={FoodSearchScreen}
        options={{ title: "Search Food" }}
      />
      <Stack.Screen
        name="FoodAdd"
        component={FoodAddScreen}
        options={{ title: "Add Food" }}
      />
      <Stack.Screen
        name="MealsDiary"
        component={MealsDiaryScreen}
        options={{ title: "Today's Meals" }}
      />
      <Stack.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{ title: "My Recipes" }}
      />
      <Stack.Screen
        name="RecipeImport"
        component={RecipeImportScreen}
        options={{ title: "Import Recipe" }}
      />
      <Stack.Screen
        name="Pantry"
        component={PantryScreen}
        options={{ title: "Pantry" }}
      />
      <Stack.Screen
        name="PantryMealIdeas"
        component={PantryMealIdeasScreen}
        options={{ title: "Pantry → Meals" }}
      />
      <Stack.Screen
        name="WeeklyCheckIn"
        component={WeeklyCheckInScreen}
        options={{ title: "Weekly Check‑in" }}
      />
      <Stack.Screen
        name="WeeklyReport"
        component={WeeklyReportScreen}
        options={{ title: "AI Weekly Report" }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: "History" }}
      />
      <Stack.Screen name="Scan" component={ScanFoodScreen} options={{ title: "Scan" }} />
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
      <Stack.Screen
        name="PlanDetails"
        component={PlanDetailsScreen}
        options={{ title: "Plan Details" }}
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
          tabBarLabelStyle: {
            fontSize: 12,
            paddingBottom: 6,
          },
          tabBarHideOnKeyboard: true,
        })}
      >
        <Tab.Screen name="Home" component={DietaryScreen} options={{ title: "Home" }} />
        <Tab.Screen name="Plan" component={PlanStack} options={{ title: "Plan" }} />
        <Tab.Screen
          name="Workouts"
          component={WorkoutsStack}
          options={{ title: "Workouts" }}
        />
        <Tab.Screen name="Coach" component={CoachStack} options={{ title: "Coach" }} />
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
  const { user, userProfile, loading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    applyAccessibilityDefaults();
    configureForegroundNotifications();
  }, []);

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthScreen />
      </Suspense>
    );
  }

  const incomplete =
    !userProfile ||
    !userProfile.name ||
    !userProfile.height ||
    !userProfile.weight ||
    !userProfile.goal;
  if (loading) return <LoadingScreen />;
  if (incomplete) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <ProfileSetupScreen />
      </Suspense>
    );
  }

  return (
    <ActivityProvider>
      <ErrorBoundary>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <Suspense fallback={<LoadingScreen />}>
          <TabNav />
        </Suspense>
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