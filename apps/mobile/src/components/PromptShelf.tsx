/**
 * Prompt Shelf - Horizontal scrollable "worth a note" shelf
 * Appears at top of feed with asking engine prompts
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { PromptCard } from './PromptCard';
import { tokens } from '../lib/tokens';
import type { PromptTrigger } from '../services/askingEngine';

interface PromptShelfProps {
  prompts: PromptTrigger[];
  accent?: string;
  onOpenComposer: (prompt: PromptTrigger, rating?: number) => void;
  onDismiss: (promptId: string) => void;
  /** "+" generates more prompts from Last.fm stats (hidden when undefined). */
  onGenerateMore?: () => void;
  generatingMore?: boolean;
}

export function PromptShelf({
  prompts,
  accent,
  onOpenComposer,
  onDismiss,
  onGenerateMore,
  generatingMore,
}: PromptShelfProps) {
  const gold = accent || tokens.colors.gold;

  // Nothing to show and no way to generate → render nothing.
  if (prompts.length === 0 && !onGenerateMore) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.label, { color: gold }]}>WORTH A NOTE</Text>
          <Text style={styles.subtitle}>From what you've been playing</Text>
        </View>
        {onGenerateMore && (
          <TouchableOpacity
            onPress={onGenerateMore}
            disabled={generatingMore}
            style={[styles.moreButton, { borderColor: `${gold}66`, backgroundColor: `${gold}14` }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {generatingMore ? (
              <ActivityIndicator size="small" color={gold} />
            ) : (
              <Text style={[styles.moreButtonPlus, { color: gold }]}>+</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal scroll of available prompts */}
      {prompts.length > 0 ? (
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
              onOpen={(rating) => onOpenComposer(prompt, rating)}
              onDismiss={() => onDismiss(prompt.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>Tap + to find something worth a note.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    marginTop: 16, // Prevent overlay with sticky header
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  headerText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  moreButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  moreButtonPlus: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
  empty: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: 12.5,
    color: 'rgba(241,235,224,0.45)',
    paddingHorizontal: 2,
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
