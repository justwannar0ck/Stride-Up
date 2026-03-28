import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  Text, 
  StatusBar, 
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { GiftedChat, IMessage, Bubble, InputToolbar, Send, Day } from 'react-native-gifted-chat';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from './api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AICoachScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const activityId = params.activityId ? Number(params.activityId) : undefined;
  
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const API_ENDPOINT = activityId 
    ? `/api/v1/activities/${activityId}/coach_chat/`
    : `/api/v1/activities/general_chat/`;

  useEffect(() => {
    fetchChatHistory();
  }, [activityId]);

  const fetchChatHistory = async () => {
    try {
      const response = await api.get(API_ENDPOINT);
      const data = response.data;

      if (data.history) {
        const formattedHistory = data.history.map((msg: any, index: number) => ({
          _id: index.toString(),
          text: msg.message,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.role === 'user' ? 1 : 2,
            name: msg.role === 'user' ? 'Me' : 'AI Coach',
            avatar: msg.role === 'model' ? 'https://ui-avatars.com/api/?name=Coach&background=d9e3d0&color=4a4d2e' : undefined,
          },
        })).reverse();

        setMessages(formattedHistory);
      }
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
    setIsTyping(true);

    const userMessage = newMessages[0].text;

    try {
      const response = await api.post(API_ENDPOINT, { message: userMessage });
      const data = response.data;

      if (data.reply) {
        const aiMessage: IMessage = {
          _id: Math.random().toString(),
          text: data.reply,
          createdAt: new Date(),
          user: {
            _id: 2,
            name: 'AI Coach',
            avatar: 'https://ui-avatars.com/api/?name=Coach&background=d9e3d0&color=4a4d2e',
          },
        };
        setMessages((previousMessages) => GiftedChat.append(previousMessages, [aiMessage]));
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsTyping(false);
    }
  }, [API_ENDPOINT]);

  const renderBubble = (props: any) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: { backgroundColor: '#d9e3d0' },
          left: { backgroundColor: 'rgba(255,255,255,0.1)' } 
        }}
        textStyle={{
          right: { color: '#4a4d2e', fontWeight: '500' }, 
          left: { color: '#d9e3d0' } 
        }}
      />
    );
  };

  const renderInputToolbar = (props: any) => {
    return (
      <InputToolbar
        {...props}
        containerStyle={styles.inputToolbar}
        primaryStyle={{ alignItems: 'center' }}
      />
    );
  };

  const renderSend = (props: any) => {
    return (
      <Send {...props}>
        <View style={styles.sendButton}>
          <Ionicons name="send" size={20} color="#d9e3d0" />
        </View>
      </Send>
    );
  };

  const renderDay = (props: any) => {
    return (
      <Day {...props} textStyle={{ color: '#8a8d6a' }} />
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 45 : 0} 
    >
      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {activityId ? 'Activity Coach' : 'General Coach'}
          </Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#d9e3d0" />
            <Text style={styles.loadingText}>Loading chat...</Text>
          </View>
        ) : (
          <GiftedChat
            messages={messages}
            onSend={onSend}
            user={{ _id: 1 }}
            isTyping={isTyping}
            alwaysShowSend
            renderBubble={renderBubble}
            renderInputToolbar={renderInputToolbar}
            renderSend={renderSend}
            renderDay={renderDay}
            isKeyboardInternallyHandled={false}
            bottomOffset={Platform.OS === 'ios' ? insets.bottom : 0}
            textInputProps={{
              style: styles.textInput,
              placeholderTextColor: '#8a8d6a'
            }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#d9e3d0',
    marginTop: 16,
    fontSize: 16,
  },
  inputToolbar: {
    backgroundColor: '#4a4d2e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  textInput: {
    color: '#d9e3d0',
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    fontSize: 16,
  },
  sendButton: {
    marginBottom: 8,
    marginRight: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8a8d6a',
    justifyContent: 'center',
    alignItems: 'center',
  }
});