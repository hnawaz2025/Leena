import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../api/client";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

// MVP is turn-based text input/output. Voice (mic capture -> STT -> this same
// sendTurn call -> TTS playback of the agent reply) is the next milestone —
// it slots in here without changing the transcript/session logic.
export function ConversationScreen({ route, navigation }: Props) {
  const { sessionId, targetLanguage } = route.params;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: turns, refetch } = useQuery({
    queryKey: ["turns", sessionId],
    queryFn: () => api.listTurns(sessionId),
  });

  async function handleSend() {
    if (!input.trim()) return;
    setSending(true);
    setError(null);
    const text = input.trim();
    setInput("");
    try {
      await api.sendTurn(sessionId, text, targetLanguage);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function handleEnd() {
    setEnding(true);
    setError(null);
    try {
      await api.endSession(sessionId);
      navigation.replace("Feedback", { sessionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setEnding(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        style={styles.list}
        data={turns ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.speaker === "user" ? styles.userBubble : styles.agentBubble]}>
            <Text style={item.speaker === "user" ? styles.userText : styles.agentText}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Say something to start the conversation.</Text>
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={`Type in ${targetLanguage}…`}
          value={input}
          onChangeText={setInput}
          editable={!sending}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>Send</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endButton} onPress={handleEnd} disabled={ending}>
        {ending ? (
          <ActivityIndicator color="#2f6fed" />
        ) : (
          <Text style={styles.endButtonText}>End conversation & get feedback</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  list: { flex: 1, padding: 16 },
  empty: { color: "#888", textAlign: "center", marginTop: 40 },
  bubble: { padding: 12, borderRadius: 14, marginBottom: 10, maxWidth: "80%" },
  userBubble: { backgroundColor: "#2f6fed", alignSelf: "flex-end" },
  agentBubble: { backgroundColor: "#f0f0f0", alignSelf: "flex-start" },
  userText: { color: "#fff", fontSize: 15 },
  agentText: { color: "#222", fontSize: 15 },
  inputRow: { flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15 },
  sendButton: {
    backgroundColor: "#2f6fed",
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  sendButtonText: { color: "#fff", fontWeight: "600" },
  endButton: { padding: 16, alignItems: "center" },
  endButtonText: { color: "#2f6fed", fontWeight: "600" },
  error: { color: "#c0392b", textAlign: "center", marginTop: 8 },
});
