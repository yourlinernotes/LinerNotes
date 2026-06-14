import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '@linernotes/core';

export function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile Screen</Text>
      <Text style={styles.subtext}>(coming soon)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
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
