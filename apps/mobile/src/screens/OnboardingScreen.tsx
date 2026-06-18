/**
 * LinerNotes Onboarding Screen
 * Two-step profile creation: (1) identity, (2) Last.fm connect (optional)
 * Based on Claude Design handoff: onboarding.jsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle } from 'react-native-svg';
import { lastfm } from '../services/lastfm';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { tokens } from '../lib/tokens';

// Warm gradient colors for auth screens
const AUTH_COLORS = {
  deep: '#1a1512',
  mid: '#2a1f18',
  lo: '#1a1512',
  accent: tokens.colors.gold,
  glow: '#c8a45c',
};

const COLORS = {
  gold: tokens.colors.gold,
  confirmGreen: '#7fcf9b',
  fg: tokens.colors.fg,
  bg: tokens.colors.nearBlack,
};

type OnboardingStep = 1 | 2 | 3;
type LastFmStatus = 'idle' | 'linking' | 'linked';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [lastFmStatus, setLastFmStatus] = useState<LastFmStatus>('idle');
  const [lastFmUsername, setLastFmUsername] = useState('');
  const [top4, setTop4] = useState<Array<{ title: string; artist: string }>>([
    { title: '', artist: '' },
    { title: '', artist: '' },
    { title: '', artist: '' },
    { title: '', artist: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const updateTop4 = (index: number, field: 'title' | 'artist', value: string) => {
    setTop4((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  // Handle validation
  const handleClean = handle.replace(/[^a-z0-9._]/gi, '').toLowerCase();
  const handleOk = handleClean.length >= 3;
  const canContinue = displayName.trim().length >= 1 && handleOk;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const saveProfileData = async () => {
    try {
      setIsSaving(true);

      // Update user profile on backend
      await api.updateUser({
        handle: handleClean,
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        // TODO: Upload avatar image if provided
      });

      // Refresh user data in context
      await refreshUser();

      // Move to Last.fm connection step
      setStep(2);
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save profile. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const connectLastFm = async () => {
    if (lastFmStatus !== 'idle') return;

    // Prompt for Last.fm username
    Alert.prompt(
      'Connect Last.fm',
      'Enter your Last.fm username to sync your listening history',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Connect',
          onPress: async (username?: string) => {
            if (!username || username.trim() === '') {
              return;
            }

            setLastFmStatus('linking');
            setLastFmUsername(username.trim());

            try {
              // Verify the username exists by fetching recent tracks
              const tracks = await lastfm.getRecentTracks(username.trim(), 1);

              if (tracks && tracks.length > 0) {
                setLastFmStatus('linked');

                // Save Last.fm username
                await lastfm.setUsername(username.trim());
              } else {
                setLastFmStatus('idle');
                Alert.alert('Error', 'Could not find that Last.fm username. Please check and try again.');
              }
            } catch (error) {
              setLastFmStatus('idle');
              Alert.alert('Error', 'Failed to connect to Last.fm. Please check the username and try again.');
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  // Persist any filled-in Top 4 albums, then finish. Always completes onboarding
  // even if saving fails — favourites are optional and editable later.
  const saveFavouritesAndFinish = async () => {
    const albums = top4
      .map((a) => ({ title: a.title.trim(), artist: a.artist.trim() }))
      .filter((a) => a.title && a.artist)
      .map((a, i) => ({ id: `fav-${i}`, name: a.title, artist: a.artist, artworkUrl: '' }));

    try {
      setIsSaving(true);
      if (albums.length > 0) {
        await api.updateUser({ favourites: { albums } });
        await refreshUser();
      }
    } catch (error) {
      console.error('Failed to save favourites:', error);
    } finally {
      setIsSaving(false);
      onComplete();
    }
  };

  return (
    <View style={styles.container}>
      {/* Warm flood background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[AUTH_COLORS.mid, AUTH_COLORS.deep, COLORS.bg]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`${AUTH_COLORS.glow}aa`, 'transparent']}
          locations={[0, 0.6]}
          start={{ x: 0.75, y: 0.08 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(8,7,6,0.2)', 'rgba(8,7,6,0.7)', COLORS.bg]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Header - brand + back button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setStep((s) => (s > 1 ? ((s - 1) as OnboardingStep) : s))}
          style={[styles.backButton, { opacity: step > 1 ? 1 : 0 }]}
          disabled={step === 1}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={COLORS.fg}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.brandName}>LinerNotes</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressSegment,
              { backgroundColor: step >= s ? COLORS.gold : 'rgba(241,235,224,0.14)' },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1 - Identity */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View>
                <Text style={styles.stepLabel}>SET UP · 1 OF 3</Text>
                <Text style={styles.heading}>
                  make yourself{'\n'}at home
                </Text>
                <Text style={styles.description}>
                  this is how friends will find you when you start logging.
                </Text>
              </View>

              {/* Avatar */}
              <View style={styles.avatarContainer}>
                <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                  <View style={styles.avatar}>
                    <View style={[styles.avatarCircle, { borderColor: `${COLORS.gold}66` }]}>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                      ) : displayName.trim() ? (
                        <Text style={styles.avatarMonogram}>
                          {displayName.trim()[0].toUpperCase()}
                        </Text>
                      ) : (
                        <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
                          <Circle cx={12} cy={8.5} r={3.6} stroke={COLORS.gold} strokeWidth={1.6} />
                          <Path
                            d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"
                            stroke={COLORS.gold}
                            strokeWidth={1.6}
                            strokeLinecap="round"
                          />
                        </Svg>
                      )}
                    </View>
                    <View style={styles.cameraBadge}>
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M3 8a2 2 0 012-2h1.5l1-2h7l1 2H18a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                          stroke={COLORS.bg}
                          strokeWidth={2}
                          strokeLinejoin="round"
                        />
                        <Circle cx={12} cy={12.5} r={3} stroke={COLORS.bg} strokeWidth={2} />
                      </Svg>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickImage}>
                  <Text style={styles.addPhotoButton}>Add a photo</Text>
                </TouchableOpacity>
              </View>

              {/* Form fields */}
              <View style={styles.formContainer}>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="what should we call you?"
                    placeholderTextColor="rgba(241,235,224,0.3)"
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>HANDLE</Text>
                  <View style={styles.handleInputContainer}>
                    <Text style={styles.atSymbol}>@</Text>
                    <TextInput
                      value={handleClean}
                      onChangeText={setHandle}
                      placeholder="yourname"
                      placeholderTextColor="rgba(241,235,224,0.3)"
                      autoCapitalize="none"
                      style={[styles.input, styles.handleInput]}
                    />
                    {handleClean.length > 0 && (
                      <View style={styles.validationBadge}>
                        {handleOk ? (
                          <>
                            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                              <Path
                                d="M5 13l4 4L19 7"
                                stroke={COLORS.confirmGreen}
                                strokeWidth={2.4}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                            <Text style={[styles.validationText, { color: COLORS.confirmGreen }]}>
                              available
                            </Text>
                          </>
                        ) : (
                          <Text style={[styles.validationText, { color: 'rgba(241,235,224,0.4)' }]}>
                            3+ characters
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>
                    BIO <Text style={{ opacity: 0.6 }}>· optional</Text>
                  </Text>
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="what do you listen for?"
                    placeholderTextColor="rgba(241,235,224,0.3)"
                    multiline
                    numberOfLines={2}
                    style={[styles.input, styles.bioInput]}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={saveProfileData}
                disabled={!canContinue || isSaving}
                style={[
                  styles.continueButton,
                  {
                    backgroundColor: (canContinue && !isSaving) ? COLORS.gold : 'rgba(241,235,224,0.12)',
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.continueButtonText,
                    { color: (canContinue && !isSaving) ? COLORS.bg : 'rgba(241,235,224,0.4)' },
                  ]}
                >
                  {isSaving ? 'Saving...' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2 - Last.fm */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View>
                <Text style={styles.stepLabel}>SET UP · 2 OF 3</Text>
                <Text style={styles.heading}>
                  connect your{'\n'}listening
                </Text>
                <Text style={[styles.description, { fontSize: 14.5, lineHeight: 21.75 }]}>
                  LinerNotes notices what you played, so when a song hits, the note is already
                  half-written. it's the easiest way to start.
                </Text>
              </View>

              {/* Last.fm card */}
              <View
                style={[
                  styles.lastFmCard,
                  {
                    borderColor:
                      lastFmStatus === 'linked'
                        ? `${COLORS.confirmGreen}55`
                        : 'rgba(241,235,224,0.12)',
                  },
                ]}
              >
                {/* Equalizer header */}
                <LinearGradient
                  colors={
                    lastFmStatus === 'linked'
                      ? ['rgba(127,207,155,0.16)', 'transparent']
                      : ['rgba(217,178,90,0.14)', 'transparent']
                  }
                  locations={[0, 0.7]}
                  style={styles.equalizerHeader}
                >
                  <View style={styles.equalizerBars}>
                    {Array.from({ length: 11 }).map((_, i) => (
                      <EqualizerBar
                        key={i}
                        index={i}
                        status={lastFmStatus}
                        color={
                          lastFmStatus === 'linked'
                            ? COLORS.confirmGreen
                            : lastFmStatus === 'linking'
                              ? COLORS.gold
                              : 'rgba(241,235,224,0.22)'
                        }
                      />
                    ))}
                  </View>
                </LinearGradient>

                <View style={styles.lastFmContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={styles.lastFmTitle}>Last.fm</Text>
                    <Text
                      style={[
                        styles.lastFmSubtitle,
                        {
                          color:
                            lastFmStatus === 'linked'
                              ? COLORS.confirmGreen
                              : 'rgba(241,235,224,0.45)',
                        },
                      ]}
                    >
                      {lastFmStatus === 'linked' ? 'CONNECTED' : 'SCROBBLE SYNC'}
                    </Text>
                  </View>
                  <Text style={styles.lastFmDescription}>
                    {lastFmStatus === 'linked'
                      ? "nice. we'll quietly follow what you play, and surface it the moment you sit down to write."
                      : 'we line up what you played, so the words come easier.'}
                  </Text>

                  <TouchableOpacity
                    onPress={lastFmStatus === 'linked' ? () => setStep(3) : connectLastFm}
                    disabled={lastFmStatus === 'linking'}
                    style={[
                      styles.lastFmButton,
                      {
                        backgroundColor:
                          lastFmStatus === 'linking' ? 'rgba(241,235,224,0.12)' : COLORS.gold,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.lastFmButtonText,
                        {
                          color:
                            lastFmStatus === 'linking' ? 'rgba(241,235,224,0.6)' : COLORS.bg,
                        },
                      ]}
                    >
                      {lastFmStatus === 'linked'
                        ? 'Continue'
                        : lastFmStatus === 'linking'
                          ? 'Connecting…'
                          : 'Connect Last.fm'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Skip button */}
              {lastFmStatus !== 'linked' && (
                <View style={styles.skipContainer}>
                  <TouchableOpacity onPress={() => setStep(3)} activeOpacity={0.8}>
                    <Text style={styles.skipButton}>I'll connect later</Text>
                  </TouchableOpacity>
                  <Text style={styles.skipDescription}>
                    you can link it anytime from your profile. nothing here needs it.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* STEP 3 - Top 4 favourites */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <View>
                <Text style={styles.stepLabel}>SET UP · 3 OF 3</Text>
                <Text style={styles.heading}>
                  your top{'\n'}four
                </Text>
                <Text style={styles.description}>
                  four albums that are you — we'll nudge you to write about them. skip it and add
                  them anytime from your profile.
                </Text>
              </View>

              <View style={styles.top4List}>
                {top4.map((album, i) => (
                  <View key={i} style={styles.top4Row}>
                    <Text style={styles.top4Number}>{i + 1}</Text>
                    <View style={styles.top4Inputs}>
                      <TextInput
                        value={album.title}
                        onChangeText={(t) => updateTop4(i, 'title', t)}
                        placeholder="album"
                        placeholderTextColor="rgba(241,235,224,0.3)"
                        style={[styles.input, styles.top4Input]}
                      />
                      <TextInput
                        value={album.artist}
                        onChangeText={(t) => updateTop4(i, 'artist', t)}
                        placeholder="artist"
                        placeholderTextColor="rgba(241,235,224,0.3)"
                        style={[styles.input, styles.top4Input]}
                      />
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={saveFavouritesAndFinish}
                disabled={isSaving}
                style={[
                  styles.continueButton,
                  { backgroundColor: isSaving ? 'rgba(241,235,224,0.12)' : COLORS.gold },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.continueButtonText,
                    { color: isSaving ? 'rgba(241,235,224,0.4)' : COLORS.bg },
                  ]}
                >
                  {isSaving ? 'Saving…' : 'Finish'}
                </Text>
              </TouchableOpacity>

              <View style={styles.skipContainer}>
                <TouchableOpacity onPress={onComplete} activeOpacity={0.8} disabled={isSaving}>
                  <Text style={styles.skipButton}>I'll add later</Text>
                </TouchableOpacity>
                <Text style={styles.skipDescription}>
                  top four prompts only show up once you've filled them in.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Animated equalizer bar component
function EqualizerBar({
  index,
  status,
  color,
}: {
  index: number;
  status: LastFmStatus;
  color: string;
}) {
  const animatedHeight = React.useRef(new Animated.Value(30 + Math.abs(Math.sin(index * 0.9)) * 50)).current;

  React.useEffect(() => {
    if (status !== 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedHeight, {
            toValue: 80,
            duration: (500 + (index % 4) * 180),
            delay: index * 50,
            useNativeDriver: false,
          }),
          Animated.timing(animatedHeight, {
            toValue: 30 + Math.abs(Math.sin(index * 0.9)) * 50,
            duration: (500 + (index % 4) * 180),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      animatedHeight.setValue(30 + Math.abs(Math.sin(index * 0.9)) * 50);
    }
  }, [status, index, animatedHeight]);

  const heightPercentage = animatedHeight.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={{
        width: 4,
        height: heightPercentage,
        borderRadius: 2,
        backgroundColor: color,
        ...(status === 'linked' && {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
        }),
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 26,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 19,
    color: COLORS.fg,
    letterSpacing: -0.19,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 26,
    paddingTop: 18,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingBottom: 28,
  },
  stepContainer: {
    flex: 1,
    paddingTop: 26,
    gap: 22,
  },
  stepLabel: {
    fontFamily: 'System',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.gold,
  },
  heading: {
    marginTop: 10,
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 30,
    lineHeight: 33.6,
    color: COLORS.fg,
    letterSpacing: -0.3,
  },
  description: {
    marginTop: 10,
    maxWidth: 300,
    fontFamily: 'System',
    fontSize: 14,
    lineHeight: 20.3,
    color: 'rgba(241,235,224,0.6)',
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 9,
    marginVertical: 4,
  },
  avatar: {
    position: 'relative',
    width: 88,
    height: 88,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    backgroundColor: `${COLORS.gold}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMonogram: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 38,
    color: COLORS.gold,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 31,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gold,
  },
  formContainer: {
    gap: 14,
  },
  fieldContainer: {
    gap: 7,
  },
  fieldLabel: {
    fontFamily: 'System',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: 'rgba(241,235,224,0.5)',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(241,235,224,0.07)',
    color: COLORS.fg,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.16)',
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontFamily: 'System',
    fontSize: 15,
  },
  top4List: {
    gap: 12,
  },
  top4Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  top4Number: {
    fontFamily: 'Space Mono',
    fontSize: 16,
    color: COLORS.gold,
    width: 16,
    textAlign: 'center',
  },
  top4Inputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  top4Input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
  },
  handleInputContainer: {
    position: 'relative',
  },
  handleInput: {
    paddingLeft: 29,
    paddingRight: 96,
    fontFamily: 'Courier',
  },
  atSymbol: {
    position: 'absolute',
    left: 14,
    top: 14,
    fontFamily: 'Courier',
    fontSize: 15,
    color: 'rgba(241,235,224,0.45)',
    zIndex: 1,
  },
  validationBadge: {
    position: 'absolute',
    right: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  validationText: {
    fontFamily: 'Courier',
    fontSize: 10.5,
    letterSpacing: 0.21,
  },
  bioInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  continueButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  continueButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
  },
  lastFmCard: {
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(241,235,224,0.04)',
    overflow: 'hidden',
  },
  equalizerHeader: {
    height: 110,
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 28,
  },
  equalizerBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  lastFmContent: {
    padding: 18,
    gap: 6,
  },
  lastFmTitle: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.fg,
  },
  lastFmSubtitle: {
    fontFamily: 'Courier',
    fontSize: 9.5,
    letterSpacing: 0.95,
    textTransform: 'uppercase',
  },
  lastFmDescription: {
    fontFamily: 'System',
    fontSize: 12.5,
    lineHeight: 18.125,
    color: 'rgba(241,235,224,0.55)',
    marginBottom: 10,
  },
  lastFmButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
  },
  lastFmButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
  },
  skipContainer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  skipButton: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(241,235,224,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipDescription: {
    marginTop: 8,
    maxWidth: 268,
    fontFamily: 'Courier',
    fontSize: 10,
    lineHeight: 15,
    color: 'rgba(241,235,224,0.38)',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
