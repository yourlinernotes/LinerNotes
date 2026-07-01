/**
 * PreviewButton — a small round play/pause for a 30s snippet, as a memory aid.
 *
 * Resolves a browser/native-playable preview from /api/preview (Deezer MP3
 * first) by track + artist, and plays it inline with expo-audio. Used on the
 * asking-prompt cards (and reusable elsewhere) so you can refresh your memory of
 * a song before deciding to write.
 */
import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Icon } from './Icon';
import { API_BASE_URL } from '../../lib/api-client';
import { tokens } from '../../lib/tokens';

type State = 'idle' | 'loading' | 'playing' | 'unavailable';

export function PreviewButton({
  track,
  artist,
  color = tokens.colors.gold,
  size = 30,
}: {
  track?: string;
  artist?: string;
  color?: string;
  size?: number;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [state, setState] = useState<State>('idle');
  const wantPlay = useRef(false);

  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Once the resolved source is loaded, start playback.
  useEffect(() => {
    if (uri && wantPlay.current && status.isLoaded) {
      wantPlay.current = false;
      player.play();
      setState('playing');
    }
  }, [uri, status.isLoaded, player]);

  // Reset when the snippet finishes.
  useEffect(() => {
    if (status.didJustFinish) setState('idle');
  }, [status.didJustFinish]);

  const onPress = async () => {
    if (state === 'loading') return;
    if (state === 'playing') {
      player.pause();
      setState('idle');
      return;
    }
    if (uri) {
      player.seekTo(0);
      player.play();
      setState('playing');
      return;
    }
    if (!track) return;
    setState('loading');
    try {
      const q = new URLSearchParams({ track, artist: artist || '' });
      const res = await fetch(`${API_BASE_URL}/preview?${q}`);
      const { preview } = res.ok ? await res.json() : { preview: null };
      if (!preview?.previewUrl) {
        setState('unavailable');
        return;
      }
      wantPlay.current = true;
      setUri(preview.previewUrl);
    } catch {
      setState('unavailable');
    }
  };

  const disabled = state === 'unavailable';
  const isPlaying = state === 'playing';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: `${color}55`,
          backgroundColor: isPlaying ? color : `${color}1a`,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={color} />
      ) : isPlaying ? (
        <Icon name="pause" size={size * 0.42} color={tokens.colors.nearBlack} />
      ) : (
        <View style={{ marginLeft: 1 }}>
          <Icon name="play" size={size * 0.42} color={color} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
