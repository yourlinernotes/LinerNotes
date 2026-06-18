/**
 * Asking Engine - Generates "worth a note" prompts from real listening behavior
 * Based on LINERNOTES_AskingEngine_v0_Update.md
 *
 * Trigger priority (by revealed caring):
 * 1. Top 4 placements (deliberate declarations)
 * 2. Strong live-listening signals (repeat, full-album, return-after-gap, release-day)
 * 3. Incidental/discovery listening (single pass on something new)
 *
 * NO homework prompts - build around acts the user took, not gaps they left
 */

import { lastfm, LastFmTrack } from './lastfm';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_PROMPTS_KEY = '@linernotes:dismissed_prompts';
const LAST_PROMPT_TIME_KEY = '@linernotes:last_prompt_time';

export interface PromptTrigger {
  id: string;
  type: 'top4' | 'repeat' | 'full-album' | 'release-day' | 'return-after-gap' | 'new-artist' | 'heavy-unrated';
  priority: number; // Lower = higher priority
  track?: string;
  artist: string;
  album?: string;
  playCount?: number;
  prompt: string;
  tag: string; // Mono label shown on card (e.g. "ON REPEAT", "TOP 4")
  palette: {
    deep: string;
    mid: string;
    lo: string;
    accent: string;
    glow: string;
  };
}

class AskingEngineService {
  private dismissedPrompts: Set<string> = new Set();
  private lastPromptTime: number = 0;

  async initialize() {
    // Load dismissed prompts
    const dismissed = await AsyncStorage.getItem(DISMISSED_PROMPTS_KEY);
    if (dismissed) {
      this.dismissedPrompts = new Set(JSON.parse(dismissed));
    }

    // Load last prompt time
    const lastTime = await AsyncStorage.getItem(LAST_PROMPT_TIME_KEY);
    if (lastTime) {
      this.lastPromptTime = parseInt(lastTime, 10);
    }
  }

  /**
   * Generate prompts from Last.fm data for a user
   * Returns the highest-priority prompt that hasn't been dismissed
   */
  async generatePrompts(username: string, top4Albums?: any[]): Promise<PromptTrigger | null> {
    await this.initialize();

    // Cooldown applies to notifications only (max one per ~12h).
    const hoursSinceLastPrompt = (Date.now() - this.lastPromptTime) / (1000 * 60 * 60);
    if (hoursSinceLastPrompt < 12) {
      return null;
    }

    const triggers = await this.buildTriggers(username, top4Albums);
    return triggers[0] || null;
  }

  /**
   * All available (non-dismissed) prompt triggers for the in-feed shelf.
   * No cooldown — the shelf should always surface what's worth a note, drawn
   * from the profile's Top 4 and/or connected Last.fm activity.
   */
  async getFeedPrompts(username?: string, top4Albums?: any[]): Promise<PromptTrigger[]> {
    await this.initialize();
    return this.buildTriggers(username, top4Albums);
  }

