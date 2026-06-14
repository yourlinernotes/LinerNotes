/**
 * LinerNotes Composer Screen
 * Three modes: Track / Album / Playlist
 * Based on Claude Design handoff: composer.jsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, Reaction, Stars } from '../components/atoms/Icon';
import { ReviewCard } from '../components/ReviewCard';
import { formatTimestamp } from '../lib/time-utils';
import { tokens } from '@linernotes/core';
import type { Moment, ReactionType } from '@linernotes/core';

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
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [rating, setRating] = useState(0);
  const [take, setTake] = useState('');
  const [soloMoments, setSoloMoments] = useState<Moment[]>([]);

  // Album/Playlist track management
  const [tracks, setTracks] = useState<Record<number, TrackData>>({});
  const [openTrack, setOpenTrack] = useState<number | null>(null);
  const [fullAlbum, setFullAlbum] = useState(false);

  const gold = '#d9b25a';

  const lines = take.split('\n').filter(l => l.trim());
  const preview = lines[0] || '';
  const hasBody = lines.length > 1;
  const depth = hasBody ? 'full' : preview ? 'caption' : rating > 0 ? 'floor' : null;

  const canPost = mode === 'track' ? rating > 0 : mode === 'album' ? rating > 0 : true;

  function handlePost() {
    // TODO: Submit review to API
    console.log('Post review:', { mode, rating, take, soloMoments, tracks });
    onClose();
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[`${gold}1c`, 'transparent']}
        style={styles.headerGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              New {mode === 'playlist' ? 'playlist' : mode === 'track' ? 'track note' : 'album review'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={17} color={tokens.colors.cream} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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

          {/* Rating */}
          {mode !== 'playlist' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR RATING</Text>
              <StarsInput rating={rating} onChange={setRating} size={34} />
            </View>
          )}

          {/* Take/Note */}
          <View style={styles.section}>
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
            />
          </View>

          {/* Moments (Track mode only) */}
          {mode === 'track' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MOMENTS</Text>
              <MomentsInput
                moments={soloMoments}
                onAdd={(m) => setSoloMoments([...soloMoments, m])}
                onRemove={(idx) => setSoloMoments(soloMoments.filter((_, i) => i !== idx))}
                gold={gold}
              />
            </View>
          )}

          {/* Post Button */}
          <TouchableOpacity
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!canPost}
          >
            <Text style={styles.postButtonText}>
              {mode === 'playlist' ? 'Post playlist' :
               mode === 'track' && depth === 'full' ? 'Post track note' :
               mode === 'track' && depth === 'caption' ? 'Post' :
               mode === 'track' && depth === 'floor' ? 'Post rating' :
               rating > 0 ? 'Post' : 'Add a rating to post'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
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
      {[0, 1, 2, 3, 4].map(i => (
        <TouchableOpacity
          key={i}
          onPress={() => onChange(i + 1)}
          onLongPress={() => onChange(i + 0.5)}
          style={styles.star}
        >
          <Stars rating={rating >= i + 1 ? 1 : rating >= i + 0.5 ? 0.5 : 0} size={size} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface MomentsInputProps {
  moments: Moment[];
  onAdd: (moment: Moment) => void;
  onRemove: (index: number) => void;
  gold: string;
}

function MomentsInput({ moments, onAdd, onRemove, gold }: MomentsInputProps) {
  const [input, setInput] = useState<MomentInput>({ mm: '', ss: '', note: '' });

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
          onChangeText={(v) => setInput({ ...input, mm: v.replace(/\D/g, '').slice(0, 2) })}
          placeholder="m"
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={[styles.momentColon, { color: gold }]}>:</Text>
        <TextInput
          style={styles.momentInputTime}
          value={input.ss}
          onChangeText={(v) => setInput({ ...input, ss: v.replace(/\D/g, '').slice(0, 2) })}
          placeholder="ss"
          keyboardType="number-pad"
          maxLength={2}
        />
        <TextInput
          style={styles.momentInputNote}
          value={input.note}
          onChangeText={(v) => setInput({ ...input, note: v })}
          placeholder="what happens here?"
          placeholderTextColor="rgba(241,235,224,0.3)"
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
    color: tokens.colors.cream,
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
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: '#d9b25a',
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
    color: tokens.colors.cream,
    minHeight: 100,
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
    color: tokens.colors.cream,
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
    color: tokens.colors.cream,
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
    backgroundColor: '#d9b25a',
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
});
