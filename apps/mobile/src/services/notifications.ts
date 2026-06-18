/**
 * Push Notifications Service
 * Handles asking engine notifications (max one per day)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { askingEngine } from './askingEngine';
import { lastfm } from './lastfm';

const NOTIFICATION_CHANNEL_ID = 'asking-engine';
const LAST_NOTIFICATION_DATE_KEY = '@linernotes:last_notification_date';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;

  /**
   * Initialize notifications and request permissions
   */
  async initialize() {
    if (!Device.isDevice) {
      console.log('Notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for notifications');
      return null;
    }

    // Get push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '9b3785c0-ecf9-4932-8ebc-7bceaf551ff9',
    });
    this.expoPushToken = token.data;

    // Android: Create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Asking Engine',
        description: 'Daily writing prompts from what you have been listening to',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return this.expoPushToken;
  }

  /**
   * Schedule daily asking engine notification
   * Checks Last.fm data and sends highest-priority prompt
   */
  async scheduleDailyPrompt() {
    try {
      // Check if we already sent one today
      const lastNotifDate = await AsyncStorage.getItem(LAST_NOTIFICATION_DATE_KEY);
      const today = new Date().toDateString();

      if (lastNotifDate === today) {
        console.log('Already sent notification today');
        return;
      }

      // Check if Last.fm is connected
      const username = await lastfm.getUsername();
      if (!username) {
        console.log('No Last.fm connected, skipping notification');
        return;
      }

      // Generate prompt from Last.fm data
      const prompt = await askingEngine.generatePrompts(username, undefined);

      if (!prompt) {
        console.log('No prompt generated, skipping notification');
        return;
      }

      // Send notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'worth a note',
          body: prompt.prompt,
          data: {
            promptId: prompt.id,
            type: prompt.type,
            artist: prompt.artist,
            track: prompt.track,
            album: prompt.album,
          },
          sound: false,
        },
        trigger: {
          seconds: 5, // Send after 5 seconds for testing - in production, schedule for evening
          channelId: NOTIFICATION_CHANNEL_ID,
        },
      });

      // Mark notification as sent
      await AsyncStorage.setItem(LAST_NOTIFICATION_DATE_KEY, today);
      await askingEngine.markPromptShown();

      console.log('Scheduled asking engine notification:', prompt.prompt);
    } catch (error) {
      console.error('Failed to schedule daily prompt:', error);
    }
  }

  /**
   * Schedule notification for a specific time (evening)
   * Call this after user listens to music during the day
   */
  async scheduleEveningPrompt(hour: number = 19) {
    // Cancel any existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Calculate time until target hour
    const now = new Date();
    const target = new Date();
    target.setHours(hour, 0, 0, 0);

    // If target time has passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const secondsUntilTarget = Math.floor((target.getTime() - now.getTime()) / 1000);

    // Get Last.fm data and generate prompt
    const username = await lastfm.getUsername();
    if (!username) return;

    const prompt = await askingEngine.generatePrompts(username, undefined);
    if (!prompt) return;

    // Schedule for evening
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'worth a note',
        body: prompt.prompt,
        data: {
          promptId: prompt.id,
          type: prompt.type,
          artist: prompt.artist,
          track: prompt.track,
          album: prompt.album,
        },
        sound: false,
      },
      trigger: {
        seconds: secondsUntilTarget,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });

    console.log(`Scheduled notification for ${target.toLocaleTimeString()}`);
  }

  /**
   * Handle notification tap (deep-link to composer)
   */
  addNotificationResponseListener(handler: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(handler);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const notificationService = new NotificationService();
