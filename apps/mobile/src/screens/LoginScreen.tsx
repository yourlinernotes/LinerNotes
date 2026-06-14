/**
 * LinerNotes Login/Signup Screen
 * Google OAuth + email/password auth
 * Based on Claude Design handoff: login.jsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../contexts/AuthContext';
import { tokens } from '@linernotes/core';

WebBrowser.maybeCompleteAuthSession();

const TURMERIC_PALETTE = {
  deep: '#23160a',
  mid: '#7a4a16',
  lo: '#3a1d0a',
  accent: '#e8a13a',
  glow: '#c97a1f',
};

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Google OAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: 'YOUR_EXPO_CLIENT_ID',
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      // Handle Google OAuth success
      console.log('Google OAuth successful:', authentication);
      // TODO: Send token to backend
    }
  }, [response]);

  async function handleEmailAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (mode === 'signup' && (!handle || !displayName)) {
      Alert.alert('Error', 'Please enter handle and display name');
      return;
    }

    try {
      setIsLoading(true);
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, handle, displayName);
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Authentication failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Warm flood background */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={[TURMERIC_PALETTE.mid, TURMERIC_PALETTE.deep, '#0a0908']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`${TURMERIC_PALETTE.glow}aa`, 'transparent']}
          locations={[0, 0.6]}
          style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
        />
        <LinearGradient
          colors={['rgba(8,7,6,0.2)', 'rgba(8,7,6,0.7)', '#0a0908']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand + promise */}
          <View style={styles.brandContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>LinerNotes</Text>
              <View style={styles.betaBadge}>
                <Text style={styles.betaText}>BETA</Text>
              </View>
            </View>
            <Text style={styles.promise}>
              the moment a song hit you, captured while you're in it.
            </Text>
          </View>

          {/* Auth forms */}
          <View style={styles.authContainer}>
            {/* Google OAuth Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => promptAsync()}
              disabled={!request || isLoading}
            >
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Signup fields */}
            {mode === 'signup' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Handle (e.g., anushaisawesome)"
                  placeholderTextColor="rgba(241,235,224,0.4)"
                  value={handle}
                  onChangeText={setHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Display Name"
                  placeholderTextColor="rgba(241,235,224,0.4)"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </>
            )}

            {/* Email & Password */}
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor="rgba(241,235,224,0.4)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(241,235,224,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleEmailAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={tokens.colors.nearBlack} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'signup' ? 'Create account' : 'Log in'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle mode */}
            <View style={styles.toggleContainer}>
              <Text style={styles.togglePrompt}>
                {mode === 'signup' ? 'already here?' : 'new to LinerNotes?'}{' '}
              </Text>
              <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
                <Text style={styles.toggleLink}>
                  {mode === 'signup' ? 'log in' : 'sign up'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Disclaimer */}
            <Text style={styles.disclaimer}>
              no spotify or last.fm account needed. connect your listening later, once you feel the
              product.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0908',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingBottom: 32,
  },
  brandContainer: {
    paddingTop: 96,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  brandTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 34,
    color: tokens.colors.cream,
    letterSpacing: -0.34,
  },
  betaBadge: {
    borderWidth: 1,
    borderColor: `${TURMERIC_PALETTE.accent}55`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: -6,
  },
  betaText: {
    fontFamily: 'System',
    fontSize: 11,
    letterSpacing: 1.54,
    color: TURMERIC_PALETTE.accent,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  promise: {
    fontFamily: 'System',
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 29.4,
    color: tokens.colors.cream,
    textAlign: 'center',
    maxWidth: 290,
    marginTop: 20,
  },
  authContainer: {
    marginTop: 'auto',
    paddingTop: 40,
    gap: 11,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: 14,
    borderRadius: 13,
    backgroundColor: tokens.colors.cream,
  },
  googleButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1714',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(241,235,224,0.14)',
  },
  dividerText: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(241,235,224,0.07)',
    color: tokens.colors.cream,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.16)',
    borderRadius: 13,
    padding: 14,
    fontFamily: 'System',
    fontSize: 15,
  },
  submitButton: {
    width: '100%',
    padding: 14,
    borderRadius: 13,
    backgroundColor: TURMERIC_PALETTE.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  togglePrompt: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.6)',
  },
  toggleLink: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: TURMERIC_PALETTE.accent,
  },
  disclaimer: {
    fontFamily: 'Menlo',
    fontSize: 10,
    lineHeight: 15,
    color: 'rgba(241,235,224,0.38)',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 10,
  },
});
