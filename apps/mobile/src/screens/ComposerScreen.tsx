import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CloseIcon } from '../components/atoms';
import { tokens } from '@linernotes/core';

interface ComposerScreenProps {
  onClose: () => void;
}

export function ComposerScreen({ onClose }: ComposerScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <CloseIcon size={20} color={tokens.colors.fg} />
        </TouchableOpacity>
        <Text style={styles.headerText}>new review</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.text}>Composer Screen</Text>
        <Text style={styles.subtext}>(coming soon)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: `rgba(${tokens.colors.fgRgb}, 0.1)`,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: `rgba(${tokens.colors.fgRgb}, 0.14)`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontFamily: tokens.typography.fonts.display,
    fontSize: 18,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.fg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontFamily: tokens.typography.fonts.display,
    fontSize: 24,
    color: tokens.colors.fg,
  },
  subtext: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 12,
    color: tokens.colors.muted,
  },
});
