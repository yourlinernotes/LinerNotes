/**
 * Profile Share Card - Shareable profile identity card
 * Based on Claude Design: LNProfileCard
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { tokens } from '../lib/tokens';

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

interface ProfileShareCardProps {
  userName: string;
  userHandle: string;
  bio?: string;
  favourites: AlbumEntry[];
  tintColor?: string;
  linkSlot?: boolean; // Show link sticker slot for story formats
}

export function ProfileShareCard({
  userName,
  userHandle,
  bio,
  favourites,
  tintColor,
  linkSlot = false,
}: ProfileShareCardProps) {
  const userTint = tintColor || tokens.colors.gold;
  const favs = favourites.slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Tint gradient */}
      <View
        style={[
          styles.tint,
          { backgroundColor: `${userTint}26` },
        ]}
      />

      <View style={styles.content}>
        {/* Identity */}
        <View style={styles.identity}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: `${userTint}22`,
                borderColor: `${userTint}66`,
                borderWidth: 1.5,
              },
            ]}
          >
            <Text style={[styles.avatarText, { color: userTint }]}>
              {userName[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.displayName} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={styles.handle}>@{userHandle}</Text>
          </View>
        </View>

        {/* Bio */}
        {bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {bio}
          </Text>
        )}

        {/* A glimpse of taste */}
        {favs.length > 0 && (
          <View style={styles.favouritesSection}>
            <Text style={[styles.favouritesLabel, { color: userTint }]}>
              A FEW FAVOURITES
            </Text>
            <View style={styles.favouritesGrid}>
              {favs.map((entry) => (
                <View key={entry.album.id} style={styles.favouriteItem}>
                  <Image
                    source={{ uri: entry.album.artworkUrl }}
                    style={styles.favouriteArt}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Link sticker slot - only for story formats */}
        {linkSlot && (
          <View style={[styles.linkSlot, { borderColor: `${userTint}66`, backgroundColor: `${userTint}0A` }]}>
            <Text style={[styles.linkSlotTitle, { color: userTint }]}>
              See my profile on LinerNotes
            </Text>
            <Text style={[styles.linkSlotHint, { color: `${userTint}99` }]}>
              Drop your link sticker here, it's already copied
            </Text>
          </View>
        )}

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
    height: '44%',
    pointerEvents: 'none',
  },
  content: {
    padding: 18,
    paddingHorizontal: 17,
    paddingBottom: 15,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'System',
    fontSize: 22,
    fontWeight: '600',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  displayName: {
    fontFamily: 'System',
    fontSize: 19,
    fontWeight: '600',
    color: tokens.colors.fg,
    letterSpacing: -0.19,
    lineHeight: 22.42,
  },
  handle: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: tokens.colors.fg + '8C',
  },
  bio: {
    marginTop: 12,
    fontFamily: 'System',
    fontSize: 12.5,
    lineHeight: 18.125,
    color: tokens.colors.fg + 'BD',
  },
  favouritesSection: {
    marginTop: 16,
  },
  favouritesLabel: {
    fontFamily: 'Menlo',
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  favouritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 7,
    marginTop: 8,
  },
  favouriteItem: {
    width: '48%',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  favouriteArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  linkSlot: {
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  linkSlotTitle: {
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  linkSlotHint: {
    fontFamily: 'Menlo',
    fontSize: 9,
    letterSpacing: 0.3,
    textAlign: 'center',
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
