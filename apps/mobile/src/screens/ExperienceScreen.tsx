import { tokens } from '../lib/tokens';
/**
 * LinerNotes Experience Screen
 * Immersive read-along with album-colour background, in-app playback, and
 * karaoke-style synced lyrics with the author's moment-notes interleaved.
 *
 * Playback engine: SoundCloud (full track) when resolvable, else a 30s iTunes
 * preview (expo-audio). Lyrics: LRCLIB synced .lrc → line highlight, plain →
 * static block. The sync engine (packages/core) is player-agnostic, so the
 * highlight is driven purely by the reported position in ms.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { parseLrc, activeLineIndex, type LyricLine } from '@linernotes/core';
import { Icon } from '../components/atoms/Icon';
import { Stars } from '../components/atoms/Stars';
import { ReactionIcon } from '../components/atoms/Reactions';
import {
  ExperiencePlayer,
  type ExperiencePlayerHandle,
  type PlaybackStatus,
  type PlaybackSource,
} from '../components/player/ExperiencePlayer';
import { formatTimestamp } from '../lib/time-utils';
import { useAuth } from '../contexts/AuthContext';
import { api, API_BASE_URL, type LyricsResult } from '../lib/api-client';
import type { FeedReview } from '../lib/feed-types';
import { lastfm } from '../services/lastfm';
import { lookupTrack } from '../services/itunes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const F = tokens.typography.rnFonts;
const C = tokens.colors;

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
  const gold = C.gold;
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [spotifyOpening, setSpotifyOpening] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<{ name: string; artist: string } | null>(null);

  const isAlbum = !!(album.tracks && album.tracks.length > 0);
  // Album *reviews* are flagged by the adapter (kind === 'album'); use this to
  // route deletes to the album endpoint, never the track one.
  const isAlbumReview = album.kind === 'album';

  // ---- Playback + lyrics (single-track experience only) --------------------
  // For a track review the adapter puts the *track* name/artist in album.title/
  // artist. Album reviews keep the existing track strip (per-track playback is a
  // follow-on).
  const playbackEnabled = !isAlbum;
  const playerRef = useRef<ExperiencePlayerHandle>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [soundcloudId, setSoundcloudId] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(playbackEnabled);
  const [status, setStatus] = useState<PlaybackStatus>({
    positionMs: 0,
    durationMs: 0,
    playing: false,
    source: 'none',
    ready: false,
  });

  const syncedLines: LyricLine[] = useMemo(
    () => (lyrics?.syncedLyrics ? parseLrc(lyrics.syncedLyrics) : []),
    [lyrics?.syncedLyrics],
  );
  const activeIdx = useMemo(
    () => (syncedLines.length ? activeLineIndex(syncedLines, status.positionMs) : -1),
    [syncedLines, status.positionMs],
  );

  // Live moment callout — active for 5s once the playhead reaches a moment.
  const activeMoment = useMemo(() => {
    const notes = review.notes || [];
    return (
      notes.find(
        (n) => status.positionMs >= n.sec * 1000 && status.positionMs < (n.sec + 5) * 1000,
      ) || null
    );
  }, [review.notes, status.positionMs]);

  // Breathing album-colour flood — subtle looping scale so the bg feels alive.
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 5200, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 5200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1.15] });

  // Resolve media (preview + duration), lyrics, and a SoundCloud id on open.
  useEffect(() => {
    if (!playbackEnabled) return;
    let cancelled = false;
    (async () => {
      const track = album.title || '';
      const artist = album.artist || '';
      // 1. iTunes: 30s preview + duration (LRCLIB tiebreaker) + a source URL.
      const it = await lookupTrack(track, artist);
      if (cancelled) return;
      if (it?.previewUrl) setPreviewUrl(it.previewUrl);

      // 2. Lyrics (duration improves the match).
      setLyricsLoading(true);
      const ly = await api.getLyrics({
        track,
        artist,
        durationSec: it?.durationSec ?? undefined,
      });
      if (cancelled) return;
      setLyrics(ly);
      setLyricsLoading(false);

      // 3. SoundCloud full-track (best-effort) — prefer it over the preview.
      const scArgs = it?.itunesUrl
        ? { sourceUrl: it.itunesUrl }
        : album.extId
          ? { id: album.extId, platform: 'itunes' as const }
          : null;
      if (scArgs) {
        const sc = await api.resolveSoundCloud(scArgs);
        if (!cancelled && sc?.trackId) setSoundcloudId(sc.trackId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playbackEnabled, album.title, album.artist, album.extId]);

  // Check Last.fm for currently playing track that matches this album/artist
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkNowPlaying = async () => {
      try {
        const username = await lastfm.getUsername();
        if (!username) return;

        const recentTracks = await lastfm.getRecentTracks(username, 1);
        if (!recentTracks || recentTracks.length === 0) return;

        const track = recentTracks[0];
        const isPlaying = track['@attr']?.nowplaying === 'true';

        if (!isPlaying) {
          setNowPlayingTrack(null);
          return;
        }

        const trackArtist = (track.artist as any)?.name || track.artist;
        const trackAlbum = typeof track.album === 'string' ? track.album : track.album?.['#text'];

        const matchesArtist =
          trackArtist?.toLowerCase().includes(album.artist?.toLowerCase() || '') ||
          album.artist?.toLowerCase().includes(trackArtist?.toLowerCase() || '');
        const matchesAlbum = trackAlbum?.toLowerCase() === album.title?.toLowerCase();

        if (matchesArtist && (matchesAlbum || !isAlbum)) {
          setNowPlayingTrack({ name: track.name, artist: trackArtist });
        } else {
          setNowPlayingTrack(null);
        }
      } catch (error) {
        console.error('[Experience] Failed to check Last.fm now playing:', error);
      }
    };

    checkNowPlaying();
    interval = setInterval(checkNowPlaying, 3000);

    return () => clearInterval(interval);
  }, [album.artist, album.title, isAlbum]);

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
    }),
  ).current;

  const confirmDelete = () => {
    Alert.alert(
      isAlbumReview ? 'Delete album review?' : 'Delete note?',
      isAlbumReview
        ? 'This permanently removes your album review. This can’t be undone.'
        : 'This permanently removes your note. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              if (isAlbumReview) {
                await api.deleteAlbumReview(review.id);
              } else {
                await api.deleteReview(review.id);
              }
              (onDeleted ?? onClose)();
            } catch (e: any) {
              setDeleting(false);
              Alert.alert('Could not delete', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const openSpotify = async () => {
    setSpotifyOpening(true);

    const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(`${album.title} ${album.artist}`.trim())}`;
    try {
      const title = album.title || '';
      const artist = album.artist || '';
      if (!title) {
        Alert.alert('Error', 'Unable to open in Spotify - missing track info');
        return;
      }

      let dest = searchUrl;
      try {
        const params = new URLSearchParams({
          id: album.extId ?? '',
          kind: isAlbumReview ? 'album' : 'track',
          title,
          artist,
        });
        const res = await fetch(`${API_BASE_URL}/spotify-link?${params.toString()}`);
        if (res.ok) {
          const { url } = await res.json();
          if (url) dest = url;
        }
      } catch {
        /* keep search fallback */
      }

      const m = dest.match(/open\.spotify\.com\/(track|album)\/([A-Za-z0-9]+)/);
      if (m) {
        const appUri = `spotify:${m[1]}:${m[2]}`;
        const canOpenApp = await Linking.canOpenURL(appUri).catch(() => false);
        await Linking.openURL(canOpenApp ? appUri : dest);
      } else {
        await Linking.openURL(dest);
      }
    } catch (error) {
      console.error('Failed to open Spotify:', error);
      try {
        await Linking.openURL(
          `https://open.spotify.com/search/${encodeURIComponent(`${album.title} ${album.artist}`)}`,
        );
      } catch {
        Alert.alert('Error', 'Could not open Spotify');
      }
    } finally {
      setTimeout(() => setSpotifyOpening(false), 1200);
    }
  };

  const tapNote = (key: string) => {
    setActiveNote(key);
    setTimeout(() => setActiveNote(null), 2600);
  };

  const seekTo = useCallback((ms: number) => playerRef.current?.seekTo(ms), []);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      {/* Immersive blurred flood — breathes subtly while open */}
      <Animated.View style={[styles.blurContainer, { transform: [{ scale: breatheScale }] }]}>
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
      </Animated.View>

      {/* Dark overlay */}
      <LinearGradient
        colors={['rgba(8,7,6,0.35)', 'rgba(8,7,6,0.15)', 'rgba(8,7,6,0.78)']}
        locations={[0, 0.32, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Hidden audio engine (SoundCloud WebView / expo-audio preview). */}
      {playbackEnabled && (previewUrl || soundcloudId) && (
        <ExperiencePlayer
          ref={playerRef}
          soundcloudTrackId={soundcloudId}
          previewUrl={previewUrl}
          onStatus={setStatus}
          onError={() => setSoundcloudId(null)}
        />
      )}

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
            {album.artist}
            {album.year ? ` · ${album.year}` : ''}
          </Text>

          {/* Rating */}
          <View style={styles.rating}>
            <Stars rating={rating} size={16} color={gold} />
          </View>

          {/* In-app playback bar (track experience) */}
          {playbackEnabled && (previewUrl || soundcloudId) ? (
            <PlaybackBar
              status={status}
              gold={gold}
              notes={review.notes || []}
              activeMoment={activeMoment}
              onToggle={() => playerRef.current?.toggle()}
              onSeek={seekTo}
              onOpenSpotify={openSpotify}
            />
          ) : (
            /* Fallback: deep-link out when we can't play in-app */
            <TouchableOpacity onPress={openSpotify} style={styles.spotifyButton}>
              <View style={styles.spotifyIcon}>
                <Icon name="play" size={8} color="#fff" />
              </View>
              <Text style={styles.spotifyText}>Open in Spotify</Text>
            </TouchableOpacity>
          )}

          {/* Live moment callout — fires when the playhead reaches a moment */}
          {playbackEnabled && (
            <MomentCallout moment={activeMoment} gold={gold} />
          )}

          {/* Now playing companion (Last.fm) */}
          {nowPlayingTrack && (
            <View style={[styles.nowPlaying, { backgroundColor: `${gold}12`, borderColor: `${gold}3a` }]}>
              <View style={styles.equalizer}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.eqBar, { backgroundColor: gold }]} />
                ))}
              </View>
              <View style={styles.nowPlayingInfo}>
                <Text style={[styles.nowPlayingLabel, { color: gold }]}>listening now</Text>
                <Text style={styles.nowPlayingTrack} numberOfLines={1}>
                  {nowPlayingTrack.name}
                </Text>
              </View>
              <Text style={styles.nowPlayingSource}>via{'\n'}last.fm</Text>
            </View>
          )}

          {/* The caption (first line) reads as an italic pull-quote. */}
          {review.take && <Text style={styles.quote}>"{review.take.split('\n')[0]}"</Text>}
          {review.take && review.take.split('\n').slice(1).join('\n').trim() ? (
            <Text style={styles.body}>{review.take.split('\n').slice(1).join('\n').trim()}</Text>
          ) : null}
          {review.body && <Text style={styles.body}>{review.body}</Text>}

          {/* Karaoke lyrics + interleaved moment notes (track experience) */}
          {playbackEnabled && (
            <LyricsPanel
              loading={lyricsLoading}
              lyrics={lyrics}
              lines={syncedLines}
              activeIdx={activeIdx}
              notes={review.notes || []}
              gold={gold}
              onSeekMs={seekTo}
              onTapNoteWithoutAudio={tapNote}
              hasAudio={!!(previewUrl || soundcloudId)}
              activeNote={activeNote}
            />
          )}

          {/* Single-track moments — only when there are no synced lyrics to host
              them (otherwise they render inline with the lyric lines). */}
          {playbackEnabled &&
            !syncedLines.length &&
            review.notes &&
            review.notes.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: gold }]}>
                  the moment{review.notes.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.momentInstructions}>tap a moment to jump there.</Text>
                <View style={styles.moments}>
                  {review.notes.map((m, idx) => {
                    const key = `solo-${idx}`;
                    const isActive = activeNote === key;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => seekTo(m.sec * 1000)}
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

      {/* Delete — pinned to the very bottom (own note only). */}
      {isOwn && (
        <View style={styles.deleteBar}>
          <TouchableOpacity
            style={[styles.deleteButton, deleting && { opacity: 0.5 }]}
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Deleting…' : isAlbumReview ? 'Delete album review' : 'Delete note'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fixed top bar — swipe down here to dismiss */}
      <View style={styles.topBar} {...panResponder.panHandlers}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="chevdown" size={20} color={C.fg} />
        </TouchableOpacity>
        <Text style={styles.experienceLabel}>the experience</Text>
        <View style={{ width: 38 }} />
      </View>
    </Animated.View>
  );
}

// ===========================================================================
// Playback bar — play/pause + scrubber + source badge
// ===========================================================================

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlaybackBar({
  status,
  gold,
  notes,
  activeMoment,
  onToggle,
  onSeek,
  onOpenSpotify,
}: {
  status: PlaybackStatus;
  gold: string;
  notes: MomentNote[];
  activeMoment: MomentNote | null;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onOpenSpotify: () => void;
}) {
  const [barW, setBarW] = useState(0);
  const dur = status.durationMs;
  const pct = dur > 0 ? Math.min(1, status.positionMs / dur) : 0;

  const badge: Record<PlaybackSource, string> = {
    soundcloud: 'soundcloud',
    preview: 'preview · 0:30',
    none: '',
  };

  return (
    <View style={styles.playbackBar}>
      <View style={styles.playbackRow}>
        <TouchableOpacity onPress={onToggle} style={[styles.playBtn, { backgroundColor: gold }]}>
          <Icon name={status.playing ? 'pause' : 'play'} size={13} color={C.nearBlack} />
        </TouchableOpacity>

        <View style={styles.scrubWrap}>
          <TouchableOpacity
            activeOpacity={1}
            onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
            onPress={(e) => {
              if (barW > 0 && dur > 0) {
                const x = e.nativeEvent.locationX;
                onSeek((x / barW) * dur);
              }
            }}
            style={styles.scrubTrack}
          >
            <View style={[styles.scrubFill, { width: `${pct * 100}%`, backgroundColor: gold }]} />
            {/* Moment markers on the timeline */}
            {dur > 0 &&
              notes.map((n, i) => {
                const mPct = Math.min(1, (n.sec * 1000) / dur);
                const on = activeMoment === n;
                return (
                  <View
                    key={i}
                    style={[
                      styles.scrubMarker,
                      {
                        left: `${mPct * 100}%`,
                        width: on ? 12 : 8,
                        height: on ? 12 : 8,
                        backgroundColor: on ? gold : 'rgba(240,226,204,0.55)',
                        shadowColor: gold,
                        shadowOpacity: on ? 0.6 : 0,
                        shadowRadius: 4,
                      },
                    ]}
                  />
                );
              })}
            <View style={[styles.scrubKnob, { left: `${pct * 100}%`, backgroundColor: gold }]} />
          </TouchableOpacity>
          <View style={styles.scrubTimes}>
            <Text style={styles.scrubTime}>{fmt(status.positionMs)}</Text>
            <Text style={styles.scrubTime}>{dur ? fmt(dur) : '--:--'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.playbackMeta}>
        <Text style={[styles.sourceBadge, { color: gold, borderColor: `${gold}44` }]}>
          {badge[status.source] || (status.ready ? '' : 'loading…')}
        </Text>
        <TouchableOpacity onPress={onOpenSpotify}>
          <Text style={styles.openSpotifyLink}>open in spotify ↗</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===========================================================================
// Live moment callout — pulses in when the playhead reaches a moment
// ===========================================================================

type MomentNote = { sec: number; label?: string; note: string };

function MomentCallout({ moment, gold }: { moment: MomentNote | null; gold: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: moment ? 1 : 0,
      useNativeDriver: true,
      bounciness: moment ? 8 : 0,
      speed: 14,
    }).start();
  }, [moment, anim]);

  // Reserve the row height so the layout doesn't jump as callouts come and go.
  return (
    <View style={styles.calloutSlot}>
      {moment && (
        <Animated.View
          style={[
            styles.callout,
            {
              backgroundColor: gold,
              opacity: anim,
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ],
            },
          ]}
        >
          <Text style={styles.calloutTime}>{formatTimestamp(moment.sec)}</Text>
          <View style={styles.calloutDivider} />
          <Text style={styles.calloutText} numberOfLines={1}>
            {moment.label ? `${moment.label} — ` : ''}
            {moment.note}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ===========================================================================
// Lyrics panel — synced karaoke highlight + interleaved moment notes
// ===========================================================================

function LyricsPanel({
  loading,
  lyrics,
  lines,
  activeIdx,
  notes,
  gold,
  onSeekMs,
  hasAudio,
}: {
  loading: boolean;
  lyrics: LyricsResult | null;
  lines: LyricLine[];
  activeIdx: number;
  notes: MomentNote[];
  gold: string;
  onSeekMs: (ms: number) => void;
  onTapNoteWithoutAudio: (key: string) => void;
  hasAudio: boolean;
  activeNote: string | null;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});
  const PANE_H = Math.round(SCREEN_HEIGHT * 0.52);

  // Auto-scroll the active line into the upper third (karaoke feel).
  useEffect(() => {
    if (activeIdx < 0) return;
    const y = offsets.current[activeIdx];
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - PANE_H * 0.36), animated: true });
    }
  }, [activeIdx, PANE_H]);

  // Which moment-note (if any) belongs just before/at a given line time.
  const notesByLine = useMemo(() => {
    const map: Record<number, MomentNote[]> = {};
    if (!lines.length || !notes.length) return map;
    for (const n of notes) {
      const nMs = n.sec * 1000;
      // Attach to the last line at/just before the note's timestamp.
      let idx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].timeMs <= nMs) idx = i;
        else break;
      }
      (map[idx] ||= []).push(n);
    }
    return map;
  }, [lines, notes]);

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: gold }]}>lyrics</Text>
        <Text style={styles.lyricsStatus}>finding the words…</Text>
      </View>
    );
  }

  // Nothing at all.
  if (!lyrics || (lyrics.instrumental && !lyrics.plainLyrics)) {
    if (lyrics?.instrumental) {
      return (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: gold }]}>lyrics</Text>
          <Text style={styles.lyricsStatus}>instrumental — no words to follow.</Text>
        </View>
      );
    }
    return null;
  }

  // Synced → karaoke highlight + interleaved notes.
  if (lines.length) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: gold }]}>lyrics</Text>
        <Text style={styles.momentInstructions}>
          {hasAudio ? 'it follows the song — tap any line to jump there.' : 'tap a line to jump when playing.'}
        </Text>
        <ScrollView
          ref={scrollRef}
          style={[styles.lyricsPane, { maxHeight: PANE_H }]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {lines.map((ln, idx) => {
            const isActive = idx === activeIdx;
            const isPast = idx < activeIdx;
            const lineNotes = notesByLine[idx];
            // Distance-based fade: lines far from the active one recede (depth).
            // Before playback starts (activeIdx < 0), keep everything readable.
            const distance = Math.abs(idx - activeIdx);
            const lineOpacity =
              activeIdx < 0 ? 0.8 : isActive ? 1 : Math.max(0.3, 1 - distance * 0.12);
            return (
              <View
                key={idx}
                style={{ opacity: lineOpacity }}
                onLayout={(e) => {
                  offsets.current[idx] = e.nativeEvent.layout.y;
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => onSeekMs(ln.timeMs)}
                  style={styles.lyricRow}
                >
                  <Text
                    style={[
                      styles.lyricLine,
                      isActive && [styles.lyricLineActive, { color: C.fg }],
                      isPast && styles.lyricLinePast,
                    ]}
                  >
                    {ln.text || '♪'}
                  </Text>
                  {/* Annotation badge — this line carries a moment note */}
                  {lineNotes && !isActive && (
                    <View style={[styles.lyricBadge, { backgroundColor: `${gold}1c`, borderColor: `${gold}44` }]}>
                      <Icon name="bookmark" size={8} color={gold} filled />
                    </View>
                  )}
                </TouchableOpacity>

                {lineNotes?.map((n, j) => (
                  <TouchableOpacity
                    key={j}
                    onPress={() => onSeekMs(n.sec * 1000)}
                    style={[styles.inlineNote, { borderColor: `${gold}55`, backgroundColor: `${gold}10` }]}
                  >
                    <View style={[styles.momentTimeBox, { backgroundColor: gold }]}>
                      <Text style={styles.momentTimeText}>{formatTimestamp(n.sec)}</Text>
                    </View>
                    <Text style={styles.inlineNoteText}>{n.note}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Plain (unsynced) → static block.
  if (lyrics.plainLyrics) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: gold }]}>lyrics</Text>
        <ScrollView style={[styles.lyricsPane, { maxHeight: Math.round(SCREEN_HEIGHT * 0.4) }]} nestedScrollEnabled>
          <Text style={styles.plainLyrics}>{lyrics.plainLyrics}</Text>
        </ScrollView>
      </View>
    );
  }

  return null;
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
        const trackNote: string = (t.review || '').trim();
        const hasNote = !!trackNote;
        const hasContent = hasMoments || hasNote;
        const isExpanded = expanded[t.n];

        return (
          <View key={t.n}>
            <TouchableOpacity onPress={() => toggle(t.n)} style={styles.trackStripRow} disabled={!hasContent}>
              <Text style={styles.trackStripNum}>{String(t.n).padStart(2, '0')}</Text>
              <Text style={styles.trackStripName} numberOfLines={1}>
                {t.name}
              </Text>
              {t.reaction && <ReactionIcon kind={t.reaction} size={15} />}
              {hasNote && <Icon name="bookmark" size={13} color={gold} filled />}
              {hasMoments && <Text style={[styles.trackStripMomentCount, { color: gold }]}>{t.moments.length}</Text>}
            </TouchableOpacity>

            {isExpanded && hasContent && (
              <View style={styles.trackMoments}>
                {hasNote && (
                  <View
                    style={[
                      styles.trackMomentRow,
                      { borderColor: 'rgba(241,235,224,0.08)', backgroundColor: 'rgba(241,235,224,0.02)' },
                    ]}
                  >
                    <Text style={styles.trackMomentText}>{trackNote}</Text>
                  </View>
                )}
                {hasMoments &&
                  t.moments.map((m: any, idx: number) => {
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
    backgroundColor: C.nearBlack,
  },
  blurContainer: {
    position: 'absolute',
    top: -80,
    left: -80,
    right: -80,
    bottom: -80,
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
    fontFamily: F.bodySemibold,
    fontSize: 14,
    color: C.flame,
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
    fontFamily: F.mono,
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
    fontFamily: F.mono,
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    textAlign: 'center',
    padding: 12,
  },
  title: {
    marginTop: 18,
    fontFamily: F.displaySemibold,
    fontSize: 27,
    lineHeight: 30,
    color: C.fg,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  artist: {
    marginTop: 4,
    fontFamily: F.body,
    fontSize: 16,
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
    fontFamily: F.bodySemibold,
    fontSize: 13,
    color: C.fg,
  },
  // ---- Playback bar ----
  playbackBar: {
    width: '100%',
    marginTop: 18,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubWrap: {
    flex: 1,
  },
  scrubTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(241,235,224,0.18)',
    justifyContent: 'center',
  },
  scrubFill: {
    height: 4,
    borderRadius: 2,
  },
  scrubKnob: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    marginLeft: -5,
    top: -3.5,
  },
  scrubMarker: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0a0908',
    top: '50%',
    marginTop: -6,
    marginLeft: -5,
  },
  scrubTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  scrubTime: {
    fontFamily: F.mono,
    fontSize: 10,
    color: 'rgba(241,235,224,0.55)',
  },
  playbackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sourceBadge: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  openSpotifyLink: {
    fontFamily: F.mono,
    fontSize: 10,
    color: 'rgba(241,235,224,0.6)',
    letterSpacing: 0.4,
  },
  // ---- Live moment callout ----
  calloutSlot: {
    width: '100%',
    minHeight: 46,
    marginTop: 12,
    justifyContent: 'center',
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  calloutTime: {
    fontFamily: F.monoBold,
    fontSize: 12,
    color: C.nearBlack,
    letterSpacing: -0.2,
  },
  calloutDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(10,9,8,0.25)',
  },
  calloutText: {
    flex: 1,
    fontFamily: F.bodySemibold,
    fontSize: 13,
    color: C.nearBlack,
  },
  nowPlaying: {
    width: '100%',
    marginTop: 18,
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
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nowPlayingTrack: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.fg,
  },
  nowPlayingSource: {
    fontFamily: F.mono,
    fontSize: 9.5,
    color: 'rgba(241,235,224,0.5)',
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  quote: {
    marginTop: 24,
    fontFamily: F.displayItalic,
    fontSize: 20,
    lineHeight: 27,
    color: C.fg,
    textAlign: 'center',
    maxWidth: 320,
  },
  body: {
    marginTop: 16,
    fontFamily: F.body,
    fontSize: 15.5,
    lineHeight: 25,
    color: 'rgba(241,235,224,0.78)',
    maxWidth: 340,
  },
  section: {
    width: '100%',
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  momentInstructions: {
    fontFamily: F.body,
    fontSize: 11.5,
    color: 'rgba(241,235,224,0.5)',
    marginTop: 9,
    marginBottom: 12,
    lineHeight: 16,
  },
  // ---- Lyrics ----
  lyricsStatus: {
    fontFamily: F.body,
    fontSize: 13,
    color: 'rgba(241,235,224,0.5)',
    marginTop: 10,
    fontStyle: 'italic',
  },
  lyricsPane: {
    marginTop: 4,
  },
  lyricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lyricLine: {
    flexShrink: 1,
    fontFamily: F.body,
    fontSize: 18,
    lineHeight: 30,
    color: 'rgba(241,235,224,0.34)',
    paddingVertical: 3,
  },
  lyricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  lyricLineActive: {
    fontFamily: F.displaySemibold,
    fontSize: 20,
  },
  lyricLinePast: {
    color: 'rgba(241,235,224,0.5)',
  },
  plainLyrics: {
    fontFamily: F.body,
    fontSize: 16,
    lineHeight: 26,
    color: 'rgba(241,235,224,0.8)',
  },
  inlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineNoteText: {
    flex: 1,
    fontFamily: F.body,
    fontSize: 13.5,
    lineHeight: 18,
    color: C.fg,
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
    fontFamily: F.monoBold,
    fontSize: 12,
    color: C.nearBlack,
    letterSpacing: -0.25,
  },
  momentNoteText: {
    flex: 1,
    fontFamily: F.body,
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(241,235,224,0.86)',
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
    fontFamily: F.mono,
    fontSize: 11,
    color: 'rgba(241,235,224,0.4)',
    width: 20,
  },
  trackStripName: {
    flex: 1,
    fontFamily: F.body,
    fontSize: 14,
    color: C.fg,
  },
  trackStripMomentCount: {
    fontFamily: F.mono,
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
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(241,235,224,0.8)',
  },
});
