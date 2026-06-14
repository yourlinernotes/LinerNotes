/**
 * LinerNotes Experience Screen
 * Immersive read-along with album-color background
 * Based on Claude Design handoff: experience.jsx
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, Stars } from '../components/atoms/Icon';
import { tokens } from '@linernotes/core';
import { formatTimestamp } from '../lib/time-utils';
import type { Review } from '@linernotes/core';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ExperienceScreenProps {
  review: any; // TODO: Use proper Review type with extended properties
  onClose: () => void;
}

interface Palette {
  deep: string;
  mid: string;
  lo: string;
  accent: string;
  glow: string;
}

export function ExperienceScreen({ review, onClose }: ExperienceScreenProps) {
  const { track, album, rating } = review;
  const p: Palette = album?.palette || track?.palette || {
    deep: '#23160a',
    mid: '#7a4a16',
    lo: '#3a1d0a',
    accent: '#d9b25a',
    glow: '#c97a1f',
  };
  const gold = p.accent;
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [spotifyOpening, setSpotifyOpening] = useState(false);

  const isAlbum = !!(album.tracks && album.tracks.length > 0);
  const npTrack = album.tracks?.find((t) => t.moments && t.moments.length > 0);

  const openSpotify = () => {
    setSpotifyOpening(true);
    setTimeout(() => setSpotifyOpening(false), 1900);
  };

  const tapNote = (key: string) => {
    setActiveNote(key);
    setTimeout(() => setActiveNote(null), 2600);
  };

  return (
    <View style={styles.container}>
      {/* Immersive blurred flood */}
      <View style={styles.blurContainer}>
        <LinearGradient
          colors={[p.mid, p.deep, p.lo]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.3, y: 0.22 }}
          end={{ x: 0.7, y: 0.78 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`${p.glow}cc`, 'transparent']}
          start={{ x: 0.8, y: 0.8 }}
          end={{ x: 0.2, y: 0.2 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
        />
        <LinearGradient
          colors={[`${p.accent}55`, 'transparent']}
          start={{ x: 0.12, y: 0.9 }}
          end={{ x: 0.5, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
        />
      </View>

      {/* Dark overlay */}
      <LinearGradient
        colors={['rgba(8,7,6,0.35)', 'rgba(8,7,6,0.15)', 'rgba(8,7,6,0.78)']}
        locations={[0, 0.32, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="chevdown" size={20} color="#f1ebe0" />
          </TouchableOpacity>
          <Text style={styles.experienceLabel}>the experience</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.contentContainer}>
          {/* Sharp cover */}
          <TouchableOpacity onPress={openSpotify} style={styles.cover}>
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverLabel}>{(album?.title || track?.name)?.toLowerCase()}</Text>
            </View>
          </TouchableOpacity>

          {/* Title + artist */}
          <Text style={styles.title}>{album.title}</Text>
          <Text style={styles.artist}>
            {album.artist} · {album.year}
          </Text>

          {/* Rating */}
          <View style={styles.rating}>
            <Stars rating={rating} size={16} color={gold} />
          </View>

          {/* Open in Spotify */}
          <TouchableOpacity onPress={openSpotify} style={styles.spotifyButton}>
            <View style={styles.spotifyIcon}>
              <Icon name="play" size={8} color="#fff" />
            </View>
            <Text style={styles.spotifyText}>Open in Spotify</Text>
          </TouchableOpacity>

          {/* Now playing companion (if applicable) */}
          {npTrack && (
            <View style={[styles.nowPlaying, { backgroundColor: `${gold}12`, borderColor: `${gold}3a` }]}>
              <View style={styles.equalizer}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.eqBar, { backgroundColor: gold }]} />
                ))}
              </View>
              <View style={styles.nowPlayingInfo}>
                <Text style={[styles.nowPlayingLabel, { color: gold }]}>following along</Text>
                <Text style={styles.nowPlayingTrack} numberOfLines={1}>
                  {npTrack.name}
                </Text>
              </View>
              <Text style={styles.nowPlayingSource}>via{'\n'}last.fm</Text>
            </View>
          )}

          {/* The line + full review body */}
          {review.take && (
            <Text style={styles.quote}>"{review.take}"</Text>
          )}
          {review.body && (
            <Text style={styles.body}>{review.body}</Text>
          )}

          {/* Single-track moments */}
          {!isAlbum && review.notes && review.notes.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: gold }]}>
                the moment{review.notes.length > 1 ? 's' : ''}
              </Text>
              <Text style={styles.momentInstructions}>
                tap to read ahead — it follows the song, it won't skip it.
              </Text>
              <View style={styles.moments}>
                {review.notes.map((m, idx) => {
                  const key = `solo-${idx}`;
                  const isActive = activeNote === key;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => tapNote(key)}
                      style={[
                        styles.momentButton,
                        {
                          borderColor: isActive ? `${gold}99` : 'rgba(241,235,224,0.1)',
                          backgroundColor: isActive ? `${gold}14` : 'rgba(241,235,224,0.04)',
                        },
                      ]}
                    >
                      <View style={[styles.momentTimeBox, { backgroundColor: gold }]}>
                        <Text style={styles.momentTimeText}>{formatTimestamp(m.seconds)}</Text>
                      </View>
                      <Text style={styles.momentNoteText} numberOfLines={2}>
                        {m.note}
                      </Text>
                      {isActive && (
                        <Text style={[styles.readAhead, { color: gold }]}>read{'\n'}ahead</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Album: expandable track strip */}
          {isAlbum && album.tracks && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: gold }]}>tracks</Text>
              <AlbumTrackStrip tracks={album.tracks} gold={gold} onTapMoment={tapNote} activeNote={activeNote} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function AlbumTrackStrip({
  tracks,
  gold,
  onTapMoment,
  activeNote,
}: {
  tracks: any[];
  gold: string;
  onTapMoment: (key: string) => void;
  activeNote: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (n: number) => setExpanded((e) => ({ ...e, [n]: !e[n] }));

  return (
    <View style={styles.trackStrip}>
      {tracks.map((t) => {
        const hasMoments = t.moments && t.moments.length > 0;
        const isExpanded = expanded[t.n];

        return (
          <View key={t.n}>
            <TouchableOpacity
              onPress={() => toggle(t.n)}
              style={styles.trackStripRow}
              disabled={!hasMoments}
            >
              <Text style={styles.trackStripNum}>{String(t.n).padStart(2, '0')}</Text>
              <Text style={styles.trackStripName} numberOfLines={1}>
                {t.name}
              </Text>
              {hasMoments && (
                <Text style={[styles.trackStripMomentCount, { color: gold }]}>
                  {t.moments.length}
                </Text>
              )}
            </TouchableOpacity>

            {isExpanded && hasMoments && (
              <View style={styles.trackMoments}>
                {t.moments.map((m: any, idx: number) => {
                  const key = `track-${t.n}-${idx}`;
                  const isActive = activeNote === key;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => onTapMoment(key)}
                      style={[
                        styles.trackMomentRow,
                        {
                          borderColor: isActive ? `${gold}99` : 'rgba(241,235,224,0.08)',
                          backgroundColor: isActive ? `${gold}0f` : 'rgba(241,235,224,0.02)',
                        },
                      ]}
                    >
                      <View style={[styles.momentTimeBox, { backgroundColor: gold }]}>
                        <Text style={styles.momentTimeText}>{formatTimestamp(m.seconds)}</Text>
                      </View>
                      <Text style={styles.trackMomentText} numberOfLines={2}>
                        {m.note}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  blurContainer: {
    position: 'absolute',
    top: -80,
    left: -80,
    right: -80,
    bottom: -80,
    transform: [{ scale: 1.1 }],
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 8,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  experienceLabel: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: 'rgba(241,235,224,0.65)',
  },
  contentContainer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    alignItems: 'center',
  },
  cover: {
    width: 168,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.85,
    shadowRadius: 40,
    elevation: 20,
  },
  coverPlaceholder: {
    width: 168,
    height: 168,
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLabel: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    textAlign: 'center',
    padding: 12,
  },
  title: {
    marginTop: 18,
    fontFamily: tokens.typography.fonts.display,
    fontWeight: tokens.typography.weights.semibold,
    fontSize: tokens.typography.sizes.experienceTitle,
    lineHeight: tokens.typography.sizes.experienceTitle * 1.1,
    color: '#f1ebe0',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  artist: {
    marginTop: 3,
    fontFamily: tokens.typography.fonts.body,
    fontSize: tokens.typography.sizes.experienceArtist,
    color: 'rgba(241,235,224,0.72)',
  },
  rating: {
    marginTop: 11,
  },
  spotifyButton: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.18)',
    backgroundColor: 'rgba(241,235,224,0.06)',
  },
  spotifyIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1db954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyText: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: 13,
    fontWeight: tokens.typography.weights.semibold,
    color: '#f1ebe0',
  },
  nowPlaying: {
    width: '100%',
    marginTop: 22,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 16,
  },
  eqBar: {
    width: 3,
    borderRadius: 2,
    height: '60%',
  },
  nowPlayingInfo: {
    flex: 1,
    gap: 2,
  },
  nowPlayingLabel: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nowPlayingTrack: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: 14,
    color: '#f1ebe0',
  },
  nowPlayingSource: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.5)',
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  quote: {
    marginTop: 24,
    fontFamily: tokens.typography.fonts.preview,
    fontStyle: 'italic',
    fontSize: tokens.typography.sizes.experienceQuote,
    lineHeight: tokens.typography.sizes.experienceQuote * 1.4,
    color: '#f1ebe0',
    textAlign: 'center',
    maxWidth: 320,
  },
  body: {
    marginTop: 18,
    fontFamily: tokens.typography.fonts.body,
    fontSize: tokens.typography.sizes.experienceBody,
    lineHeight: tokens.typography.sizes.experienceBody * 1.62,
    color: 'rgba(241,235,224,0.78)',
    maxWidth: 340,
  },
  section: {
    width: '100%',
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: tokens.typography.weights.semibold,
  },
  momentInstructions: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: 11.5,
    color: 'rgba(241,235,224,0.5)',
    marginTop: 9,
    marginBottom: 12,
    lineHeight: 16,
  },
  moments: {
    gap: 8,
  },
  momentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  momentTimeBox: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  momentTimeText: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 12.5,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.bg,
    letterSpacing: -0.25,
  },
  momentNoteText: {
    flex: 1,
    fontFamily: tokens.typography.fonts.body,
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(241,235,224,0.86)',
  },
  readAhead: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  trackStrip: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.1)',
    backgroundColor: 'rgba(241,235,224,0.03)',
    overflow: 'hidden',
  },
  trackStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.06)',
  },
  trackStripNum: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 11,
    color: 'rgba(241,235,224,0.4)',
    width: 20,
  },
  trackStripName: {
    flex: 1,
    fontFamily: tokens.typography.fonts.body,
    fontSize: 14,
    color: '#f1ebe0',
  },
  trackStripMomentCount: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10.5,
  },
  trackMoments: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 10,
    gap: 8,
  },
  trackMomentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  trackMomentText: {
    flex: 1,
    fontFamily: tokens.typography.fonts.body,
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(241,235,224,0.8)',
  },
});
