import React, { useRef } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { ReviewCard } from '../components/ReviewCard';
import { shareToInstagramStory, saveCardImage } from '../utils/shareCard';
import type { Review } from '../lib/types';

import { tokens } from '../lib/tokens';
/**
 * Export screen with share functionality
 * Demonstrates Instagram story export
 */
export function ReviewExport() {
  const cardRef = useRef(null);

  // Mock data matching the Turmeric design
  const mockReview: Review = {
    id: '1',
    userId: 'user-1',
    track: {
      id: 'track-turmeric',
      name: 'TURMERIC',
      artist: 'Jai Paul',
      album: 'Leak 04-13 (Bait Ones)',
      artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273e0f6c4f3b7b2b1b6b6b6b6b6',
      previewUrl: undefined,
    },
    rating: 4.5,
    take: 'make some noise for the desi boys!!! holy peak, i wish i could listen to this for the first time again. this whole album is perfect',
    notes: [
      {
        seconds: 134,
        label: 'best bit',
        note: 'when the beat drops and everything just clicks',
      },
    ],
    featuredNoteIdx: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleShareToInstagram = async () => {
    if (cardRef.current) {
      await shareToInstagramStory(cardRef.current);
    }
  };

  const handleSaveCard = async () => {
    if (cardRef.current) {
      await saveCardImage(cardRef.current);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Card preview */}
        <View ref={cardRef} collapsable={false}>
          <ReviewCard review={mockReview} userHandle="anushaisawesome" />
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleShareToInstagram}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Share to Instagram Story</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleSaveCard}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Save Image
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  actions: {
    marginTop: 24,
    paddingHorizontal: 24,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: tokens.layout.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 280,
  },
  primaryButton: {
    backgroundColor: tokens.colors.gold,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.colors.fg,
  },
  buttonText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  secondaryButtonText: {
    color: tokens.colors.fg,
  },
});
