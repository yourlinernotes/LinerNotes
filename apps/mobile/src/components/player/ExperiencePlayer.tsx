/**
 * ExperiencePlayer — the Experience screen's audio engine.
 *
 * One controlled, ref-driven component that owns BOTH playback sources and
 * normalises them to a single status contract (position/duration in ms). The
 * parent drives it imperatively (play/pause/seekTo/toggle) and reads back
 * `onStatus` — so the lyric-sync logic upstream never has to know which source
 * is playing.
 *
 *   - SoundCloud (full track): a hidden WebView hosting the HTML5 Widget, which
 *     emits `PLAY_PROGRESS` (true ms position). Preferred when resolvable.
 *   - Preview (30s taste): expo-audio over the iTunes previewUrl. Fallback.
 *
 * See vault notes "SoundCloud Widget API" + "Audio Players (Web + RN)".
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

export type PlaybackSource = 'soundcloud' | 'preview' | 'none';

export interface PlaybackStatus {
  positionMs: number;
  durationMs: number;
  playing: boolean;
  source: PlaybackSource;
  ready: boolean;
  /** True once the source has finished (30s preview ended / track finished). */
  finished?: boolean;
}

export interface ExperiencePlayerHandle {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Seek to an absolute position in milliseconds. */
  seekTo: (ms: number) => void;
}

interface Props {
  /** Resolved SoundCloud track id (numeric string). Preferred source. */
  soundcloudTrackId?: string | null;
  /** iTunes 30s preview URL. Fallback source. */
  previewUrl?: string | null;
  onStatus?: (s: PlaybackStatus) => void;
  onReady?: (source: PlaybackSource) => void;
  onError?: () => void;
}

/** HTML that hosts the SoundCloud HTML5 Widget and bridges its position to RN. */
function widgetHtml(trackId: string): string {
  const src =
    'https://w.soundcloud.com/player/?url=' +
    encodeURIComponent('https://api.soundcloud.com/tracks/' + trackId) +
    '&auto_play=false&visual=false&show_artwork=false&buying=false&sharing=false&download=false&show_comments=false';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}iframe{width:100%;height:100%;border:0}</style>
</head><body>
<iframe id="sc" allow="autoplay" src="${src}"></iframe>
<script src="https://w.soundcloud.com/player/api.js"></script>
<script>
  var post = function(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} };
  var w = SC.Widget(document.getElementById('sc'));
  var E = SC.Widget.Events;
  var dur = 0;
  w.bind(E.READY, function(){
    w.getDuration(function(d){ dur = d || 0; post({type:'ready', durationMs: dur}); });
  });
  w.bind(E.PLAY_PROGRESS, function(e){ post({type:'progress', positionMs: e.currentPosition, durationMs: dur}); });
  w.bind(E.PLAY,   function(){ post({type:'playing', playing:true}); });
  w.bind(E.PAUSE,  function(){ post({type:'playing', playing:false}); });
  w.bind(E.FINISH, function(){ post({type:'finished'}); });
  w.bind(E.ERROR,  function(){ post({type:'error'}); });
  // Imperative bridge — RN calls window.__sc(cmd, arg).
  window.__sc = function(cmd, arg){
    if(cmd==='play') w.play();
    else if(cmd==='pause') w.pause();
    else if(cmd==='seek') w.seekTo(arg);   // ms
    else if(cmd==='toggle') w.toggle();
  };
