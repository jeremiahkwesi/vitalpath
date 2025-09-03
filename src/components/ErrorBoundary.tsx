// src/components/ErrorBoundary.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "../ui/ThemeProvider";
import { fonts as fontMap } from "../constants/fonts";

type State = { hasError: boolean; error?: any; info?: any };

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // You can hook this to your logger
    console.error("UI ErrorBoundary caught:", error, info);
    this.setState({ info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return <ErrorView error={this.state.error} info={this.state.info} />;
  }
}

function ErrorView({ error, info }: { error?: any; info?: any }) {
  const { theme } = useTheme();
  const titleStyle = {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700" as const,
  };
  const textStyle = {
    color: theme.colors.text,
    fontSize: 14,
  };
  const mutedStyle = {
    color: theme.colors.textMuted,
    fontSize: 12,
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.appBg, borderColor: theme.colors.border },
      ]}
    >
      <Text style={titleStyle}>Something went wrong while rendering the UI.</Text>
      {error?.message ? (
        <Text style={[textStyle, { marginTop: 8 }]}>
          {String(error.message)}
        </Text>
      ) : null}

      <ScrollView
        style={[
          styles.box,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
        contentContainerStyle={{ padding: 12 }}
      >
        {!!error?.stack && (
          <>
            <Text style={[textStyle, { fontWeight: "600" as const }]}>
              Error stack
            </Text>
            <Text style={[mutedStyle, { marginTop: 6 }]} selectable>
              {String(error.stack)}
            </Text>
          </>
        )}
        {!!info?.componentStack && (
          <>
            <Text style={[textStyle, { marginTop: 12, fontWeight: "600" as const }]}>
              Component stack
            </Text>
            <Text style={[mutedStyle, { marginTop: 6 }]} selectable>
              {String(info.componentStack)}
            </Text>
          </>
        )}
      </ScrollView>

      <Text style={[mutedStyle, { marginTop: 8 }]}>
        Tip: Metro logs will show the exact file and line.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    borderTopWidth: 1,
    justifyContent: "center",
  },
  box: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: "55%",
  },
});