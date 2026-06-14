import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { ReviewCard } from '../components/ReviewCard';
import type { Review } from '@linernotes/core';

/**
 * Preview screen to demonstrate the ReviewCard component
 * Based on the Turmeric design example
 */
export function ReviewPreview() {
  // Mock data matching the Turmeric design
  const mockReview: Review = {
    id: '1',
    userId: 'user-1',
    track: {
      id: 'track-turmeric',
      name: 'TURMERIC',
      artist: 'Jai Paul',
      album: 'Leak 04-13 (Bait Ones)',
      artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273e0f6c4f3b7b2b1b6b6b6b6b6', // Replace with actual
      previewUrl: undefined,
    },
    rating: 4.5,
    take: 'make some noise for the desi boys!!! holy peak, i wish i could listen to this for the first time again. this whole album is perfect',
    notes: [
      {
        seconds: 134, // 2:14
        label: 'best bit',
        note: 'when the beat drops and everything just clicks',
      },
    ],
    featuredNoteIdx: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ReviewCard review={mockReview} userHandle="anushaisawesome" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});
