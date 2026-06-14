/**
 * LinerNotes Icon Components
 * Based on Claude Design handoff: atoms.jsx
 */

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
}

export function Icon({ name, size = 22, color = 'currentColor', filled = false }: IconProps) {
  const strokeWidth = 1.7;

  if (name === 'repost') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 9V8a3 3 0 013-3h9m1 10v1a3 3 0 01-3 3H8"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M14 2l3 3-3 3M10 22l-3-3 3-3"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'save') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
        <Path
          d="M6 4h12v17l-6-4-6 4V4z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'like') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
        <Path
          d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0112 7.6 3.8 3.8 0 0119 10.8C19 15.7 12 20 12 20z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'close') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'chevdown') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 9l6 6 6-6"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'play') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M7 5l12 7-12 7V5z" />
      </Svg>
    );
  }

  if (name === 'share') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 16V4M12 4l-4 4M12 4l4 4M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return null;
}

interface ReactionProps {
  kind: 'flame' | 'love' | 'skip';
  size?: number;
}

export function Reaction({ kind, size = 16 }: ReactionProps) {
  const colors = {
    flame: '#e0762f',
    love: '#d98aa0',
    skip: '#7a7468',
  };

  const color = colors[kind];

  if (kind === 'flame') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3c.5 3-1.8 4.2-2.8 5.8C8 10.6 8 12.5 8 13a4 4 0 008 0c0-1.6-.8-3.2-1.6-4 .3 1.2-.4 2-1 2 .6-1.7-.4-3.4-1.4-4.5C11 5.4 12 4.2 12 3z"
          fill={color}
        />
      </Svg>
    );
  }

  if (kind === 'love') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0112 7.6 3.8 3.8 0 0119 10.8C19 15.7 12 20 12 20z"
          fill={color}
        />
      </Svg>
    );
  }

  // skip
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6l7 6-7 6V6zM14 6l5 6-5 6V6z" fill={color} fillOpacity="0.85" />
    </Svg>
  );
}

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
    const gid = `ln-star-${size}-${i}-${Math.round(rating * 10)}`;

    stars.push(
      <Svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{ marginRight: 2 }}>
        {fill === 0.5 && (
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0.5" stopColor={color} />
              <Stop offset="0.5" stopColor="transparent" />
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

  return <>{stars}</>;
}

interface AvatarProps {
  name: string;
  tint: string;
  size?: number;
}

export function Avatar({ name, tint, size = 30 }: AvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${tint}1f`,
        borderWidth: 1,
        borderColor: `${tint}55`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: tint,
          fontFamily: 'System',
          fontWeight: '600',
          fontSize: size * 0.42,
          letterSpacing: 0.01,
        }}
      >
        {name[0]}
      </Text>
    </View>
  );
}
