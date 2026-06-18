import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { tokens } from '../../lib/tokens';

interface StarsProps {
  rating: number;
  size?: number;
  color?: string;
  showNum?: boolean;
}

export function Stars({ rating, size = 13, color = tokens.colors.gold, showNum = true }: StarsProps) {
  const stars = [];

  for (let i = 0; i < 5; i++) {
    const fill = rating >= i + 1 ? 1 : rating >= i + 0.5 ? 0.5 : 0;

    if (fill === 0.5) {
      // For half stars, use View with clipPath simulation via nested views
      stars.push(
        <View key={i} style={{ width: size, height: size, marginRight: 2, position: 'relative' }}>
          {/* Filled half */}
          <View style={{ position: 'absolute', width: size / 2, height: size, overflow: 'hidden' }}>
            <Svg width={size} height={size} viewBox="0 0 20 20">
              <Path
                d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12l-2.8-2.03c-.79-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z"
                fill={color}
              />
            </Svg>
          </View>
          {/* Empty half */}
          <View style={{ position: 'absolute', left: size / 2, width: size / 2, height: size, overflow: 'hidden' }}>
            <Svg width={size} height={size} viewBox="0 0 20 20" style={{ marginLeft: -size / 2 }}>
              <Path
                d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12l-2.8-2.03c-.79-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z"
                fill="none"
                stroke={color}
                strokeWidth={1.3}
                strokeOpacity={0.45}
              />
            </Svg>
          </View>
        </View>
      );
    } else {
      stars.push(
        <Svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{ marginRight: 2 }}>
          <Path
            d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12l-2.8-2.03c-.79-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z"
            fill={fill === 1 ? color : 'none'}
            stroke={color}
            strokeWidth={fill === 0 ? 1.3 : 0}
            strokeOpacity={fill === 0 ? 0.45 : 1}
          />
        </Svg>
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.stars}>{stars}</View>
      {showNum && (
        <Text style={[styles.number, { fontSize: size - 1, color }]}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  number: {
    fontFamily: 'Space Mono',
    letterSpacing: -0.4,
    marginLeft: 4,
  },
});
