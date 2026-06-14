import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/**
 * Capture and share a review card to Instagram Stories
 *
 * @param cardRef - React ref to the ReviewCard component
 * @param options - Optional sharing configuration
 */
export async function shareToInstagramStory(
  cardRef: any,
  options?: {
    backgroundColor?: string;
    stickerAsset?: string;
  }
) {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing not available', 'Sharing is not available on this device');
      return;
    }

    // Capture the card as an image
    const uri = await captureRef(cardRef, {
      format: 'png',
      quality: 1,
      // Instagram story dimensions: 1080x1920
      width: 1080,
      height: 1920,
    });

    // Share to Instagram Stories
    // Note: For actual Instagram Stories integration, you'd use:
    // - react-native-instagram-stories or similar
    // - Instagram sharing API with proper URL scheme
    // For now, using generic share
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share to Instagram Story',
    });

  } catch (error) {
    console.error('Error sharing to Instagram:', error);
    Alert.alert('Share failed', 'Could not share to Instagram. Please try again.');
  }
}

/**
 * Save card as image to device
 */
export async function saveCardImage(cardRef: any) {
  try {
    const uri = await captureRef(cardRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
    });

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Save Review Card',
    });

  } catch (error) {
    console.error('Error saving card:', error);
    Alert.alert('Save failed', 'Could not save card. Please try again.');
  }
}
