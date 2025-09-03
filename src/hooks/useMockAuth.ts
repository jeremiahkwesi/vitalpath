// src/hooks/useMockAuth.ts
import { useState } from "react";
import { AuthContextType, UserProfile } from "../context/AuthContext";

export const useMockAuth = (): Partial<AuthContextType> => {
  const [loading] = useState(false);

  const mockProfile: UserProfile = {
    uid: "test-user-123",
    name: "John Doe",
    email: "test@example.com",
    age: 30,
    weight: 75,
    height: 1.75,
    gender: "male",
    goal: "lose_weight",
    activityLevel: "moderate",
    healthConditions: [],
    dailyCalories: 2200,
    macros: { protein: 165, carbs: 248, fat: 73 },
    micros: {
      vitaminA: 900,
      vitaminC: 90,
      vitaminD: 15,
      vitaminE: 15,
      vitaminK: 120,
      vitaminB1: 1.2,
      vitaminB2: 1.3,
      vitaminB3: 16,
      vitaminB6: 1.7,
      vitaminB12: 2.4,
      folate: 400,
      calcium: 1000,
      iron: 8,
      magnesium: 400,
      potassium: 3500,
      sodium: 2300,
      zinc: 11,
      phosphorus: 700,
      selenium: 55,
    },
    bmi: 24.5,
    createdAt: new Date(),
  };

  return {
    user: { uid: "test-user-123", email: "test@example.com" } as any,
    userProfile: mockProfile,
    loading,
    signIn: async () => {},
    signUp: async () => {},
    logout: async () => {},
    updateUserProfile: async () => {},
  } as AuthContextType;
};