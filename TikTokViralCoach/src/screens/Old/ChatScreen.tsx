/**
 * ChatScreen - Improved Readability Version
 * Better spacing, formatting, and structure
 */

import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';
import {
  Title,
  Paragraph,
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { ApiService } from '../services/ApiService';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatScreen({ route }: any) {
  const { niche } = route.params;
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Hey! I'm your ${niche} coach 🎯\n\nAsk me anything about:\n• Hooks & engagement\n• Trending sounds\n• Hashtag strategy\n• Video editing tips\n• Posting schedule`,
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  const quickQuestions = [
    'Best hashtags? #️⃣',
    'When to post? ⏰',
    'Hook tips? 🎣',
    'Trending sounds? 🎵',
  ];

  const formatMessage = (text: string): string[] => {
    // Split into paragraphs and bullet points for better readability
    return text.split('\n\n').filter(p => p.trim());
  };

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

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const response = await ApiService.askQuestion(
        text.trim(),
        messages,
        niche
      );

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'oops, something went wrong 😅 try asking again?',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0A0A0A', '#1A1A1A']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <Title style={styles.headerEmoji}>💬</Title>
          <Title style={styles.title}>ask anything</Title>
          <Paragraph style={styles.subtitle}>
            {niche} coach
          </Paragraph>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.isUser ? styles.userMessageWrapper : styles.botMessageWrapper
              ]}
            >
              <Card style={styles.messageCard}>
                {message.isUser ? (
                  <LinearGradient
                    colors={['#FF006E', '#8338EC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.messageGradient}
                  >
                    <Paragraph style={styles.userMessageText}>
                      {message.text}
                    </Paragraph>
                  </LinearGradient>
                ) : (
                  <LinearGradient
                    colors={['#2A2A2A', '#1A1A1A']}
                    style={styles.messageGradient}
                  >
                    {/* Format bot messages with better spacing */}
                    {formatMessage(message.text).map((paragraph, index) => (
                      <View key={index} style={styles.paragraphContainer}>
                        <Paragraph style={styles.botMessageText}>
                          {paragraph.trim()}
                        </Paragraph>
                      </View>
                    ))}
                  </LinearGradient>
                )}
              </Card>
            </View>
          ))}

          {loading && (
            <View style={styles.loadingWrapper}>
              <Card style={styles.loadingCard}>
                <LinearGradient
                  colors={['#2A2A2A', '#1A1A1A']}
                  style={styles.loadingGradient}
                >
                  <ActivityIndicator size="small" color="#FFBE0B" />
                  <Paragraph style={styles.loadingText}>thinking...</Paragraph>
                </LinearGradient>
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Quick Questions */}
        {messages.length <= 1 && !loading && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickQuestionsContainer}
            contentContainerStyle={styles.quickQuestionsContent}
          >
            {quickQuestions.map((question, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => sendMessage(question)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#2A2A2A', '#1A1A1A']}
                  style={styles.quickQuestion}
                >
                  <Paragraph style={styles.quickQuestionText}>
                    {question}
                  </Paragraph>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <Card style={styles.inputCard}>
            <View style={styles.inputWrapper}>
              <RNTextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="type your question..."
                placeholderTextColor="#666"
                style={styles.input}
                multiline
                maxLength={500}
              />
              
              <TouchableOpacity
                onPress={() => sendMessage(inputText)}
                disabled={!inputText.trim() || loading}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={
                    !inputText.trim() || loading
                      ? ['#444', '#333']
                      : ['#FFBE0B', '#FF006E']
                  }
                  style={styles.sendButton}
                >
                  <Title style={styles.sendButtonText}>
                    {loading ? '...' : '→'}
                  </Title>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
    textTransform: 'lowercase',
  },
  subtitle: {
    fontSize: 14,
    color: '#B0B0B0',
    textTransform: 'lowercase',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 10,
  },
  messageWrapper: {
    marginBottom: 20,
    maxWidth: '85%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
  },
  botMessageWrapper: {
    alignSelf: 'flex-start',
  },
  messageCard: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 0,
  },
  messageGradient: {
    padding: 16,
  },
  userMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  botMessageText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  paragraphContainer: {
    marginBottom: 12,
  },
  loadingWrapper: {
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  loadingCard: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 0,
  },
  loadingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingHorizontal: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#B0B0B0',
    fontStyle: 'italic',
    textTransform: 'lowercase',
  },
  quickQuestionsContainer: {
    maxHeight: 60,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  quickQuestionsContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  quickQuestion: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  quickQuestionText: {
    fontSize: 13,
    color: '#B0B0B0',
    textTransform: 'lowercase',
  },
  inputContainer: {
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  inputCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 25,
    elevation: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 5,
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  sendButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
