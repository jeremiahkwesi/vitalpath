// app/EditProfileScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import Select from "../src/ui/components/Select";

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const { userProfile, updateUserProfile } = useAuth();

  const [name, setName] = useState(userProfile?.name || "");
  const [gender, setGender] = useState(userProfile?.gender || "male");
  const [bodyType, setBodyType] = useState(userProfile?.bodyType || "other");
  const [country, setCountry] = useState(userProfile?.country || "");
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(userProfile?.name || "");
    setGender(userProfile?.gender || "male");
    setBodyType(userProfile?.bodyType || "other");
    setCountry(userProfile?.country || "");
    setAvatarUrl(userProfile?.avatarUrl || "");
  }, [userProfile]);

  const hasChanges = useMemo(() => {
    return (
      name.trim() !== (userProfile?.name || "") ||
      gender !== (userProfile?.gender || "male") ||
      bodyType !== (userProfile?.bodyType || "other") ||
      country.trim() !== (userProfile?.country || "") ||
      avatarUrl !== (userProfile?.avatarUrl || "")
    );
  }, [avatarUrl, bodyType, country, gender, name, userProfile]);

  const pickImage = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== "granted")
      return Alert.alert("Permission", "Photos access is needed.");
    const pic = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!pic.canceled && pic.assets?.[0]?.uri) setAvatarUrl(pic.assets[0].uri);
  };

  const save = async () => {
    if (!hasChanges) return;
    setBusy(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        gender,
        bodyType,
        country: country.trim(),
        avatarUrl: avatarUrl || undefined,
      });
      Alert.alert("Saved", "Profile updated.");
    } catch {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Edit Profile</Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.label, { color: theme.colors.text }]}>Avatar</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              borderWidth: 1,
              overflow: "hidden",
            }}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : null}
          </View>
          <TouchableOpacity
            onPress={pickImage}
            style={[
              styles.smallBtn,
              { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
              Choose photo
            </Text>
          </TouchableOpacity>
          {!!avatarUrl && (
            <TouchableOpacity
              onPress={() => setAvatarUrl("")}
              style={[
                styles.smallBtn,
                { backgroundColor: "#FF6B6B", borderColor: "#FF6B6B" },
              ]}
            >
              <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
                Remove
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.label, { color: theme.colors.text }]}>Name</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={theme.colors.textMuted}
        />

        <Select
          label="Gender"
          value={gender}
          items={[
            { label: "Male", value: "male" },
            { label: "Female", value: "female" },
          ]}
          onChange={(v) => setGender(v as any)}
        />
        <Select
          label="Body type"
          value={bodyType}
          items={[
            { label: "Ectomorph", value: "ectomorph" },
            { label: "Mesomorph", value: "mesomorph" },
            { label: "Endomorph", value: "endomorph" },
            { label: "Other", value: "other" },
          ]}
          onChange={(v) => setBodyType(v as any)}
        />
        <Text style={[styles.label, { color: theme.colors.text }]}>Country</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={country}
          onChangeText={setCountry}
          placeholder="e.g., Ghana"
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>

      <TouchableOpacity
        onPress={save}
        disabled={!hasChanges || busy}
        style={[
          styles.apply,
          {
            backgroundColor: theme.colors.primary,
            opacity: !hasChanges || busy ? 0.7 : 1,
          },
        ]}
      >
        <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
          {busy ? "Saving…" : "Save Profile"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  label: { fontFamily: fonts.semiBold, marginBottom: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
    marginBottom: 8,
  },
  apply: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});