import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";
import { ChatMessage, useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function MessageBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
      {!isOwn && (
        <View style={styles.avatarCol}>
          <UserAvatar name={msg.userName} size={32} />
        </View>
      )}
      <View style={[styles.bubbleCol, isOwn && styles.bubbleColOwn]}>
        {!isOwn && (
          <Text style={[styles.senderName, { color: colors.mutedForeground }]}>{msg.userName}</Text>
        )}
        <View
          style={[
            styles.bubble,
            isOwn
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.bubbleText, { color: isOwn ? "#fff" : colors.foreground }]}>{msg.text}</Text>
        </View>
        <Text style={[styles.msgTime, { color: colors.mutedForeground, alignSelf: isOwn ? "flex-end" : "flex-start" }]}>
          {formatTime(msg.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { messages, sendMessage, loading, error } = useChat();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  // Tab bar is position:absolute on iOS/Android — must clear it manually.
  // Standard tab bar height is 49px; add safe-area bottom for notched iPhones.
  const TAB_BAR_HEIGHT = 49;
  const bottomPad = Platform.OS === "web" ? 8 : TAB_BAR_HEIGHT + insets.bottom + 8;

  useEffect(() => {
    if (!loading && messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [loading, messages.length]);

  async function handleSend() {
    if (!text.trim() || !user || sending) return;
    const draft = text.trim();
    setSending(true);
    setText("");
    try {
      await sendMessage(user.id, user.name, draft);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setText(draft); // restore so user doesn't lose message
      const isPerms = e?.message?.includes("permission-denied");
      Alert.alert(
        "Message not sent",
        isPerms
          ? "Firestore permissions are blocking the chat collection. Please publish the security rules in Firebase Console (see instructions below)."
          : "Could not send message. Check your connection and try again."
      );
    } finally {
      setSending(false);
    }
  }

  const onlineCount = 12;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? TAB_BAR_HEIGHT + insets.bottom : 0}
    >
      <LinearGradient colors={["#1F2937", "#0F4C75"]} style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <View style={[styles.chatIcon, { backgroundColor: "rgba(20,184,166,0.2)" }]}>
              <Feather name="message-circle" size={22} color="#14B8A6" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Community Chat</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{onlineCount} members active</Text>
              </View>
            </View>
          </View>
          <Feather name="users" size={20} color="rgba(255,255,255,0.6)" />
        </View>
      </LinearGradient>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const isOwn = item.userId === user?.id;
          const prev = messages[index - 1];
          const showDate =
            !prev || new Date(item.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
          return (
            <>
              {showDate && (
                <View style={styles.dateRow}>
                  <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dateText, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
                    {new Date(item.createdAt).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                  </Text>
                  <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                </View>
              )}
              <MessageBubble msg={item} isOwn={isOwn} />
            </>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.empty}>
              <Feather name="alert-circle" size={40} color="#EF4444" />
              <Text style={[styles.emptyText, { color: "#EF4444", fontFamily: "Inter_600SemiBold" }]}>
                {error === "permission-denied" ? "Chat blocked by Firestore rules" : "Could not load messages"}
              </Text>
              {error === "permission-denied" && (
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontSize: 12, marginTop: 4 }]}>
                  Go to Firebase Console → Firestore → Rules and publish the{" "}
                  <Text style={{ fontFamily: "Inter_600SemiBold" }}>chat</Text> collection rules.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="message-circle" size={40} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No messages yet. Be the first to say hi! 👋
              </Text>
            </View>
          )
        }
      />

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Say something helpful..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: text.trim() ? colors.primary : colors.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#14B8A6",
  },
  onlineText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 4,
  },
  msgRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "flex-end",
  },
  msgRowOwn: {
    flexDirection: "row-reverse",
  },
  avatarCol: {
    marginBottom: 16,
  },
  bubbleCol: {
    maxWidth: "75%",
    gap: 3,
  },
  bubbleColOwn: {
    alignItems: "flex-end",
  },
  senderName: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
    paddingHorizontal: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 8,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
