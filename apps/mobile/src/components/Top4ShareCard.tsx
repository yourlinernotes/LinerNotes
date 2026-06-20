/**
 * Top 4 Share Card - Shareable sticker for your Top 4 favorites
 * Based on Claude Design: LNTop4Sticker
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { tokens } from '../lib/tokens';
import { Stars } from './atoms';

interface Album {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string;
  palette: {
    accent: string;
    deep: string;
    mid: string;
    lo: string;
    glow: string;
  };
}

interface AlbumEntry {
  album: Album;
  rating: number;
}

interface Top4ShareCardProps {
  userName: string;
  userHandle: string;
  top4: AlbumEntry[];
  accent?: string;
}

export function Top4ShareCard({ userName, userHandle, top4, accent }: Top4ShareCardProps) {
  const gold = accent || tokens.colors.gold;
  const firstAlbumPalette = top4[0]?.album.palette;

  return (
    <View style={styles.container}>
      {/* Subtle accent tint from first album */}
      {firstAlbumPalette && (
        <View
          style={[
            styles.tint,
            { backgroundColor: `${firstAlbumPalette.accent}20` },
          ]}
        />
      )}

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: `${gold}22`, borderColor: `${gold}66` }]}>
            <Text style={[styles.avatarText, { color: gold }]}>
              {userName[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{userName}'s four</Text>
            <Text style={[styles.headerLabel, { color: gold }]}>NON-NEGOTIABLE</Text>
          </View>
        </View>

        {/* 2x2 Grid */}
        <View style={styles.grid}>
          {top4.slice(0, 4).map((entry, index) => (
            <View key={entry.album.id} style={styles.gridItem}>
              {/* Album Art */}
              <View style={styles.artContainer}>
                <Image
                  source={{ uri: entry.album.artworkUrl }}
                  style={styles.art}
                />
                {/* Rating pill */}
                {entry.rating > 0 && (
                  <View style={styles.ratingPill}>
                    <Stars rating={entry.rating} size={8} color={gold} showNum={false} />
                  </View>
                )}
                {/* Position badge */}
                <View style={[styles.positionBadge, { backgroundColor: gold }]}>
                  <Text style={styles.positionText}>{index + 1}</Text>
                </View>
              </View>

              {/* Album info */}
              <View style={styles.albumInfo}>
                <Text style={styles.albumName} numberOfLines={1}>
                  {entry.album.name}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  {entry.album.artist}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made on LinerNotes</Text>
          <Text style={styles.footerText}>@{userHandle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 18,
    backgroundColor: tokens.colors.nearBlack,
    borderWidth: 1,
    borderColor: tokens.colors.fg + '14',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    pointerEvents: 'none',
  },
  content: {
    padding: 17,
    paddingBottom: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.fg,
    lineHeight: 18.4,
  },
  headerLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '48%',
    gap: 6,
  },
  artContainer: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
  },
  ratingPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 7, 6, 0.58)',
    borderWidth: 1,
    borderColor: tokens.colors.fg + '1A',
  },
  positionBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.fg + '1A',
  },
  positionText: {
    fontFamily: 'Menlo',
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.nearBlack,
  },
  albumInfo: {
    paddingLeft: 1,
  },
  albumName: {
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.fg,
    lineHeight: 13.75,
  },
  artistName: {
    fontFamily: 'System',
    fontSize: 10.5,
    color: tokens.colors.muted,
  },
  footer: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.fg + '1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: tokens.colors.fg + '73',
  },
});
