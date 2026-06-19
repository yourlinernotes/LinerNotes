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
}

export function ComposerScreen({ onClose, mode: initialMode = 'track' }: ComposerScreenProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [rating, setRating] = useState(0);
  const [take, setTake] = useState('');
  const [soloMoments, setSoloMoments] = useState<Moment[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [showTake, setShowTake] = useState(false);
  const [showMoments, setShowMoments] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);

  // Album/Playlist track management
  const [tracks, setTracks] = useState<Record<number, TrackData>>({});
  const [openTrack, setOpenTrack] = useState<number | null>(null);
  const [fullAlbum, setFullAlbum] = useState(false);

  // Track/Album search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

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

  const canPost = selectedTrack && (mode === 'track' ? rating > 0 : mode === 'album' ? rating > 0 : true);

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

  // Live preview of the note — only once a song and rating are chosen.
  const previewReview =
    selectedTrack && rating > 0
      ? reviewToFeedReview(
          {
            id: 'preview',
            userId: user?.id ?? '',
            track: {
              id: String(selectedTrack.id),
              name: selectedTrack.name,
              artist: selectedTrack.artist,
              album: selectedTrack.album || '',
              artworkUrl: selectedTrack.artworkUrl,
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

  async function searchTracks(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Use the backend API which calls iTunes Search API
      const data = mode === 'album'
        ? await api.searchAlbums(query, 10)
        : await api.searchTracks(query, 10);

      // Backend returns { results: [...], count: N }
      const results = data.results || data || [];
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function selectTrack(result: any) {
    setSelectedTrack({
      // Backend returns 'id' directly instead of trackId/collectionId
      id: String(result.id || result.trackId || result.collectionId),
      name: result.name || result.trackName || result.collectionName,
      artist: result.artist || result.artistName,
      album: result.album || result.collectionName,
      // Backend already returns 600x600 artwork
      artworkUrl: result.artworkUrl || (result.artworkUrl100 || '').replace('100x100', '600x600'),
    });
    setSearchResults([]);
    setSearchQuery('');
  }

  async function handlePost() {
    if (isPosting) return;

    setIsPosting(true);

    try {
      const body = hasBody ? orderedTake.split('\n').slice(1).join('\n') : undefined;

      if (mode === 'album') {
        await api.createAlbumReview({
          album: {
            id: selectedTrack.id,
            name: selectedTrack.name,
            artist: selectedTrack.artist,
            artworkUrl: selectedTrack.artworkUrl,
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

      onClose();
    } catch (error) {
      console.error('Failed to post review:', error);
      Alert.alert('Error', 'Failed to post review. Please try again.');
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

          {/* Track/Album Search */}
          {!selectedTrack ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                SEARCH {mode === 'album' ? 'ALBUM' : 'TRACK'}
              </Text>
              <TextInput
                style={styles.textArea}
                value={searchQuery}
                onChangeText={(q) => {
                  setSearchQuery(q);
                  searchTracks(q);
                }}
                placeholder={`search for ${mode === 'album' ? 'an album' : 'a track'}...`}
                placeholderTextColor="rgba(241,235,224,0.3)"
                autoCorrect={false}
              />
              {isSearching && (
                <Text style={styles.hint}>searching...</Text>
              )}
              {searchResults.map((result, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.searchResult}
                  onPress={() => selectTrack(result)}
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
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {mode === 'album' ? 'ALBUM' : 'TRACK'}
              </Text>
              <View style={styles.selectedTrack}>
                <View style={styles.selectedTrackInfo}>
                  <Text style={styles.selectedTrackName} numberOfLines={1}>
                    {selectedTrack.name}
                  </Text>
                  <Text style={styles.selectedTrackArtist} numberOfLines={1}>
                    {selectedTrack.artist}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedTrack(null)}>
                  <Text style={styles.changeButton}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
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
