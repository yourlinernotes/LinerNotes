import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AlbumArtProps {
  palette: {
    deep: string;
    mid: string;
    lo: string;
    accent: string;
    glow: string;
  };
  label: string;
  /** Real album artwork. When set, it renders over the gradient fallback. */
  artworkUrl?: string;
  radius?: number;
  /** Explicit square size; when omitted the art fills its parent. */
  size?: number;
  dim?: boolean;
  noTag?: boolean;
  children?: React.ReactNode;
  style?: any;
}

export function AlbumArt({
  palette,
  label,
  artworkUrl,
  radius = 0,
  size,
  dim = false,
  noTag = false,
  children,
  style,
}: AlbumArtProps) {
  return (
    <View
      style={[
        styles.container,
        { borderRadius: radius },
        size != null && { width: size, height: size },
        style,
      ]}
    >
      {/* Gradient fallback (shown while the image loads or when there is no URL) */}
      <LinearGradient
        colors={[palette.mid, palette.deep, palette.lo]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${palette.glow}cc`, 'transparent']}
        start={{ x: 0.8, y: 0.8 }}
        end={{ x: 0.2, y: 0.2 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
      />
      {/* Real album artwork */}
      {artworkUrl ? (
        <Image
          source={{ uri: artworkUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}
      {dim && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(8, 7, 6, 0.2)' },
          ]}
        />
      )}
      {!noTag && (
        <View style={styles.tagContainer}>
          <Text style={styles.tag}>{label}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  tagContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(8, 7, 6, 0.4)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tag: {
    fontFamily: 'Space Mono',
    fontSize: 8,
    letterSpacing: 0.8,
    color: 'rgba(241, 235, 224, 0.7)',
    textTransform: 'uppercase',
  },
});
