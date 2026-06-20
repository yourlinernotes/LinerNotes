/**
 * Prompt Card - "worth a note" asking engine surface
 * Based on prompts.jsx from Claude Design handoff
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './atoms/Icon';
import { Stars } from './atoms/Stars';
import { AlbumArt } from './atoms/AlbumArt';
import { tokens } from '../lib/tokens';
import type { PromptTrigger } from '../services/askingEngine';

interface PromptCardProps {
  prompt: PromptTrigger;
  accent?: string;
  onOpen: (rating?: number) => void;
  onDismiss: () => void;
}

export function PromptCard({ prompt, accent, onOpen, onDismiss }: PromptCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [rating, setRating] = useState(0);

  if (dismissed) return null;

  const gold = accent || tokens.colors.gold;

  const handleDismiss = (e: any) => {
    e.stopPropagation();
    setDismissed(true);
    onDismiss();
  };

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    onOpen(newRating);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onOpen}
      style={styles.card}
    >
      {/* Gradient tint */}
      <LinearGradient
        colors={[`${prompt.palette.accent}22`, 'transparent']}
        locations={[0, 1]}
        style={styles.gradientTint}
      />

      <View style={styles.content}>
        {/* Art + tag + dismiss */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.artContainer}>
              <AlbumArt
                palette={prompt.palette}
                artworkUrl={prompt.palette.art}
                size={42}
                label={prompt.album || prompt.track || ''}
                noTag
              />
            </View>
            <Text style={[styles.tag, { color: gold }]}>{prompt.tag}</Text>
          </View>

          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={13} color="rgba(241,235,224,0.5)" />
          </TouchableOpacity>
        </View>

        {/* The prompt (the hero) */}
        <Text style={styles.promptText}>{prompt.prompt}</Text>

        {/* Track/album info */}
        <Text style={styles.metadata} numberOfLines={1}>
          {prompt.track || prompt.album} · {prompt.artist}
        </Text>

        {/* Quick-rate + Note button */}
        <View style={styles.actions}>
          <View
            onTouchEnd={(e) => e.stopPropagation()}
            style={styles.starsContainer}
          >
            <Stars
              rating={rating}
              size={19}
              color={gold}
              interactive
              onRatingChange={handleRatingChange}
            />
          </View>

          <TouchableOpacity onPress={onOpen} style={styles.noteButton}>
            <Text style={[styles.noteButtonText, { color: gold }]}>Note</Text>
            <Text style={[styles.arrow, { color: gold }]}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 246,
    flexShrink: 0,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  gradientTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  content: {
    position: 'relative',
    padding: 13,
    gap: 11,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  artContainer: {
    width: 42,
    height: 42,
    borderRadius: 9,
    overflow: 'hidden',
    flexShrink: 0,
  },
  tag: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.4,
    lineHeight: 12,
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(241,235,224,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promptText: {
    fontFamily: tokens.typography.fonts.body,
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 19.8,
    color: tokens.colors.fg,
    flex: 1,
  },
  metadata: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: 12,
    color: tokens.colors.muted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,235,224,0.08)',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  noteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  noteButtonText: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 14,
    lineHeight: 14,
  },
});
