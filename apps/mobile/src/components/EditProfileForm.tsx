/**
 * Reusable edit-profile form (display name, handle, bio) → updateUser.
 * Used by the side menu and the profile page's "Edit profile" button.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api-client';
import { lastfm } from '../services/lastfm';
import { tokens } from '../lib/tokens';
import type { User } from '../lib/types';

type LastFmStatus = 'idle' | 'linking' | 'linked' | 'disconnecting';

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

  const [lastFmStatus, setLastFmStatus] = useState<LastFmStatus>('idle');
  const [lastFmUsername, setLastFmUsername] = useState('');
  const [lastFmInput, setLastFmInput] = useState('');

  const handleClean = handle.replace(/[^a-z0-9_]/gi, '').toLowerCase();
  const canSave = displayName.trim().length > 0 && handleClean.length >= 3;

  // Check if Last.fm is already connected
  useEffect(() => {
    const checkLastFm = async () => {
      try {
        const connection = await api.getLastFmConnection();
        if (connection.connected && connection.username) {
          setLastFmStatus('linked');
          setLastFmUsername(connection.username);
        }
      } catch (error) {
        // Fallback to local check
        const isConnected = await lastfm.isConnected();
        if (isConnected) {
          const username = await lastfm.getUsername();
          if (username) {
            setLastFmStatus('linked');
            setLastFmUsername(username);
          }
        }
      }
    };
    checkLastFm();
  }, []);

  const connectLastFm = async () => {
    const username = lastFmInput.trim();
    if (!username || lastFmStatus === 'linking') return;

    setLastFmStatus('linking');

    try {
      // Verify the username exists by fetching recent tracks
      const tracks = await lastfm.getRecentTracks(username, 1);

      if (tracks && tracks.length > 0) {
        await lastfm.setUsername(username);
        setLastFmUsername(username);
        setLastFmStatus('linked');
        setLastFmInput('');
        Alert.alert('Connected', `Successfully connected to Last.fm as ${username}`);
      } else {
        setLastFmStatus('idle');
        Alert.alert('Error', 'Could not find that Last.fm username. Please check and try again.');
      }
    } catch (error) {
      setLastFmStatus('idle');
      Alert.alert('Error', 'Failed to connect to Last.fm. Please check the username and try again.');
    }
  };

  const disconnectLastFm = async () => {
    setLastFmStatus('disconnecting');
    try {
      await api.disconnectService('lastfm');
      await lastfm.clearUsername();
      setLastFmStatus('idle');
      setLastFmUsername('');
      Alert.alert('Disconnected', 'Last.fm has been disconnected');
    } catch (error) {
      setLastFmStatus('linked');
      Alert.alert('Error', 'Failed to disconnect Last.fm');
    }
  };

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

      {/* Last.fm Connection */}
      <Text style={[styles.fieldLabel, { marginTop: 24 }]}>MUSIC SCROBBLING</Text>
      <View style={styles.lastFmCard}>
        <LinearGradient
          colors={
            lastFmStatus === 'linked'
              ? ['rgba(127,207,155,0.12)', 'transparent']
              : ['rgba(217,178,90,0.10)', 'transparent']
          }
          locations={[0, 0.8]}
          style={styles.lastFmGradient}
        />
        <View style={styles.lastFmContent}>
          <View style={styles.lastFmHeader}>
            <Text style={styles.lastFmTitle}>Last.fm</Text>
            <Text
              style={[
                styles.lastFmStatus,
                {
                  color:
                    lastFmStatus === 'linked'
                      ? tokens.colors.confirmGreen
                      : 'rgba(241,235,224,0.4)',
                },
              ]}
            >
              {lastFmStatus === 'linked' ? 'CONNECTED' : 'NOT CONNECTED'}
            </Text>
          </View>

          {lastFmStatus === 'linked' || lastFmStatus === 'disconnecting' ? (
            <View>
              <Text style={styles.lastFmDescription}>
                Connected as <Text style={{ color: tokens.colors.gold }}>@{lastFmUsername}</Text>
              </Text>
              <TouchableOpacity
                onPress={disconnectLastFm}
                disabled={lastFmStatus === 'disconnecting'}
                style={[
                  styles.lastFmButton,
                  {
                    backgroundColor:
                      lastFmStatus === 'disconnecting'
                        ? 'rgba(241,235,224,0.08)'
                        : 'rgba(241,235,224,0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(241,235,224,0.18)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.lastFmButtonText,
                    { color: 'rgba(241,235,224,0.7)' },
                  ]}
                >
                  {lastFmStatus === 'disconnecting' ? 'Disconnecting…' : 'Disconnect'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.lastFmDescription}>
                Connect Last.fm to see prompts based on what you're listening to
              </Text>
              <TextInput
                value={lastFmInput}
                onChangeText={setLastFmInput}
                placeholder="your last.fm username"
                placeholderTextColor="rgba(241,235,224,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                editable={lastFmStatus !== 'linking'}
                onSubmitEditing={connectLastFm}
                style={[styles.input, { marginTop: 8, marginBottom: 8 }]}
              />
              <TouchableOpacity
                onPress={connectLastFm}
                disabled={
                  lastFmStatus === 'linking' || lastFmInput.trim().length === 0
                }
                style={[
                  styles.lastFmButton,
                  {
                    backgroundColor:
                      lastFmStatus === 'linking' || lastFmInput.trim().length === 0
                        ? 'rgba(241,235,224,0.12)'
                        : tokens.colors.gold,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.lastFmButtonText,
                    {
                      color:
                        lastFmStatus === 'linking' || lastFmInput.trim().length === 0
                          ? 'rgba(241,235,224,0.4)'
                          : tokens.colors.nearBlack,
                    },
                  ]}
                >
                  {lastFmStatus === 'linking' ? 'Connecting…' : 'Connect Last.fm'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

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
    fontFamily: tokens.typography.rnFonts.mono,
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
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 14.5,
    color: tokens.colors.fg,
  },
  lastFmCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    backgroundColor: 'rgba(241,235,224,0.04)',
    overflow: 'hidden',
    marginTop: 8,
  },
  lastFmGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  lastFmContent: {
    padding: 14,
    gap: 8,
  },
  lastFmHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  lastFmTitle: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  lastFmStatus: {
    fontFamily: 'Courier',
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  lastFmDescription: {
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(241,235,224,0.55)',
    marginBottom: 4,
  },
  lastFmButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  lastFmButtonText: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: { marginTop: 24, padding: 14, borderRadius: 13, alignItems: 'center' },
  saveBtnText: { fontFamily: tokens.typography.rnFonts.bodySemibold, fontSize: 15, fontWeight: '600' },
});
