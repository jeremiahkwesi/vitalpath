import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { Card, SectionHeader, Pill } from "../src/ui/components/UKit";
import {
  TEMPLATES,
  buildDraftFromTemplate,
  storeDraft,
  WorkoutTemplate,
} from "../src/services/workoutTemplates";
import { useNavigation } from "@react-navigation/native";

export default function WorkoutTemplatesScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();

  const [active, setActive] = useState<WorkoutTemplate | null>(null);

  const useTemplate = async (tpl: WorkoutTemplate) => {
    if (!user?.uid) {
      alert("Sign in required");
      return;
    }
    const draft = buildDraftFromTemplate(tpl);
    await storeDraft(user.uid, draft);
    nav.navigate("RoutineBuilder", {
      origin: "templates",
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <SectionHeader
        title="Templates"
        subtitle="Curated plans you can customize in the builder"
      />

      {TEMPLATES.map((t) => (
        <Card key={t.id}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: fonts.semiBold,
                  fontSize: 16,
                }}
                numberOfLines={1}
              >
                {t.name}
              </Text>
              {!!t.description && (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    marginTop: 4,
                  }}
                >
                  {t.description}
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  marginTop: 8,
                }}
              >
                {t.days.map((d) => (
                  <Pill key={d} label={d} />
                ))}
              </View>
            </View>

            <View style={{ gap: 8, alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={() => useTemplate(t)}
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{ color: "#fff", fontFamily: fonts.semiBold }}
                >
                  Use in Builder
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActive(t)}
                style={{
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface2,
                }}
              >
                <Text
                  style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
                >
                  Preview
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      ))}

      <PreviewModal tpl={active} onClose={() => setActive(null)} />
    </ScrollView>
  );
}

function PreviewModal({
  tpl,
  onClose,
}: {
  tpl: WorkoutTemplate | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  if (!tpl) return null;
  return (
    <Modal transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            padding: 16,
            maxHeight: "85%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 6,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: fonts.semiBold,
                fontSize: 18,
              }}
            >
              {tpl.name}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Ionicons
                name="close"
                size={22}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
          {!!tpl.description && (
            <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
              {tpl.description}
            </Text>
          )}
          <ScrollView
            style={{ maxHeight: "80%" }}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {tpl.days.map((d) => {
              const items = tpl.items.filter((it) => it.day === d);
              return (
                <View key={d} style={{ marginBottom: 10 }}>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: fonts.semiBold,
                      marginBottom: 6,
                    }}
                  >
                    {d}
                  </Text>
                  {items.map((it, idx) => (
                    <Text
                      key={`${d}-${idx}-${it.name}`}
                      style={{
                        color: theme.colors.textMuted,
                        marginBottom: 4,
                      }}
                    >
                      • {it.name} — {it.sets.map((s) => s.reps).join(", ")}
                    </Text>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}