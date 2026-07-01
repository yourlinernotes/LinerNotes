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

  if (name === 'pause') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M6 4h4v16H6zM14 4h4v16h-4z" />
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

  // Flame icon - standout tracks (per Claude Design)
  if (name === 'flame') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
        <Path
          d="M12 2c1.7 3.5 3 6 2 9-1 3-4 4.5-4 7 0 1.7 1.3 3 3 3s3-1.3 3-3c0-2.5-3-3.5-2-7 .5-1.5 1.5-3 3-5-1 3 0 5 1 7 1.5 3 1 5-1 7"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // Love icon - loved tracks (per Claude Design, different from "like")
  if (name === 'love') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
        <Path
          d="M20.8 4.6a5.5 5.5 0 00-7.8 0l-1 1-1-1a5.5 5.5 0 00-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 000-7.8z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // Skip icon - skipped tracks (per Claude Design)
  if (name === 'skip') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 4l10 8-10 8V4zM19 5v14"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // Bookmark icon - saved for later (per Claude Design)
  if (name === 'bookmark') {
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

  // Edit icon - pencil
  if (name === 'edit') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return null;
}
