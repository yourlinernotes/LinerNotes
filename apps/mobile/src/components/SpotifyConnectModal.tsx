/**
 * SpotifyConnectModal — capture the user's Spotify web-session cookie (sp_dc)
 * via an in-app login, so they get the asking engine WITHOUT a Last.fm account
 * (no client_id, no 5-user dev cap). EXPERIMENTAL — see vault "Listening History
 * & Scrobbling".
 *
 * How it works: load Spotify's web login in a WebView; once the user lands back
 * on open.spotify.com (logged in), read the `sp_dc` cookie from the native
 * cookie store (it's HttpOnly, so JS can't read it — CookieManager can) and save
 * it to our backend. We never see their password; we only read the session
 * cookie their own login set.
 */
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import { Icon } from './atoms/Icon';
import { tokens } from '../lib/tokens';
import { api } from '../lib/api-client';

const LOGIN_URL = 'https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F';
const F = tokens.typography.rnFonts;
const C = tokens.colors;

export function SpotifyConnectModal({
  visible,
  onClose,
  onConnected,
}: {
  visible: boolean;
  onClose: () => void;
  onConnected?: () => void;
}) {
  const [status, setStatus] = useState<'login' | 'saving' | 'done' | 'error'>('login');
  const captured = useRef(false);

  const tryCapture = async () => {
    if (captured.current) return;
    try {
      // HttpOnly cookie — only the native store has it.
      const cookies = await CookieManager.get('https://spotify.com', true);
      const spDc = cookies?.sp_dc?.value;
      if (!spDc) return; // not logged in yet
      captured.current = true;
      setStatus('saving');
      await api.connectSpotifySpDc(spDc);
      setStatus('done');
      setTimeout(() => {
        onConnected?.();
        onClose();
      }, 1100);
    } catch {
      captured.current = false;
      setStatus('error');
    }
  };

  const onNav = (nav: WebViewNavigation) => {
    // Once the login redirects back to the web player, the cookie is set.
    if (/open\.spotify\.com/.test(nav.url) && !nav.loading) {
      tryCapture();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <Icon name="close" size={20} color={C.fg} />
          </TouchableOpacity>
          <Text style={styles.title}>Connect Spotify</Text>
          <View style={{ width: 38 }} />
        </View>

        {status === 'login' ? (
          <>
            <Text style={styles.hint}>
              Log in to Spotify below. We only read the session your login creates — never your password.
            </Text>
            <WebView
              source={{ uri: LOGIN_URL }}
              onNavigationStateChange={onNav}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              style={{ flex: 1 }}
            />
          </>
        ) : (
          <View style={styles.center}>
            {status === 'saving' && (
              <>
                <ActivityIndicator size="large" color={C.gold} />
                <Text style={styles.centerText}>Connecting…</Text>
              </>
            )}
            {status === 'done' && (
              <Text style={[styles.centerText, { color: C.confirmGreen }]}>Connected ✓</Text>
            )}
            {status === 'error' && (
              <>
                <Text style={styles.centerText}>Couldn’t connect. Try again.</Text>
                <TouchableOpacity onPress={() => setStatus('login')} style={styles.retry}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(241,235,224,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: F.bodySemibold, fontSize: 16, color: C.fg },
  hint: {
    fontFamily: F.body,
    fontSize: 12.5,
    color: C.muted,
    paddingHorizontal: 20,
    paddingBottom: 12,
    lineHeight: 17,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  centerText: { fontFamily: F.body, fontSize: 15, color: C.fg },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${C.gold}55`,
    backgroundColor: `${C.gold}1a`,
  },
  retryText: { fontFamily: F.bodySemibold, fontSize: 14, color: C.gold },
});
