import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ReactionProps {
  size?: number;
}

export function FlameReaction({ size = 16 }: ReactionProps) {
  const color = '#e0762f';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c.5 3-1.8 4.2-2.8 5.8C8 10.6 8 12.5 8 13a4 4 0 008 0c0-1.6-.8-3.2-1.6-4 .3 1.2-.4 2-1 2 .6-1.7-.4-3.4-1.4-4.5C11 5.4 12 4.2 12 3z"
        fill={color}
      />
    </Svg>
  );
}

export function LoveReaction({ size = 16 }: ReactionProps) {
  const color = '#d98aa0';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0112 7.6 3.8 3.8 0 0119 10.8C19 15.7 12 20 12 20z" fill={color} />
    </Svg>
  );
}

export function SkipReaction({ size = 16 }: ReactionProps) {
  const color = '#7a7468';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6l7 6-7 6V6zM14 6l5 6-5 6V6z" fill={color} fillOpacity="0.85" />
    </Svg>
  );
}

export function ReactionIcon({ kind, size = 16 }: { kind: 'flame' | 'love' | 'skip'; size?: number }) {
  switch (kind) {
    case 'flame':
      return <FlameReaction size={size} />;
    case 'love':
      return <LoveReaction size={size} />;
    case 'skip':
      return <SkipReaction size={size} />;
  }
}
