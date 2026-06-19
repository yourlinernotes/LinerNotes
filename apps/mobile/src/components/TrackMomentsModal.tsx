/**
 * TrackMomentsModal - Expandable moments editing for album tracks
 * Based on Claude Design spec: composer.jsx <CmpTrackRow /> expansion
 *
 * Features:
 * - Add/remove moments for a specific track
 * - Timestamp input (mm:ss)
 * - Note input
 * - Modal presentation over composer
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@linernotes/core';
import type { Moment } from '@linernotes/core';
import { Icon } from './atoms/Icon';
import { formatTimestamp } from '../lib/time-utils';

interface TrackMomentsModalProps {
  visible: boolean;
  trackNumber: number;
  trackName: string;
  moments: Moment[];
  onClose: () => void;
  onSave: (moments: Moment[]) => void;
}

interface MomentInput {
  mm: string;
  ss: string;
  note: string;
}

export function TrackMomentsModal({
  visible,
  trackNumber,
  trackName,
  moments: initialMoments,
  onClose,
  onSave,
}: TrackMomentsModalProps) {
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [input, setInput] = useState<MomentInput>({ mm: '', ss: '', note: '' });
  const ssRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  const gold = tokens.colors.gold;

  function handleAdd() {
    if (!input.note.trim()) return;
    const seconds = (parseInt(input.mm || '0', 10) * 60) + parseInt(input.ss || '0', 10);
    const newMoment = { seconds, note: input.note.trim() };
    const updated = [...moments, newMoment].sort((a, b) => a.seconds - b.seconds);
    setMoments(updated);
    setInput({ mm: '', ss: '', note: '' });
  }

  function handleRemove(idx: number) {
    setMoments(moments.filter((_, i) => i !== idx));
  }

  function handleSave() {
    onSave(moments);
    onClose();
  }

  function handleCancel() {
    setMoments(initialMoments);
    setInput({ mm: '', ss: '', note: '' });
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Track Moments</Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <Icon name="close" size={17} color={tokens.colors.fg} />
              </TouchableOpacity>
            </View>
            <View style={styles.trackInfo}>
              <Text style={styles.trackNumber}>
                {String(trackNumber).padStart(2, '0')}
              </Text>
              <Text style={styles.trackName} numberOfLines={1}>
                {trackName}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Existing moments */}
            {moments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {moments.length} MOMENT{moments.length > 1 ? 'S' : ''}
                </Text>
                {moments.map((m, idx) => (
                  <View key={idx} style={styles.momentRow}>
                    <View style={[styles.momentTime, { backgroundColor: gold }]}>
                      <Text style={styles.momentTimeText}>{formatTimestamp(m.seconds)}</Text>
                    </View>
                    <Text style={styles.momentNote}>{m.note}</Text>
                    <TouchableOpacity onPress={() => handleRemove(idx)} style={styles.momentRemove}>
                      <Icon name="close" size={14} color="rgba(241,235,224,0.45)" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add new moment */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ADD MOMENT</Text>
              <View style={styles.momentInput}>
                <TextInput
                  style={styles.momentInputTime}
                  value={input.mm}
                  onChangeText={(v) => {
                    const mm = v.replace(/\D/g, '').slice(0, 2);
                    setInput((p) => ({ ...p, mm }));
                    if (mm.length === 2) ssRef.current?.focus();
                  }}
                  placeholder="m"
                  placeholderTextColor="rgba(241,235,224,0.3)"
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
                    if (ss.length === 2) noteRef.current?.focus();
                  }}
                  placeholder="ss"
                  placeholderTextColor="rgba(241,235,224,0.3)"
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
                  placeholder="what happens here?"
                  placeholderTextColor="rgba(241,235,224,0.3)"
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                />
                <TouchableOpacity
                  onPress={handleAdd}
                  style={[
                    styles.momentAddButton,
                    { backgroundColor: input.note.trim() ? gold : 'rgba(241,235,224,0.1)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.momentAddIcon,
                      { color: input.note.trim() ? tokens.colors.nearBlack : 'rgba(241,235,224,0.4)' },
                    ]}
                  >
                    +
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.saveButton, { backgroundColor: gold }]}>
              <Text style={styles.saveButtonText}>Save Moments</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackNumber: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 13,
    color: 'rgba(245, 241, 232, 0.4)',
    letterSpacing: 0.02,
  },
  trackName: {
    flex: 1,
    fontFamily: tokens.typography.fonts.sans,
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.cream,
    letterSpacing: -0.01,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 24,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: tokens.colors.gold,
    textTransform: 'uppercase',
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
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,235,224,0.08)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
  },
  cancelButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(241,235,224,0.7)',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
});
