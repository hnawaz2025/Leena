import { Component, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, spacing, typography } from "../theme";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, any render error anywhere in the app unmounts everything and
// leaves a white screen -- no message, no way back, nothing on screen to
// photograph or report. This catches it and offers a way out.
//
// The copy is written for someone who reads English as a second language and
// is likely to assume they broke it: short sentences, plainly not their fault,
// and an explicit statement that their saved work survived. The error text
// itself is deliberately not shown -- a React stack trace helps nobody here,
// and it goes to the console for us instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  // Clearing the error remounts the tree from scratch, which recovers from
  // anything caused by transient state rather than bad data.
  handleRetry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          This is a problem with the app, not with you. Your practice and your saved phrases are
          safe.
        </Text>
        <Button label="Try again" onPress={this.handleRetry} style={styles.button} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { ...typography.h1, textAlign: "center", marginBottom: spacing.md },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },
  button: { marginTop: spacing.xl, alignSelf: "stretch" },
});
