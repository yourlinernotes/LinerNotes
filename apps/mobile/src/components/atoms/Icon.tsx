/**
 * LinerNotes Icon Components
 * Based on Claude Design handoff: atoms.jsx
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

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
