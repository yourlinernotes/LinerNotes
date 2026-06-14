import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AvatarProps {
  user: {
    name: string;
    tint: string;
  };
  size?: number;
}

export function Avatar({ user, size = 30 }: AvatarProps) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: `${user.tint}1f`,
          borderColor: `${user.tint}55`,
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          {
            fontSize: size * 0.42,
            color: user.tint,
          },
        ]}
      >
        {user.name[0]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initial: {
    fontFamily: 'Hanken Grotesk',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
