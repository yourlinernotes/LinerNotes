/**
 * Reusable edit-profile form (display name, handle, bio) → updateUser.
 * Used by the side menu and the profile page's "Edit profile" button.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { api } from '../lib/api-client';
import { tokens } from '../lib/tokens';
import type { User } from '../lib/types';

export function EditProfileForm({
  user,
  onSaved,
}: {
  user: User | null;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [handle, setHandle] = useState(user?.handle || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);

  const handleClean = handle.replace(/[^a-z0-9_]/gi, '').toLowerCase();
  const canSave = displayName.trim().length > 0 && handleClean.length >= 3;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await api.updateUser({
        displayName: displayName.trim(),
        handle: handleClean,
        // Send '' (not undefined) so clearing the bio actually removes it.
        bio: bio.trim(),
      });
      onSaved();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="your name"
        placeholderTextColor="rgba(241,235,224,0.3)"
      />

      <Text style={styles.fieldLabel}>HANDLE</Text>
      <TextInput
        style={styles.input}
        value={handleClean}
        onChangeText={setHandle}
        placeholder="yourhandle"
        placeholderTextColor="rgba(241,235,224,0.3)"
        autoCapitalize="none"
      />

      <Text style={styles.fieldLabel}>BIO</Text>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={bio}
        onChangeText={setBio}
        placeholder="what do you listen for?"
        placeholderTextColor="rgba(241,235,224,0.3)"
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[
          styles.saveBtn,
          { backgroundColor: canSave && !saving ? tokens.colors.gold : 'rgba(241,235,224,0.12)' },
        ]}
        onPress={save}
        disabled={!canSave || saving}
      >
        {saving ? (
          <ActivityIndicator color={tokens.colors.nearBlack} />
        ) : (
          <Text
            style={[
              styles.saveBtnText,
              { color: canSave ? tokens.colors.nearBlack : 'rgba(241,235,224,0.4)' },
            ]}
          >
            Save
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 60 },
  fieldLabel: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: 'rgba(241,235,224,0.45)',
    marginBottom: 7,
    marginTop: 14,
  },
  input: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 12,
    fontFamily: 'System',
    fontSize: 14.5,
    color: tokens.colors.fg,
  },
  saveBtn: { marginTop: 24, padding: 14, borderRadius: 13, alignItems: 'center' },
  saveBtnText: { fontFamily: 'System', fontSize: 15, fontWeight: '600' },
});
