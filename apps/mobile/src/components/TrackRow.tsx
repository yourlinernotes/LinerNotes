/**
 * TrackRow - Album mode track selection component
 * Based on Claude Design spec: composer.jsx <CmpTrackRow />
 *
 * Features:
 * - Track number + name display
 * - Reaction cycling (null → flame → love → skip → null)
 * - Moment counter badge
 * - Expandable moments/notes section
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '@linernotes/core';
import type { TrackReaction } from '@linernotes/core';

interface TrackRowProps {
  trackNumber: number;
  trackName: string;
  reaction: TrackReaction | null;
  momentCount: number;
  onReactionChange: (reaction: TrackReaction | null) => void;
  onMomentsPress?: () => void;
}

export function TrackRow({
  trackNumber,
  trackName,
  reaction,
  momentCount,
  onReactionChange,
  onMomentsPress,
}: TrackRowProps) {
  const cycleReaction = () => {
    // Cycle: null → flame → love → skip → null
    const cycle: Array<TrackReaction | null> = [null, 'flame', 'love', 'skip'];
    const currentIndex = cycle.indexOf(reaction);
    const nextIndex = (currentIndex + 1) % cycle.length;
    onReactionChange(cycle[nextIndex]);
  };

  return (
    <View style={styles.container}>
      {/* Track number */}
      <Text style={styles.trackNumber}>
        {String(trackNumber).padStart(2, '0')}
      </Text>

      {/* Track name */}
      <Text style={styles.trackName} numberOfLines={1}>
        {trackName}
      </Text>

      {/* Moment counter badge (if any moments exist) */}
      {momentCount > 0 && (
        <TouchableOpacity
          onPress={onMomentsPress}
          style={styles.momentBadge}
          activeOpacity={0.7}
        >
          <Text style={styles.momentIcon}>📌</Text>
          <Text style={styles.momentCount}>{momentCount}</Text>
        </TouchableOpacity>
      )}

      {/* Reaction cycle button */}
      <TouchableOpacity
        onPress={cycleReaction}
        style={[
          styles.reactionButton,
          reaction ? styles.reactionButtonActive : styles.reactionButtonEmpty,
        ]}
        activeOpacity={0.7}
      >
        {reaction === 'flame' && <Text style={styles.reactionIcon}>🔥</Text>}
        {reaction === 'love' && <Text style={styles.reactionIcon}>❤️</Text>}
        {reaction === 'skip' && <Text style={styles.reactionIcon}>⏭</Text>}
        {!reaction && (
          <View style={styles.emptyCircle} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.layout.spacing.sm,
    paddingHorizontal: tokens.layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 241, 232, 0.08)',
    gap: tokens.layout.spacing.sm,
  },
  trackNumber: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 11,
    color: 'rgba(245, 241, 232, 0.4)',
    width: 24,
    letterSpacing: 0.02,
  },
  trackName: {
    flex: 1,
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 14,
    color: tokens.colors.cream,
    letterSpacing: -0.01,
  },
  momentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: `${tokens.colors.gold}16`,
  },
  momentIcon: {
    fontSize: 10,
  },
  momentCount: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10,
    color: tokens.colors.gold,
    letterSpacing: 0.02,
  },
  reactionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(245, 241, 232, 0.06)',
  },
  reactionButtonEmpty: {
    backgroundColor: 'transparent',
  },
  reactionIcon: {
    fontSize: 16,
  },
  emptyCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(245, 241, 232, 0.2)',
  },
});
