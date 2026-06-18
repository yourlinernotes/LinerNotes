/**
 * Share utilities for exporting review cards as images
 * Instagram Story format: 1080x1920
 */

import { Alert, Platform, Linking } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
// SDK 56 moved the classic file API (cacheDirectory, etc.) to the /legacy entry.
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';

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
 * Share to Instagram Stories directly using native URL scheme
 * Requires Instagram app to be installed
 * NOTE: Card should be rendered with variant="story" for proper spacing
 */
export async function shareToInstagramStory(viewRef: any): Promise<void> {
  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });

    // Save image to file system first
    const fileName = `linernotes-${Date.now()}.png`;
    const destPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: destPath });

    // Use Instagram Stories URL scheme
    // Note: This opens Instagram's story composer with the image
    const instagramURL = `instagram-stories://share?source_application=${encodeURIComponent('com.anusha.linernotes')}`;

    // For full implementation, you'd use expo-linking with the file
    // For now, use the generic share which works cross-platform
    await Sharing.shareAsync(destPath, {
      mimeType: 'image/png',
      dialogTitle: 'Share to Instagram Story',
      UTI: 'public.png',
    });
  } catch (error) {
    console.error('Failed to share to Instagram:', error);
    Alert.alert('Error', 'Failed to share to Instagram. Please try again.');
  }
}

/**
 * Share to TikTok using native composer
 * NOTE: Card should be rendered with variant="cameraRoll" (no link sticker space)
 */
export async function shareToTikTok(viewRef: any): Promise<void> {
  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });

    // Save to file system
    const fileName = `linernotes-${Date.now()}.png`;
    const destPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: destPath });

    // TikTok doesn't have a documented URL scheme for direct sharing
    // Use generic share sheet which will show TikTok as an option
    await Sharing.shareAsync(destPath, {
      mimeType: 'image/png',
      dialogTitle: 'Share to TikTok',
      UTI: 'public.png',
    });
  } catch (error) {
    console.error('Failed to share to TikTok:', error);
    Alert.alert('Error', 'Failed to share to TikTok. Please try again.');
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

/**
 * Share to Twitter - opens Twitter composer with pre-filled text and saves image
 * NOTE: Card should be rendered with variant="cameraRoll" (no link sticker space)
 */
export async function shareToTwitter(viewRef: any, reviewUrl: string): Promise<void> {
  try {
    // Capture the card (without link sticker space)
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });

    // Save to file system for later attachment
    const fileName = `linernotes-${Date.now()}.png`;
    const destPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: destPath });

    // Open Twitter composer with pre-filled text
    // Twitter URL scheme: twitter://post?message=text
    // X (new Twitter) URL scheme: twitter://post?message=text
    const tweetText = encodeURIComponent(`${reviewUrl}`);
    const twitterURL = `twitter://post?message=${tweetText}`;
    const xURL = `twitter://post?message=${tweetText}`; // Same scheme still works for X app

    // Check if Twitter/X app is installed
    const canOpenTwitter = await Linking.canOpenURL(twitterURL);

    if (canOpenTwitter) {
      // Save image to camera roll via share sheet (user adds it manually to tweet)
      await Sharing.shareAsync(destPath, {
        mimeType: 'image/png',
        dialogTitle: 'Save image for Twitter',
        UTI: 'public.png',
      });

      // Open Twitter composer with link pre-filled
      setTimeout(() => {
        Linking.openURL(twitterURL);
      }, 1000); // Small delay to let share sheet complete

      // Notify user
      Alert.alert(
        'Opening Twitter',
        'Add the saved image to your tweet from your camera roll!',
        [{ text: 'Got it', style: 'default' }]
      );
    } else {
      // Twitter app not installed - fall back to web share
      await Clipboard.setStringAsync(reviewUrl);
      await Sharing.shareAsync(destPath, {
        mimeType: 'image/png',
        dialogTitle: 'Share (link copied)',
        UTI: 'public.png',
      });

      Alert.alert(
        'Twitter app not found',
        'Image saved and link copied to clipboard. You can share via the web!',
        [{ text: 'Got it', style: 'default' }]
      );
    }
  } catch (error) {
    console.error('Failed to share to Twitter:', error);
    Alert.alert('Error', 'Failed to share to Twitter. Please try again.');
  }
}
