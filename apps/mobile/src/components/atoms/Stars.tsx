import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface StarsProps {
  rating: number;
  size?: number;
  color?: string;
  showNum?: boolean;
}

export function Stars({ rating, size = 13, color = '#d9b25a', showNum = true }: StarsProps) {
  const stars = [];

  for (let i = 0; i < 5; i++) {
    const fill = rating >= i + 1 ? 1 : rating >= i + 0.5 ? 0.5 : 0;
    const gid = `star-${i}-${Math.round(rating * 10)}`;

    stars.push(
      <Svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{ marginRight: 2 }}>
        {fill === 0.5 && (
          <Defs>
            <LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="50%" stopColor={color} />
              <Stop offset="50%" stopColor="transparent" />
            </LinearGradient>
          </Defs>
        )}
        <Path
          d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12l-2.8-2.03c-.79-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z"
          fill={fill === 1 ? color : fill === 0.5 ? `url(#${gid})` : 'none'}
          stroke={color}
          strokeWidth={fill === 0 ? 1.3 : 0}
          strokeOpacity={fill === 0 ? 0.45 : 1}
        />
      </Svg>
    );
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
