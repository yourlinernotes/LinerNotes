import { tokens } from '../lib/tokens';
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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../contexts/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TERMS_URL = 'https://beta-linernotes.vercel.app/terms';
const PRIVACY_URL = 'https://beta-linernotes.vercel.app/privacy';

type FieldErrors = { handle?: string; displayName?: string; email?: string; password?: string };

// Warm gradient colors for auth screens
const AUTH_COLORS = {
  deep: '#1a1512',
  mid: '#2a1f18',
  lo: '#1a1512',
  accent: tokens.colors.gold,
  glow: '#c8a45c',
};

export function LoginScreen() {
  const { login, signup, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Inline validation — replaces the old blocking "Please enter email and
  // password" Alerts with per-field messages shown under each input (the
  // report flagged the web signup for having no inline validation).
  function validate(): boolean {
    const e: FieldErrors = {};
    if (mode === 'signup' && !handle.trim()) e.handle = 'Choose a handle.';
    if (mode === 'signup' && !displayName.trim()) e.displayName = 'Enter a display name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Google OAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '985992092131-19g5d3fsgmb4riepda7a9s4eu133r8oj.apps.googleusercontent.com',
    iosClientId: '985992092131-ag9ohcq8t4d7dde659kqq343q5m6af47.apps.googleusercontent.com',
    webClientId: '985992092131-9e67ajva2nob5efot6bfj1asikhdrdml.apps.googleusercontent.com',
    scopes: ['openid', 'profile', 'email'],
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleAuth(response.authentication);
    }
  }, [response]);

  async function handleGoogleAuth(authentication: any) {
    try {
      setIsLoading(true);

      console.log('Google auth response:', JSON.stringify(authentication, null, 2));

      // expo-auth-session provides an idToken if configured correctly
      // Use the ID token for backend authentication
      const idToken = authentication?.idToken || authentication?.accessToken;

      if (!idToken) {
        throw new Error('No ID token or access token received from Google');
      }

      console.log('Sending token to backend...');
      const isAccessToken = !authentication?.idToken;
      console.log('Token type:', isAccessToken ? 'Access token' : 'ID token');
      console.log('Token (first 20 chars):', idToken.substring(0, 20));

      await loginWithGoogle(idToken, isAccessToken);

      console.log('Login successful!');
    } catch (error: any) {
      console.error('Google auth error:', error);
      Alert.alert(
        'Authentication Error',
        error.message || 'Failed to authenticate with Google. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEmailAuth() {
    if (!validate()) return;

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
          colors={[AUTH_COLORS.mid, AUTH_COLORS.deep, '#0a0908']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`${AUTH_COLORS.glow}aa`, 'transparent']}
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
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {/* Google Logo SVG */}
              <View style={styles.googleLogo}>
                <Text style={styles.googleLogoText}>G</Text>
              </View>
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
                <View>
                  <TextInput
                    style={[styles.input, errors.handle && styles.inputError]}
                    placeholder="Handle (e.g., anushaisawesome)"
                    placeholderTextColor="rgba(241,235,224,0.4)"
                    value={handle}
                    onChangeText={setHandle}
                    onBlur={() => setErrors((e) => ({ ...e, handle: handle.trim() ? undefined : 'Choose a handle.' }))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Handle"
                    accessibilityHint="Your unique @username on LinerNotes"
                  />
                  {errors.handle && <Text style={styles.fieldError}>{errors.handle}</Text>}
                </View>
                <View>
                  <TextInput
                    style={[styles.input, errors.displayName && styles.inputError]}
                    placeholder="Display Name"
                    placeholderTextColor="rgba(241,235,224,0.4)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    onBlur={() => setErrors((e) => ({ ...e, displayName: displayName.trim() ? undefined : 'Enter a display name.' }))}
                    autoCapitalize="words"
                    accessibilityLabel="Display name"
                  />
                  {errors.displayName && <Text style={styles.fieldError}>{errors.displayName}</Text>}
                </View>
              </>
            )}

            {/* Email & Password */}
            <View>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="you@email.com"
                placeholderTextColor="rgba(241,235,224,0.4)"
                value={email}
                onChangeText={setEmail}
                onBlur={() => setErrors((e) => ({ ...e, email: EMAIL_RE.test(email.trim()) ? undefined : 'Enter a valid email address.' }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                accessibilityLabel="Email address"
              />
              {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
            </View>

            <View>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Password"
                placeholderTextColor="rgba(241,235,224,0.4)"
                value={password}
                onChangeText={setPassword}
                onBlur={() => setErrors((e) => ({ ...e, password: password.length >= 6 ? undefined : 'Password must be at least 6 characters.' }))}
                secureTextEntry
                autoCapitalize="none"
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                accessibilityLabel="Password"
                accessibilityHint="At least 6 characters"
              />
              {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleEmailAuth}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={mode === 'signup' ? 'Create account' : 'Log in'}
            >
              {isLoading ? (
                <ActivityIndicator color={tokens.colors.nearBlack} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'signup' ? 'Create account' : 'Log in'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Consent — the report flagged the web signup for offering no
                Terms/Privacy disclosure before account creation. */}
            {mode === 'signup' && (
              <Text style={styles.consent}>
                By creating an account, you agree to our{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_URL)}>
                  Terms
                </Text>{' '}
                and{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                  Privacy Policy
                </Text>
                .
              </Text>
            )}

            {/* Toggle mode */}
            <View style={styles.toggleContainer}>
              <Text style={styles.togglePrompt}>
                {mode === 'signup' ? 'already here?' : 'new to LinerNotes?'}{' '}
              </Text>
              <TouchableOpacity
                onPress={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErrors({}); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.toggleButton}
                accessibilityRole="button"
                accessibilityLabel={mode === 'signup' ? 'Switch to log in' : 'Switch to sign up'}
              >
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
    ...StyleSheet.absoluteFill,
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
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontWeight: '600',
    fontSize: 34,
    color: tokens.colors.fg,
    letterSpacing: -0.34,
  },
  betaBadge: {
    borderWidth: 1,
    borderColor: `${AUTH_COLORS.accent}55`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4, // Raised up to match design
  },
  betaText: {
    fontFamily: tokens.typography.rnFonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.54,
    color: AUTH_COLORS.accent,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  promise: {
    fontFamily: tokens.typography.rnFonts.body,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 29.4,
    color: tokens.colors.fg,
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
    backgroundColor: tokens.colors.fg,
  },
  googleLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogoText: {
    fontFamily: tokens.typography.rnFonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
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
    fontFamily: tokens.typography.rnFonts.mono,
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(241,235,224,0.07)',
    color: tokens.colors.fg,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.16)',
    borderRadius: 13,
    padding: 14,
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 15,
  },
  inputError: {
    borderColor: 'rgba(220,38,38,0.6)',
  },
  fieldError: {
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 12.5,
    color: '#ffb4b4',
    marginTop: 6,
    marginLeft: 2,
  },
  submitButton: {
    width: '100%',
    padding: 14,
    borderRadius: 13,
    backgroundColor: AUTH_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  consent: {
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(241,235,224,0.5)',
    textAlign: 'center',
    marginTop: 2,
  },
  consentLink: {
    color: AUTH_COLORS.accent,
    textDecorationLine: 'underline',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  togglePrompt: {
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 13,
    color: 'rgba(241,235,224,0.6)',
  },
  toggleLink: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 13,
    fontWeight: '600',
    color: AUTH_COLORS.accent,
  },
  disclaimer: {
    fontFamily: tokens.typography.rnFonts.mono,
    fontSize: 10,
    lineHeight: 15,
    color: 'rgba(241,235,224,0.38)',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 10,
  },
});
