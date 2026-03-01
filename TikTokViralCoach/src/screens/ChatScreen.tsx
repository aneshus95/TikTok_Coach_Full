/**
 * ChatScreen - Content Flow Edition
 * Dark tech chat interface with cyan accents
 */

import React, { useState, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, TextInput as RNTextInput,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { ApiService } from '../services/ApiService';
import LoadingAnimation from '../components/LoadingAnimation';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  'Best hashtag strategy?',
  'Optimal posting times?',
  'Hook writing tips?',
  'Trending sounds?',
];

export default function ChatScreen({ route, navigation }: any) {
  const { niche } = route.params;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `I'm your ${niche} content strategist. Ask me anything about hooks, sounds, hashtags, editing, or scheduling.`,
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await ApiService.askQuestion(text.trim(), messages, niche);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Connection error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Paragraph style={styles.backBtnText}>{'←'}</Paragraph>
            </TouchableOpacity>
            <View style={styles.avatarRing}>
              <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.avatar}>
                <Paragraph style={styles.avatarText}>AI</Paragraph>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Title style={styles.headerTitle}>Content Coach</Title>
              <View style={styles.statusRow}>
                <View style={styles.onlineDot} />
                <Paragraph style={styles.statusText}>{niche} specialist • online</Paragraph>
              </View>
            </View>
          </View>
          <View style={styles.sessionBadge}>
            <Paragraph style={styles.sessionText}>SESSION</Paragraph>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[styles.messageRow, message.isUser && styles.messageRowUser]}
            >
              {!message.isUser && (
                <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.botDot}>
                  <Paragraph style={styles.botDotText}>AI</Paragraph>
                </LinearGradient>
              )}
              <View style={[
                styles.bubble,
                message.isUser ? styles.bubbleUser : styles.bubbleBot
              ]}>
                {message.isUser && <View style={styles.bubbleGlow} />}
                <Paragraph style={[
                  styles.bubbleText,
                  message.isUser && styles.bubbleTextUser
                ]}>
                  {message.text}
                </Paragraph>
              </View>
            </View>
          ))}

          {loading && (
            <View style={styles.messageRow}>
              <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.botDot}>
                <Paragraph style={styles.botDotText}>AI</Paragraph>
              </LinearGradient>
              <View style={styles.loadingBubble}>
                <LoadingAnimation size={40} />
                <Paragraph style={styles.loadingText}>Analyzing...</Paragraph>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick questions */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.quickBar} contentContainerStyle={styles.quickBarContent}
          >
            {QUICK_QUESTIONS.map((q, i) => (
              <TouchableOpacity key={i} onPress={() => sendMessage(q)} activeOpacity={0.7}>
                <View style={styles.quickChip}>
                  <Paragraph style={styles.quickChipText}>{q}</Paragraph>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.divider} />

        {/* Input */}
        <View style={styles.inputBar}>
          <View style={styles.inputContainer}>
            <RNTextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask your content coach..."
              placeholderTextColor="#334155"
              style={styles.input}
              multiline maxLength={500}
            />
          </View>
          <TouchableOpacity
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={!inputText.trim() || loading ? ['#1E293B', '#1E293B'] : ['#00D4FF', '#00FFB3']}
              style={styles.sendBtn}
            >
              <Paragraph style={[styles.sendIcon, (!inputText.trim() || loading) && styles.sendIconDisabled]}>
                →
              </Paragraph>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  backBtnText: { fontSize: 22, color: '#00D4FF', fontWeight: '600', marginTop: -2 },
  avatarRing: { width: 44, height: 44, borderRadius: 22, padding: 2, marginRight: 12 },
  avatar: { flex: 1, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '900', color: '#050810' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#E2F0FF', marginBottom: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FFB3', marginRight: 6, shadowColor: '#00FFB3', shadowOpacity: 1, shadowRadius: 6 },
  statusText: { fontSize: 12, color: '#64748B' },
  sessionBadge: { backgroundColor: '#00D4FF10', borderWidth: 1, borderColor: '#00D4FF30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sessionText: { fontSize: 9, color: '#00D4FF', letterSpacing: 1.5, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#1E293B' },

  // Messages
  messages: { flex: 1 },
  messagesContent: { padding: 20, paddingBottom: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  messageRowUser: { flexDirection: 'row-reverse' },
  botDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  botDotText: { fontSize: 9, fontWeight: '900', color: '#050810' },

  bubble: {
    maxWidth: '75%', borderRadius: 16, padding: 14,
    position: 'relative', overflow: 'hidden',
  },
  bubbleBot: {
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#00D4FF15',
    borderWidth: 1, borderColor: '#00D4FF40',
    borderBottomRightRadius: 4,
    marginLeft: 10,
  },
  bubbleGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: '#00D4FF', opacity: 0.6,
  },
  bubbleText: { fontSize: 14, color: '#94A3B8', lineHeight: 22 },
  bubbleTextUser: { color: '#E2F0FF' },

  loadingBubble: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, borderBottomLeftRadius: 4,
    flexDirection: 'row', alignItems: 'center',
    padding: 14, paddingHorizontal: 18,
  },
  loadingText: { marginLeft: 10, fontSize: 13, color: '#64748B', letterSpacing: 0.5 },

  // Quick questions
  quickBar: { maxHeight: 56, backgroundColor: '#050810' },
  quickBarContent: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  quickChip: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  quickChipText: { fontSize: 12, color: '#64748B', letterSpacing: 0.3 },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, gap: 12,
  },
  inputContainer: {
    flex: 1, backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 12, paddingHorizontal: 4,
  },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#E2F0FF', maxHeight: 100 },
  sendBtn: { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sendIcon: { fontSize: 20, color: '#050810', fontWeight: '900' },
  sendIconDisabled: { color: '#334155' },
});
