import { tokens } from '../lib/tokens';
/**
 * LinerNotes Experience Screen
 * Immersive read-along with album-color background
 * Based on Claude Design handoff: experience.jsx
 */

import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Linking, Alert, Image, Animated, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/atoms/Icon';
import { Stars } from '../components/atoms/Stars';
import { formatTimestamp } from '../lib/time-utils';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api-client';
import type { FeedReview } from '../lib/feed-types';
import { odesli } from '../services/odesli';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ExperienceScreenProps {
  review: FeedReview;
  onClose: () => void;
  onDeleted?: () => void;
}

interface Palette {
  deep: string;
  mid: string;
  lo: string;
  accent: string;
  glow: string;
}

export function ExperienceScreen({ review, onClose, onDeleted }: ExperienceScreenProps) {
  const { user } = useAuth();
  const { album, rating } = review;
  const p: Palette = album.palette;
  const gold = tokens.colors.gold;
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [spotifyOpening, setSpotifyOpening] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAlbum = !!(album.tracks && album.tracks.length > 0);
  const npTrack = album.tracks?.find((t) => t.moments && t.moments.length > 0);

  // Own note → can delete (backend also enforces ownership).
  const isOwn = !!user?.handle && review.user?.handle === user.handle;

  // Swipe down from the top bar to dismiss (finger-tracking + snap).
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 220,
            useNativeDriver: false,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, bounciness: 2, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const confirmDelete = () => {
    Alert.alert(
      'Delete note?',
      'This permanently removes your note. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              await api.deleteReview(review.id);
              (onDeleted ?? onClose)();
            } catch (e: any) {
              setDeleting(false);
              Alert.alert('Could not delete', e?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const openSpotify = async () => {
    setSpotifyOpening(true);

    try {
      // Try to get Spotify link via Odesli
      const artist = album.artist;
      const title = album.title;

      if (!artist || !title) {
        Alert.alert('Error', 'Unable to open in Spotify - missing track info');
        setSpotifyOpening(false);
        return;
      }

      const links = await odesli.resolve(artist, title);

      if (links?.linksByPlatform?.spotify) {
        const spotifyUri = links.linksByPlatform.spotify.nativeAppUriMobile || links.linksByPlatform.spotify.url;

        const canOpen = await Linking.canOpenURL(spotifyUri);
        if (canOpen) {
          await Linking.openURL(spotifyUri);
        } else {
          Alert.alert('Spotify Not Found', 'Please install Spotify to open this track');
        }
      } else {
        Alert.alert('Not Found', 'Could not find this track on Spotify');
      }
    } catch (error) {
      console.error('Failed to open Spotify:', error);
      Alert.alert('Error', 'Failed to open Spotify');
    } finally {
      setTimeout(() => setSpotifyOpening(false), 1900);
    }
  };

  const tapNote = (key: string) => {
    setActiveNote(key);
    setTimeout(() => setActiveNote(null), 2600);
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
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
        <View style={styles.contentContainer}>
          {/* Sharp cover */}
          <TouchableOpacity onPress={openSpotify} style={styles.cover}>
            {album.artworkUrl ? (
              <Image source={{ uri: album.artworkUrl }} style={styles.coverPlaceholder} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverLabel}>{album.title?.toLowerCase()}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title + artist */}
          <Text style={styles.title}>{album.title}</Text>
          <Text style={styles.artist}>
            {album.artist}{album.year ? ` · ${album.year}` : ''}
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

          {/* The caption (first line) reads as an italic pull-quote; the rest
              of the take sits below it in plain, non-italic text. */}
          {review.take && (
            <Text style={styles.quote}>"{review.take.split('\n')[0]}"</Text>
          )}
          {review.take && review.take.split('\n').slice(1).join('\n').trim() ? (
            <Text style={styles.body}>
              {review.take.split('\n').slice(1).join('\n').trim()}
            </Text>
          ) : null}
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
                        <Text style={styles.momentTimeText}>{formatTimestamp(m.sec)}</Text>
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

      {/* Delete — pinned to the very bottom (only for your own note; the
          backend also enforces ownership). */}
      {isOwn && (
        <View style={styles.deleteBar}>
          <TouchableOpacity
            style={[styles.deleteButton, deleting && { opacity: 0.5 }]}
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>{deleting ? 'Deleting…' : 'Delete note'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fixed top bar — swipe down here to dismiss */}
      <View style={styles.topBar} {...panResponder.panHandlers}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="chevdown" size={20} color="#f1ebe0" />
        </TouchableOpacity>
        <Text style={styles.experienceLabel}>the experience</Text>
        <View style={{ width: 38 }} />
      </View>
    </Animated.View>
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
                        <Text style={styles.momentTimeText}>{formatTimestamp(m.sec)}</Text>
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
    paddingTop: 96,
    paddingBottom: 110,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 8,
  },
  deleteBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 34,
  },
  deleteButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(224,118,47,0.5)',
    backgroundColor: 'rgba(224,118,47,0.10)',
  },
  deleteButtonText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
    color: '#e0762f',
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
    fontFamily: 'Menlo',
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
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    textAlign: 'center',
    padding: 12,
  },
  title: {
    marginTop: 18,
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 26,
    lineHeight: 28.6,
    color: '#f1ebe0',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  artist: {
    marginTop: 3,
    fontFamily: 'System',
    fontSize: 18,
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
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
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
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nowPlayingTrack: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#f1ebe0',
  },
  nowPlayingSource: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.5)',
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  quote: {
    marginTop: 24,
    fontFamily: 'System',
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 25.2,
    color: '#f1ebe0',
    textAlign: 'center',
    maxWidth: 320,
  },
  body: {
    marginTop: 18,
    fontFamily: 'System',
    fontSize: 16,
    lineHeight: 25.92,
    color: 'rgba(241,235,224,0.78)',
    maxWidth: 340,
  },
  section: {
    width: '100%',
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  momentInstructions: {
    fontFamily: 'System',
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
    fontFamily: 'Menlo',
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
    letterSpacing: -0.25,
  },
  momentNoteText: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(241,235,224,0.86)',
  },
  readAhead: {
    fontFamily: 'Menlo',
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
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(241,235,224,0.4)',
    width: 20,
  },
  trackStripName: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 14,
    color: '#f1ebe0',
  },
  trackStripMomentCount: {
    fontFamily: 'Menlo',
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
    fontFamily: 'System',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(241,235,224,0.8)',
  },
});