</script></body></html>`;
}

export const ExperiencePlayer = forwardRef<ExperiencePlayerHandle, Props>(
  function ExperiencePlayer(
    { soundcloudTrackId, previewUrl, onStatus, onReady, onError },
    ref,
  ) {
    const source: PlaybackSource = soundcloudTrackId
      ? 'soundcloud'
      : previewUrl
        ? 'preview'
        : 'none';

    // ---- Preview (expo-audio). Always call the hook (rules of hooks). ----
    const previewSource = useMemo(
      () => (source === 'preview' && previewUrl ? { uri: previewUrl } : null),
      [source, previewUrl],
    );
    const player = useAudioPlayer(previewSource);
    const previewStatus = useAudioPlayerStatus(player);

    // Route audio to the speaker even when the ringer is on silent (iOS).
    useEffect(() => {
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }, []);

    // ---- SoundCloud (WebView) ----
    const webRef = useRef<WebView>(null);
    const sc = useCallback((cmd: string, arg?: number) => {
      webRef.current?.injectJavaScript(
        `window.__sc && window.__sc(${JSON.stringify(cmd)}${arg != null ? ',' + arg : ''}); true;`,
      );
    }, []);

    // ---- Imperative handle (unified controls) ----
    useImperativeHandle(
      ref,
      () => ({
        play: () => (source === 'soundcloud' ? sc('play') : player.play()),
        pause: () => (source === 'soundcloud' ? sc('pause') : player.pause()),
        toggle: () =>
          source === 'soundcloud'
            ? sc('toggle')
            : previewStatus.playing
              ? player.pause()
              : player.play(),
        seekTo: (ms: number) =>
          source === 'soundcloud' ? sc('seek', Math.max(0, ms)) : player.seekTo(ms / 1000),
      }),
      [source, sc, player, previewStatus.playing],
    );

    // ---- Report preview status upward (normalise s → ms) ----
    useEffect(() => {
      if (source !== 'preview') return;
      onStatus?.({
        source: 'preview',
        positionMs: (previewStatus.currentTime ?? 0) * 1000,
        durationMs: (previewStatus.duration ?? 0) * 1000,
        playing: !!previewStatus.playing,
        ready: !!previewStatus.isLoaded,
        finished: previewStatus.didJustFinish,
      });
    }, [
      source,
      previewStatus.currentTime,
      previewStatus.duration,
      previewStatus.playing,
      previewStatus.isLoaded,
      previewStatus.didJustFinish,
      onStatus,
    ]);

    useEffect(() => {
      if (source === 'preview' && previewStatus.isLoaded) onReady?.('preview');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, previewStatus.isLoaded]);

    // ---- SoundCloud message bridge ----
    const onMessage = useCallback(
      (e: WebViewMessageEvent) => {
        let m: any;
        try {
          m = JSON.parse(e.nativeEvent.data);
        } catch {
          return;
        }
        if (m.type === 'ready') {
          onReady?.('soundcloud');
          onStatus?.({
            source: 'soundcloud',
            positionMs: 0,
            durationMs: m.durationMs ?? 0,
            playing: false,
            ready: true,
          });
        } else if (m.type === 'progress') {
          onStatus?.({
            source: 'soundcloud',
            positionMs: m.positionMs ?? 0,
            durationMs: m.durationMs ?? 0,
            playing: true,
            ready: true,
          });
        } else if (m.type === 'playing') {
          onStatus?.({
            source: 'soundcloud',
            positionMs: 0,
            durationMs: 0,
            playing: !!m.playing,
            ready: true,
          });
        } else if (m.type === 'finished') {
          onStatus?.({
            source: 'soundcloud',
            positionMs: 0,
            durationMs: 0,
            playing: false,
            ready: true,
            finished: true,
          });
        } else if (m.type === 'error') {
          onError?.();
        }
      },
      [onReady, onStatus, onError],
    );

    if (source !== 'soundcloud' || !soundcloudTrackId) return null;

    // Hidden — we only want the audio + position, not the SoundCloud UI.
    return (
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          ref={webRef}
          source={{ html: widgetHtml(soundcloudTrackId) }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          onMessage={onMessage}
          onError={() => onError?.()}
          // A tiny offscreen surface keeps the widget alive without showing it.
          style={styles.web}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -10,
    left: -10,
  },
  web: { width: 1, height: 1, backgroundColor: 'transparent' },
});
