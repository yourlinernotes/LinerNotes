/**
 * Share utilities for exporting review cards as images
 * Instagram Story format: 1080x1920
 */

import { Alert, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

interface ShareOptions {
  title?: string;
  message?: string;
}

/**
 * Capture a view reference as an image and share it
 */
export async function shareCard(
  viewRef: any,
  options: ShareOptions = {}
): Promise<void> {
  try {
    // Check if sharing is available on this platform
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return;
    }

    // Capture the view as an image at 1080x1920 (Instagram Story size)
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });

    // Share the image
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: options.title || 'Share LinerNote',
      UTI: 'public.png',
    });
  } catch (error) {
    console.error('Failed to share card:', error);
    Alert.alert('Error', 'Failed to share card. Please try again.');
  }
}

/**
 * Save card image to device's photo library
 */
export async function saveCardImage(viewRef: any): Promise<void> {
  try {
    // Capture the view as an image
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });

    // On iOS/Android, use the share API to save
    // The user can then choose to save to photos from the share sheet
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Save to Photos',
        UTI: 'public.png',
      });
    } else {
      Alert.alert('Error', 'Cannot save image on this device');
    }
  } catch (error) {
    console.error('Failed to save card:', error);
    Alert.alert('Error', 'Failed to save card. Please try again.');
  }
}

/**
 * Share to Instagram Stories directly
 * Note: This requires Instagram app to be installed
 */
export async function shareToInstagramStory(viewRef: any): Promise<void> {
  try {
    // Capture the view as an image
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });

    // Check if Instagram is installed
    // On iOS, we can use URL schemes: instagram-stories://share
    // On Android, we use sharing with specific package name

    if (Platform.OS === 'ios') {
      // iOS: Use Instagram URL scheme
      // This would require linking to Instagram's SDK or using expo-linking
      // For now, fall back to regular sharing
      await shareCard(viewRef, { title: 'Share to Instagram Story' });
    } else {
      // Android: Share with Instagram package
      await shareCard(viewRef, { title: 'Share to Instagram Story' });
    }
  } catch (error) {
    console.error('Failed to share to Instagram:', error);
    Alert.alert('Error', 'Failed to share to Instagram. Please try again.');
  }
}

/**
 * Get shareable image URI without triggering share dialog
 * Useful for custom share flows
 */
export async function getCardImageUri(viewRef: any): Promise<string> {
  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });
    return uri;
  } catch (error) {
    console.error('Failed to capture card:', error);
    throw error;
  }
}
