/**
 * Prompt Shelf - Horizontal scrollable "worth a note" shelf
 * Appears at top of feed with asking engine prompts
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { PromptCard } from './PromptCard';
import { tokens } from '../lib/tokens';
import type { PromptTrigger } from '../services/askingEngine';

interface PromptShelfProps {
  prompts: PromptTrigger[];
  accent?: string;
  onOpenComposer: (prompt: PromptTrigger) => void;
  onDismiss: (promptId: string) => void;
}

export function PromptShelf({ prompts, accent, onOpenComposer, onDismiss }: PromptShelfProps) {
  const gold = accent || tokens.colors.gold;

  if (prompts.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.label, { color: gold }]}>WORTH A NOTE</Text>
        <Text style={styles.subtitle}>From what you've been playing</Text>
      </View>

      {/* Horizontal scroll of available prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            accent={gold}
            onOpen={() => onOpenComposer(prompt)}
            onDismiss={() => onDismiss(prompt.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  label: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  subtitle: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.4)',
    letterSpacing: 0.3,
  },
  scroll: {
    marginHorizontal: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
});
