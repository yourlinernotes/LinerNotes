/**
 * LinerNotes Composer Screen
 * Three modes: Track / Album / Playlist
 * Based on Claude Design handoff: composer.jsx
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/atoms/Icon';
import { Stars } from '../components/atoms/Stars';
import { ReviewCard } from '../components/ReviewCard';
import { formatTimestamp } from '../lib/time-utils';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { reviewToFeedReview } from '../lib/feed-adapter';
import type { Moment, ReactionType } from '../lib/types';
import { tokens } from '../lib/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type ComposerMode = 'track' | 'album' | 'playlist';

// Accept Spotify / Apple Music playlist links (and Spotify URIs).
function isPlaylistLink(url: string): boolean {
  const u = url.trim();
  return (
    /open\.spotify\.com\/playlist\//i.test(u) ||
    /spotify:playlist:/i.test(u) ||
    /music\.apple\.com\/[^/]+\/playlist\//i.test(u)
  );
}

function linkPlatform(url: string): string {
  if (/spotify/i.test(url)) return 'Spotify';
  if (/music\.apple\.com/i.test(url)) return 'Apple Music';
  return 'Playlist';
}

interface TrackData {
  n: number;
  name: string;
  artist?: string;
  reaction: ReactionType;
  review: string;
  moments: Moment[];
  excluded?: boolean;
}

interface MomentInput {
  mm: string;
  ss: string;
  note: string;
}

interface ComposerScreenProps {
  onClose: () => void;
  mode?: ComposerMode;
  prefilledTrack?: any;
  prefilledAlbum?: any;
  prefilledRating?: number;
}

export function ComposerScreen({
  onClose,
  mode: initialMode = 'track',
  prefilledTrack,
  prefilledAlbum,
  prefilledRating,
}: ComposerScreenProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [rating, setRating] = useState(prefilledRating || 0);
  const [take, setTake] = useState('');
  const [soloMoments, setSoloMoments] = useState<Moment[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [showTake, setShowTake] = useState(false);
  const [showMoments, setShowMoments] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);

  // Album/Playlist track management
  const [tracks, setTracks] = useState<Record<number, TrackData>>({});
  // TODO: Implement track selection UI for album mode
  // const [openTrack, setOpenTrack] = useState<number | null>(null);
  // const [fullAlbum, setFullAlbum] = useState(false);

  // Track search (track mode) — its own box + state
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [searchingTrack, setSearchingTrack] = useState(false);

  // Album search (album mode) — separate box + state
  const [albumQuery, setAlbumQuery] = useState('');
  const [albumResults, setAlbumResults] = useState<any[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [searchingAlbum, setSearchingAlbum] = useState(false);

  // Playlist (playlist mode) — name + external Spotify/Apple link
  const [playlistName, setPlaylistName] = useState('');
  const [playlistLink, setPlaylistLink] = useState('');

  // The item the shared bits (rating, preview, post) act on.
  const selectedItem = mode === 'album' ? selectedAlbum : selectedTrack;

  const gold = tokens.colors.gold;
  const scrollRef = useRef<ScrollView>(null);
  const scrollToInput = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

  const lines = take.split('\n').filter(l => l.trim());
  // When the take is multi-line the user picks which line is the caption (the
  // line shown on the card); we store the take with that line hoisted first so
  // the card preview shows the caption and the experience shows the full text.
  const captionIdx = lines.length ? Math.min(captionIndex, lines.length - 1) : 0;
  const orderedTake =
    lines.length > 1
      ? [lines[captionIdx], ...lines.filter((_, i) => i !== captionIdx)].join('\n')
      : take.trim();
  const preview = lines[captionIdx] || '';
  const hasBody = lines.length > 1;
  const depth = hasBody ? 'full' : preview ? 'caption' : rating > 0 ? 'floor' : null;

  const canPost =
    mode === 'playlist'
      ? playlistName.trim().length > 0 && isPlaylistLink(playlistLink)
      : !!selectedItem && rating > 0;

  // Swipe down from the top (header): the sheet tracks the finger and snaps
  // closed past a threshold, otherwise springs back.
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
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 2,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Set prefilled track/album from Last.fm prompts
  useEffect(() => {
    if (prefilledTrack) {
      setSelectedTrack(prefilledTrack);
      setMode('track');
    } else if (prefilledAlbum) {
      setSelectedAlbum(prefilledAlbum);
      setMode('album');
    }
  }, [prefilledTrack, prefilledAlbum]);

  // Live preview of the note — only once a song/album and rating are chosen.
  const previewReview =
    mode !== 'playlist' && selectedItem && rating > 0
      ? reviewToFeedReview(
          {
            id: 'preview',
            userId: user?.id ?? '',
            track: {
              id: String(selectedItem.id),
              name: selectedItem.name,
              artist: selectedItem.artist,
              album: selectedItem.album || '',
              artworkUrl: selectedItem.artworkUrl,
            },
            rating,
            take: orderedTake || undefined,
            notes: soloMoments,
            featuredNoteIdx: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { name: user?.displayName || 'You', handle: user?.handle || 'you', tint: gold }
        )
      : null;

  // Debounce typing and guard against out-of-order responses: only the most
  // recent query (tracked by searchSeq) is allowed to write results, so a slow
  // stale response can't clobber the latest one.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  function queueSearch(query: string, kind: 'track' | 'album') {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const setResults = kind === 'album' ? setAlbumResults : setTrackResults;
    if (!query.trim()) {
      searchSeq.current++; // cancel any in-flight write
      setResults([]);
      (kind === 'album' ? setSearchingAlbum : setSearchingTrack)(false);
      return;
    }
    (kind === 'album' ? setSearchingAlbum : setSearchingTrack)(true);
    searchTimer.current = setTimeout(() => runSearch(query, kind), 350);
  }

  // Tries the backend (MusicBrainz + iTunes) first, falls back to iTunes.
  async function runSearch(query: string, kind: 'track' | 'album') {
    const setResults = kind === 'album' ? setAlbumResults : setTrackResults;
    const setBusy = kind === 'album' ? setSearchingAlbum : setSearchingTrack;
    const seq = ++searchSeq.current;
    try {
      let results: any[] = [];
      try {
        const data = kind === 'album'
          ? await api.searchAlbums(query, 10)
          : await api.searchTracks(query, 10);
        results = data.results || data || [];
      } catch {
        console.log('Backend search failed, falling back to iTunes API');
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${kind === 'album' ? 'album' : 'song'}&limit=10`
        );
        const data = await res.json();
        results = data.results || [];
      }
      if (seq === searchSeq.current) setResults(results); // latest query wins
    } catch (error) {
      console.error('Search failed:', error);
      if (seq === searchSeq.current) setResults([]);
    } finally {
      if (seq === searchSeq.current) setBusy(false);
    }
  }

  // Normalize a backend/iTunes result into our selected-item shape.
  const normalizeResult = (result: any) => ({
    id: String(result.id || result.albumId || result.trackId || result.collectionId),
    name: result.name || result.trackName || result.collectionName,
    artist: result.artist || result.artistName,
    album: result.album || result.collectionName,
    artworkUrl: result.artworkUrl || (result.artworkUrl100 || '').replace('100x100', '600x600'),
  });

  function selectTrack(result: any) {
    setSelectedTrack(normalizeResult(result));
    setTrackResults([]);
    setTrackQuery('');
  }

  async function selectAlbum(result: any) {
    setSelectedAlbum(normalizeResult(result));
    setAlbumResults([]);
    setAlbumQuery('');

    // If we have an album id, fetch its tracklist so the album review can
    // carry per-track entries.
    const albumId = result.albumId || result.id || result.collectionId;
    if (albumId) {
      try {
        const { tracks: albumTracks } = await api.getAlbumTracks(String(albumId));
        const tracksMap: Record<number, TrackData> = {};
        (albumTracks || []).forEach((track: any, index: number) => {
          const n = track.trackNumber || index + 1;
          tracksMap[n] = { n, name: track.name, moments: [], reaction: null, review: '' };
        });
        setTracks(tracksMap);
      } catch (error) {
        console.error('Failed to fetch album tracks:', error);
      }
    }
  }

  async function handlePost() {
    if (isPosting) return;

    setIsPosting(true);

    try {
      const body = hasBody ? orderedTake.split('\n').slice(1).join('\n') : undefined;

      if (mode === 'playlist') {
        await api.createPlaylist({
          name: playlistName.trim(),
          url: playlistLink.trim(),
          note: orderedTake || undefined,
        });
      } else if (mode === 'album') {
        await api.createAlbumReview({
          album: {
            id: selectedAlbum.id,
            name: selectedAlbum.name,
            artist: selectedAlbum.artist,
            artworkUrl: selectedAlbum.artworkUrl,
          },
          overallRating: rating,
          body,
          tracks: Object.values(tracks).map((t) => ({
            trackId: String(t.n),
            trackName: t.name,
            trackNumber: t.n,
            reaction: t.reaction,
            moment: t.moments[0],
          })),
          notes: soloMoments,
          featuredNoteIdx: 0,
        });
      } else {
        await api.createReview({
          track: {
            id: selectedTrack.id,
            name: selectedTrack.name,
            artist: selectedTrack.artist,
            album: selectedTrack.album || '',
            artworkUrl: selectedTrack.artworkUrl,
          },
          rating,
          take: orderedTake || undefined,
          notes: soloMoments,
          featuredNoteIdx: 0,
        });
      }

      // Success feedback
      Alert.alert(
        'Success!',
        mode === 'album' ? 'Album review posted!' : 'Track review posted!',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Failed to post review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to post review: ${errorMessage}`);
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <LinearGradient
        colors={[`${gold}1c`, 'transparent']}
        style={styles.headerGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              New {mode === 'playlist' ? 'playlist' : mode === 'track' ? 'track note' : 'album review'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={17} color={tokens.colors.fg} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Mode Tabs */}
          <View style={styles.modeTabs}>
            {(['track', 'album', 'playlist'] as ComposerMode[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[styles.modeTab, mode === m && { backgroundColor: gold }]}
              >
                <Text style={[
                  styles.modeTabText,
                  mode === m && styles.modeTabTextActive
                ]}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Track search box — only on the track tab */}
          {mode === 'track' && (
            <SearchSection
              label="SEARCH TRACK"
              selectedLabel="TRACK"
              placeholder="search for a track..."
              query={trackQuery}
              onChangeQuery={(q) => {
                setTrackQuery(q);
                queueSearch(q, 'track');
              }}
              searching={searchingTrack}
              results={trackResults}
              selected={selectedTrack}
              onSelect={selectTrack}
              onClear={() => setSelectedTrack(null)}
            />
          )}

          {/* Album search box — separate, only on the album tab */}
          {mode === 'album' && (
            <SearchSection
              label="SEARCH ALBUM"
              selectedLabel="ALBUM"
              placeholder="search for an album..."
              query={albumQuery}
              onChangeQuery={(q) => {
                setAlbumQuery(q);
                queueSearch(q, 'album');
              }}
              searching={searchingAlbum}
              results={albumResults}
              selected={selectedAlbum}
              onSelect={selectAlbum}
              onClear={() => setSelectedAlbum(null)}
            />
          )}

          {/* Playlist — name + external Spotify/Apple Music link (no search) */}
          {mode === 'playlist' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PLAYLIST NAME</Text>
                <TextInput
                  style={styles.lineInput}
                  value={playlistName}
                  onChangeText={setPlaylistName}
                  placeholder="name your playlist..."
                  placeholderTextColor="rgba(241,235,224,0.3)"
                  onFocus={scrollToInput}
                />
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PLAYLIST LINK</Text>
                <TextInput
                  style={styles.lineInput}
                  value={playlistLink}
                  onChangeText={setPlaylistLink}
                  placeholder="paste a Spotify or Apple Music link..."
                  placeholderTextColor="rgba(241,235,224,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onFocus={scrollToInput}
                />
                {playlistLink.trim().length > 0 &&
                  (isPlaylistLink(playlistLink) ? (
                    <Text style={[styles.linkOk, { color: gold }]}>
                      {linkPlatform(playlistLink)} playlist linked
                    </Text>
                  ) : (
                    <Text style={styles.linkWarn}>
                      paste a Spotify or Apple Music playlist link
                    </Text>
                  ))}
              </View>
            </>
          )}

          {/* Rating */}
          {mode !== 'playlist' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR RATING</Text>
              <StarsInput rating={rating} onChange={setRating} size={34} />
            </View>
          )}

          {/* Take/Note (optional) */}
          <View style={styles.section}>
            {showTake ? (
              <>
                <Text style={styles.sectionLabel}>
                  {mode === 'track' ? 'YOUR TAKE' : 'YOUR NOTE'}
                </Text>
                <TextInput
                  style={styles.textArea}
                  value={take}
                  onChangeText={setTake}
                  placeholder="what did you think?"
                  placeholderTextColor="rgba(241,235,224,0.3)"
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  onFocus={scrollToInput}
                />
                {lines.length > 1 && (
                  <View style={styles.captionPicker}>
                    <Text style={styles.captionLabel}>
                      CAPTION — shown on the card
                    </Text>
                    {lines.map((line, i) => {
                      const active = i === captionIdx;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[styles.captionRow, active && { borderColor: gold }]}
                          onPress={() => setCaptionIndex(i)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.captionRadio,
                              { borderColor: active ? gold : 'rgba(241,235,224,0.3)' },
                              active && { backgroundColor: gold },
                            ]}
                          />
                          <Text style={styles.captionText} numberOfLines={1}>
                            {line}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={() => setShowTake(true)}>
                <Text style={[styles.addButtonPlus, { color: gold }]}>+</Text>
                <Text style={[styles.addButtonText, { color: gold }]}>
                  {mode === 'track' ? 'add your take' : 'add a note'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Moments (Track mode only, optional) */}
          {mode === 'track' && (
            <View style={styles.section}>
              {showMoments ? (
                <>
                  <Text style={styles.sectionLabel}>MOMENTS</Text>
                  <MomentsInput
                    moments={soloMoments}
                    onAdd={(m) =>
                      setSoloMoments((prev) =>
                        [...prev, m].sort((a, b) => a.seconds - b.seconds)
                      )
                    }
                    onRemove={(idx) => setSoloMoments(soloMoments.filter((_, i) => i !== idx))}
                    onFieldFocus={scrollToInput}
                    gold={gold}
                  />
                </>
              ) : (
                <TouchableOpacity style={styles.addButton} onPress={() => setShowMoments(true)}>
                  <Text style={[styles.addButtonPlus, { color: gold }]}>+</Text>
                  <Text style={[styles.addButtonText, { color: gold }]}>add moments</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Post Button */}
          <TouchableOpacity
            style={[styles.postButton, (!canPost || isPosting) && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!canPost || isPosting}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color={tokens.colors.nearBlack} />
            ) : (
              <Text style={styles.postButtonText}>
                {mode === 'playlist' ? 'Post playlist' :
                 mode === 'track' && depth === 'full' ? 'Post track note' :
                 mode === 'track' && depth === 'caption' ? 'Post' :
                 mode === 'track' && depth === 'floor' ? 'Post rating' :
                 rating > 0 ? 'Post' : 'Add a rating to post'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Live preview — only once a song + rating are selected */}
          {previewReview && (
            <View style={styles.previewSection}>
              <Text style={styles.sectionLabel}>PREVIEW</Text>
              <ReviewCard review={previewReview} accent={gold} context="feed" />
            </View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

interface SearchSectionProps {
  label: string;
  selectedLabel: string;
  placeholder: string;
  query: string;
  onChangeQuery: (q: string) => void;
  searching: boolean;
  results: any[];
  selected: any | null;
  onSelect: (result: any) => void;
  onClear: () => void;
}

function SearchSection({
  label,
  selectedLabel,
  placeholder,
  query,
  onChangeQuery,
  searching,
  results,
  selected,
  onSelect,
  onClear,
}: SearchSectionProps) {
  if (selected) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{selectedLabel}</Text>
        <View style={styles.selectedTrack}>
          <View style={styles.selectedTrackInfo}>
            <Text style={styles.selectedTrackName} numberOfLines={1}>
              {selected.name}
            </Text>
            <Text style={styles.selectedTrackArtist} numberOfLines={1}>
              {selected.artist}
            </Text>
          </View>
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.changeButton}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TextInput
        style={styles.lineInput}
        value={query}
        onChangeText={onChangeQuery}
        placeholder={placeholder}
        placeholderTextColor="rgba(241,235,224,0.3)"
        autoCorrect={false}
      />
      {searching && <Text style={styles.hint}>searching...</Text>}
      {results.map((result, i) => (
        <TouchableOpacity
          key={i}
          style={styles.searchResult}
          onPress={() => onSelect(result)}
        >
          <Text style={styles.searchResultName} numberOfLines={1}>
            {result.name || result.trackName || result.collectionName}
          </Text>
          <Text style={styles.searchResultArtist} numberOfLines={1}>
            {result.artist || result.artistName}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface StarsInputProps {
  rating: number;
  onChange: (rating: number) => void;
  size?: number;
}

function StarsInput({ rating, onChange, size = 34 }: StarsInputProps) {
  return (
    <View style={styles.starsContainer}>
      <Stars
        rating={rating}
        size={size}
        interactive
        onRatingChange={onChange}
        showNum={false}
      />
    </View>
  );
}

interface MomentsInputProps {
  moments: Moment[];
  onAdd: (moment: Moment) => void;
  onRemove: (index: number) => void;
  onFieldFocus?: () => void;
  gold: string;
}

function MomentsInput({ moments, onAdd, onRemove, onFieldFocus, gold }: MomentsInputProps) {
  const [input, setInput] = useState<MomentInput>({ mm: '', ss: '', note: '' });
  const ssRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  function handleAdd() {
    if (!input.note.trim()) return;
    const seconds = (parseInt(input.mm || '0', 10) * 60) + parseInt(input.ss || '0', 10);
    onAdd({ seconds, note: input.note.trim() });
    setInput({ mm: '', ss: '', note: '' });
  }

  return (
    <View style={styles.momentsContainer}>
      {moments.map((m, idx) => (
        <View key={idx} style={styles.momentRow}>
          <View style={[styles.momentTime, { backgroundColor: gold }]}>
            <Text style={styles.momentTimeText}>{formatTimestamp(m.seconds)}</Text>
          </View>
          <Text style={styles.momentNote}>{m.note}</Text>
          <TouchableOpacity onPress={() => onRemove(idx)} style={styles.momentRemove}>
            <Icon name="close" size={14} color="rgba(241,235,224,0.45)" />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.momentInput}>
        <TextInput
          style={styles.momentInputTime}
          value={input.mm}
          onChangeText={(v) => {
            const mm = v.replace(/\D/g, '').slice(0, 2);
            setInput((p) => ({ ...p, mm }));
            if (mm.length === 2) ssRef.current?.focus(); // auto-advance to ss
          }}
          onFocus={onFieldFocus}
          placeholder="m"
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => ssRef.current?.focus()}
        />
        <Text style={[styles.momentColon, { color: gold }]}>:</Text>
        <TextInput
          ref={ssRef}
          style={styles.momentInputTime}
          value={input.ss}
          onChangeText={(v) => {
            const ss = v.replace(/\D/g, '').slice(0, 2);
            setInput((p) => ({ ...p, ss }));
            if (ss.length === 2) noteRef.current?.focus(); // auto-advance to note
          }}
          onFocus={onFieldFocus}
          placeholder="ss"
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => noteRef.current?.focus()}
        />
        <TextInput
          ref={noteRef}
          style={styles.momentInputNote}
          value={input.note}
          onChangeText={(v) => setInput((p) => ({ ...p, note: v }))}
          onFocus={onFieldFocus}
          placeholder="what happens here?"
          placeholderTextColor="rgba(241,235,224,0.3)"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity
          onPress={handleAdd}
          style={[styles.momentAddButton, { backgroundColor: input.note.trim() ? gold : 'rgba(241,235,224,0.1)' }]}
        >
          <Text style={[styles.momentAddIcon, { color: input.note.trim() ? tokens.colors.nearBlack : 'rgba(241,235,224,0.4)' }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 52,
    paddingBottom: 8,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(241,235,224,0.2)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  headerTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 20,
    color: tokens.colors.fg,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    backgroundColor: 'rgba(241,235,224,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 150,
    gap: 20,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(241,235,224,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.09)',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabText: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(241,235,224,0.65)',
  },
  modeTabTextActive: {
    color: tokens.colors.nearBlack,
  },
  section: {
    gap: 8,
  },
  previewSection: {
    gap: 10,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,235,224,0.08)',
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: tokens.colors.gold,
    textTransform: 'uppercase',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  star: {
    // Touchable wrapper for star
  },
  textArea: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 11,
    paddingTop: 11,
    fontFamily: 'System',
    fontSize: 14.5,
    color: tokens.colors.fg,
    minHeight: 100,
  },
  lineInput: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 12,
    fontFamily: 'System',
    fontSize: 14.5,
    color: tokens.colors.fg,
  },
  linkOk: {
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 8,
  },
  linkWarn: {
    fontFamily: 'System',
    fontSize: 12.5,
    color: '#e0762f',
    marginTop: 8,
  },
  captionPicker: {
    gap: 6,
    marginTop: 4,
  },
  captionLabel: {
    fontFamily: 'Menlo',
    fontSize: 9,
    letterSpacing: 0.6,
    color: 'rgba(241,235,224,0.45)',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    backgroundColor: 'rgba(241,235,224,0.04)',
  },
  captionRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  captionText: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13.5,
    color: 'rgba(241,235,224,0.85)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(241,235,224,0.22)',
    backgroundColor: 'rgba(241,235,224,0.03)',
  },
  addButtonPlus: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '600',
  },
  addButtonText: {
    fontFamily: 'System',
    fontSize: 13.5,
    fontWeight: '600',
  },
  momentsContainer: {
    gap: 8,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(241,235,224,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
  },
  momentTime: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  momentTimeText: {
    fontFamily: 'Menlo',
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  momentNote: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.85)',
  },
  momentRemove: {
    padding: 2,
  },
  momentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  momentInputTime: {
    width: 42,
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 9,
    textAlign: 'center',
    fontFamily: 'Menlo',
    fontSize: 15,
    color: tokens.colors.fg,
  },
  momentColon: {
    fontFamily: 'Menlo',
    fontSize: 16,
  },
  momentInputNote: {
    flex: 1,
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 9,
    paddingHorizontal: 11,
    fontFamily: 'System',
    fontSize: 13,
    color: tokens.colors.fg,
  },
  momentAddButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentAddIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: tokens.colors.gold,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  hint: {
    fontSize: 13,
    color: 'rgba(241,235,224,0.4)',
    marginTop: 8,
  },
  searchResult: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderRadius: 8,
    marginTop: 8,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.fg,
    marginBottom: 2,
  },
  searchResultArtist: {
    fontSize: 13,
    color: 'rgba(241,235,224,0.6)',
  },
  selectedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  selectedTrackInfo: {
    flex: 1,
  },
  selectedTrackName: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.fg,
    marginBottom: 2,
  },
  selectedTrackArtist: {
    fontSize: 13,
    color: 'rgba(241,235,224,0.7)',
  },
  changeButton: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.gold,
  },
});