  private async buildTriggers(username?: string, top4Albums?: any[]): Promise<PromptTrigger[]> {
    const allTriggers: PromptTrigger[] = [];

    // TIER 1: Top 4 prompts (highest priority)
    if (top4Albums && top4Albums.length > 0) {
      for (const album of top4Albums) {
        const triggerId = `top4:${album.artist}:${album.title}`;
        if (!this.dismissedPrompts.has(triggerId)) {
          allTriggers.push({
            id: triggerId,
            type: 'top4',
            priority: 1,
            artist: album.artist,
            album: album.title,
            prompt: this.getTop4Prompt(album.title),
            tag: 'TOP 4',
            palette: album.palette || this.getDefaultPalette(),
          });
        }
      }
    }

    // TIER 2 requires a connected Last.fm account; without it, return Tier-1 only.
    if (!username) {
      allTriggers.sort((a, b) => a.priority - b.priority);
      return allTriggers;
    }

    // TIER 2: Live listening signals from Last.fm
    try {
      // Get recent tracks (last 200 to analyze patterns)
      const recentTracks = await lastfm.getRecentTracks(username, 200);

      // Get top tracks this week
      const topTracksWeek = await lastfm.getTopTracks(username, '7day', 50);

      // Detect repeats (3+ plays in recent history)
      const trackCounts = this.countRecentPlays(recentTracks);
      for (const [trackKey, count] of Object.entries(trackCounts)) {
        if (count >= 3) {
          const [artist, track] = trackKey.split('|||');
          const triggerId = `repeat:${artist}:${track}`;

          if (!this.dismissedPrompts.has(triggerId)) {
            allTriggers.push({
              id: triggerId,
              type: 'repeat',
              priority: 2,
              artist,
              track,
              playCount: count,
              prompt: this.getRepeatPrompt(track, count),
              tag: 'ON REPEAT',
              palette: this.getDefaultPalette(),
            });
          }
        }
      }

      // Detect full-album listens (analyze recent album plays)
      const albumPlays = this.detectFullAlbumListens(recentTracks);
      for (const album of albumPlays) {
        const triggerId = `full-album:${album.artist}:${album.album}`;

        if (!this.dismissedPrompts.has(triggerId)) {
          allTriggers.push({
            id: triggerId,
            type: 'full-album',
            priority: 2,
            artist: album.artist,
            album: album.album,
            prompt: this.getFullAlbumPrompt(album.album),
            tag: 'FULL ALBUM',
            palette: this.getDefaultPalette(),
          });
        }
      }

      // Heavy plays but unrated (20+ plays)
      for (const topTrack of topTracksWeek.slice(0, 10)) {
        const playCount = parseInt((topTrack as any).playcount || '0', 10);
        // Last.fm top-tracks artist is an object ({ name }); guard for strings too.
        const artistName =
          typeof topTrack.artist === 'string' ? topTrack.artist : topTrack.artist?.name || '';
        if (playCount >= 20) {
          const triggerId = `heavy-unrated:${artistName}:${topTrack.name}`;

          if (!this.dismissedPrompts.has(triggerId)) {
            allTriggers.push({
              id: triggerId,
              type: 'heavy-unrated',
              priority: 2,
              artist: artistName,
              track: topTrack.name,
              playCount,
              prompt: `${playCount} plays, no rating. verdict?`,
              tag: 'HEAVY PLAY',
              palette: this.getDefaultPalette(),
            });
          }
        }
      }

      // TODO (later): "deep dive" prompts — detect heavy play across an artist's
      // discography (many distinct tracks/albums from one artist) or repeated
      // full-discography listens, and prompt the user to write about the artist.
    } catch (error) {
      console.error('Failed to generate asking engine prompts:', error);
    }

    // Sort by priority (highest-priority first).
    allTriggers.sort((a, b) => a.priority - b.priority);
    return allTriggers;
  }

  /**
   * Count how many times each track appears in recent plays
   */
  private countRecentPlays(tracks: LastFmTrack[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const track of tracks) {
      const key = `${track.artist}|||${track.name}`;
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }

  /**
   * Detect full-album listens from track sequence
   */
  private detectFullAlbumListens(tracks: LastFmTrack[]): Array<{ artist: string; album: string }> {
    const albums: Array<{ artist: string; album: string }> = [];
    const albumTracks: Record<string, number> = {};

    // Count tracks per album in recent history
    for (const track of tracks) {
      if (track.album) {
        const albumName = typeof track.album === 'string' ? track.album : track.album['#text'];
        const key = `${track.artist}|||${albumName}`;
        albumTracks[key] = (albumTracks[key] || 0) + 1;
      }
    }

    // If we see 8+ tracks from same album, likely a full listen
    for (const [key, count] of Object.entries(albumTracks)) {
      if (count >= 8) {
        const [artist, album] = key.split('|||');
        albums.push({ artist, album });
      }
    }

    return albums.slice(0, 3); // Return top 3
  }

  /**
   * Prompt text generators (human-written bank)
   */
  private getTop4Prompt(album: string): string {
    const variants = [
      `Of everything, ${album}'s one of your four. Why this one?`,
      `${album} made your top 4. What earns it a spot?`,
      `You put ${album} on the wall. What's the story?`,
      `${album}, top 4. What does it do for you that others don't?`,
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  private getRepeatPrompt(track: string, count: number): string {
    const variants = [
      `You played ${track} ${count} times today. What's the bit you keep going back for?`,
      `${track} on loop again. Which part?`,
      `this one's been on repeat. what keeps pulling you back?`,
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  private getFullAlbumPrompt(album: string): string {
    const variants = [
      `you sat with the whole thing — what stayed?`,
      `full ${album} listen. which bit stayed with you?`,
      `You went through all of ${album}. What landed?`,
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  /**
   * Dismiss a prompt (won't show again)
   */
  async dismissPrompt(promptId: string) {
    this.dismissedPrompts.add(promptId);
    await AsyncStorage.setItem(
      DISMISSED_PROMPTS_KEY,
      JSON.stringify(Array.from(this.dismissedPrompts))
    );
  }

  /**
   * Mark that we showed a prompt (for cooldown)
   */
  async markPromptShown() {
    this.lastPromptTime = Date.now();
    await AsyncStorage.setItem(LAST_PROMPT_TIME_KEY, this.lastPromptTime.toString());
  }

  /**
   * Default palette for when we don't have album art
   */
  private getDefaultPalette() {
    return {
      deep: '#1a1512',
      mid: '#2a1f18',
      lo: '#1a1512',
      accent: '#d9b25a',
      glow: '#c8a45c',
    };
  }
}

export const askingEngine = new AskingEngineService();
