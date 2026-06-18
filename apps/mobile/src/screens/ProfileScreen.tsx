import { tokens } from '../lib/tokens';
/**
 * LinerNotes Profile Screen
 * User profile with favourites, recent ratings, and notes/saved tabs
 * Based on Claude Design handoff: profile.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReviewCard } from '../components/ReviewCard';
import { Icon } from '../components/atoms/Icon';
import { Avatar } from '../components/atoms/Avatar';
import { Stars } from '../components/atoms/Stars';
import { formatRelativeTime } from '../lib/time-utils';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { shareToInstagramStory, shareToTikTok, shareToTwitter, saveCardImage } from '../lib/share-utils';
import type { Review } from '../lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AlbumEntry {
  album: any;
  rating: number;
}

interface ProfileData {
  user: {
    id: string;
    name: string;
    handle: string;
    tint: string;
  };
  bio: string;
  reviewCount: number;
  friends: number;
  joined: string;
  top4: AlbumEntry[];
  thisWeek: AlbumEntry[];
  reviews: Review[];
  reposted: Review[];
  saved: Review[];
}

type TabType = 'notes' | 'saved';

export function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<TabType>('notes');
  const gold = '#d9b25a';
  const top4CardRef = useRef(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    if (!user) return;

    try {
      // Load user reviews
      const reviews = await api.getUserReviews(user.id);

      // Load saved reviews
      const saved = await api.getSavedReviews();

      const profileData: ProfileData = {
        user: {
          id: user.id,
          name: user.displayName || user.name || 'User',
          handle: user.handle || 'user',
          tint: '#d9b25a',
        },
        bio: user.bio || '',
        reviewCount: reviews.length,
        friends: 0, // Will be populated when friends feature is implemented
        joined: new Date(user.createdAt || Date.now()).getFullYear().toString(),
        top4: [], // Will be populated when top albums feature is implemented
        thisWeek: [], // Will be populated when this week feature is implemented
        reviews,
        reposted: [], // Will be populated when reposts feature is implemented
        saved,
      };

      setProfile(profileData);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }

  const handleShareTop4 = async () => {
    if (!top4CardRef.current) return;

    // Show share options for Top 4 card
    Alert.alert(
      'Share your Top 4',
      'Export as sticker to story or camera roll',
      [
        {
          text: 'Camera Roll',
          onPress: () => saveCardImage(top4CardRef.current),
        },
        {
          text: 'Instagram',
          onPress: () => shareToInstagramStory(top4CardRef.current),
        },
        {
          text: 'TikTok',
          onPress: () => shareToTikTok(top4CardRef.current),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const notesList = [
    ...profile.reposted.map((r) => ({ review: r, kind: 'repost' as const })),
    ...profile.reviews.map((r) => ({ review: r, kind: 'own' as const })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { backgroundColor: `${profile.user.tint}22`, borderColor: `${profile.user.tint}66` }]}>
            <Text style={[styles.avatarText, { color: profile.user.tint }]}>
              {profile.user.name[0]}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{profile.user.name}</Text>
            <Text style={styles.handle}>@{profile.user.handle}</Text>
            <View style={styles.stats}>
              <Stat n={profile.reviewCount} label="notes" />
              <Stat n={profile.friends} label="friends" />
              <Stat n={profile.joined} label="since" />
            </View>
          </View>
        </View>

        <Text style={styles.bio}>{profile.bio}</Text>

        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit profile</Text>
        </TouchableOpacity>

        {/* Favourites - Top 4 */}
        {profile.top4.length > 0 && (
          <>
            <Section gold={gold} label="favourites" onShare={handleShareTop4} />
            <View ref={top4CardRef} collapsable={false} style={styles.top4Container}>
              <View style={styles.top4Grid}>
                {profile.top4.map((entry, i) => (
                  <AlbumTile key={i} entry={entry} big />
                ))}
              </View>
              {/* User attribution for shared card */}
              <View style={styles.top4Attribution}>
                <Text style={styles.top4AttrText}>
                  @{profile.user.handle}'s top 4 · linernotes.app
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Recent ratings */}
        {profile.thisWeek.length > 0 && (
          <>
            <Section gold={gold} label="recent ratings" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekScroll}
            >
              {profile.thisWeek.map((entry, i) => (
                <View key={i} style={styles.weekTile}>
                  <AlbumTile entry={entry} />
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Notes / Saved tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            onPress={() => setTab('notes')}
            style={[
              styles.tab,
              tab === 'notes' && { borderBottomColor: gold, borderBottomWidth: 2 },
            ]}
          >
            <Text style={[styles.tabText, tab === 'notes' && styles.tabTextActive]}>
              notes · {notesList.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('saved')}
            style={[
              styles.tab,
              tab === 'saved' && { borderBottomColor: gold, borderBottomWidth: 2 },
            ]}
          >
            <Text style={[styles.tabText, tab === 'saved' && styles.tabTextActive]}>
              saved · {profile.saved.length}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notes feed */}
        <View style={styles.feed}>
          {tab === 'notes' && notesList.map(({ review, kind }) => (
            <ProfileNote key={kind + review.id} review={review} kind={kind} gold={gold} />
          ))}
          {tab === 'saved' && profile.saved.map((review) => (
            <ProfileNote key={'sv' + review.id} review={review} kind="saved" gold={gold} />
          ))}
          {tab === 'saved' && profile.saved.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>nothing saved yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNumber}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ gold, label, onShare }: { gold: string; label: string; onShare?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: gold }]}>{label}</Text>
      <View style={styles.sectionLine} />
      {onShare && (
        <TouchableOpacity
          onPress={onShare}
          style={[styles.shareButton, { borderColor: gold, backgroundColor: `${gold}14` }]}
        >
          <Icon name="share" size={12} color={gold} />
          <Text style={[styles.shareText, { color: gold }]}>share</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AlbumTile({ entry, big }: { entry: AlbumEntry; big?: boolean }) {
  const gold = '#d9b25a';

  return (
    <TouchableOpacity style={styles.albumTile}>
      <View style={styles.albumCover}>
        <View style={styles.albumArtPlaceholder}>
          <Text style={styles.albumArtLabel}>{entry.album?.title?.toLowerCase() || 'album'}</Text>
        </View>
        <View style={styles.ratingPill}>
          <Stars rating={entry.rating} size={9} color={gold} />
        </View>
      </View>
      <View style={styles.albumInfo}>
        <Text style={[styles.albumTitle, { fontSize: big ? 14.5 : 13 }]} numberOfLines={1}>
          {entry.album?.title || 'Unknown Album'}
        </Text>
        <Text style={styles.albumArtist} numberOfLines={1}>
          {entry.album?.artist || 'Unknown Artist'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ProfileNote({
  review,
  kind,
  gold,
}: {
  review: Review;
  kind: 'own' | 'repost' | 'saved';
  gold: string;
}) {
  const [like, setLike] = useState({ on: false, n: 0 });
  const [save, setSave] = useState(kind === 'saved');
  const [repost, setRepost] = useState({ on: kind === 'repost', n: 0 });
  const storyCardRef = useRef(null); // For Instagram (with link sticker space)
  const regularCardRef = useRef(null); // For TikTok/Twitter (no space)

  const handleShare = async () => {
    const reviewUrl = `https://beta-linernotes.vercel.app/review/${review.id}`;

    // Show share options matching Claude Design: Camera Roll, Instagram, TikTok
    Alert.alert(
      'Share your note',
      'Export to story or camera roll',
      [
        {
          text: 'Camera Roll',
          onPress: () => shareToTwitter(regularCardRef.current, reviewUrl),
        },
        {
          text: 'Instagram',
          onPress: () => shareToInstagramStory(storyCardRef.current),
        },
        {
          text: 'TikTok',
          onPress: () => shareToTikTok(regularCardRef.current),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={styles.profileNote}>
      {kind === 'repost' && (
        <View style={styles.noteHeader}>
          <Icon name="repost" size={13} color="rgba(241,235,224,0.45)" />
          <Text style={styles.noteHeaderText}>you reposted · {review.user?.name}'s note</Text>
        </View>
      )}
      {kind === 'saved' && review.user && (
        <View style={styles.noteHeader}>
          <Avatar name={review.user.name} tint={review.user.tint || gold} size={28} />
          <View style={styles.noteHeaderInfo}>
            <Text style={styles.noteUserName}>{review.user.name}</Text>
            <Text style={styles.noteUserHandle}>
              @{review.user.handle} · {formatRelativeTime(review.createdAt)}
            </Text>
          </View>
        </View>
      )}

      {/* Hidden story variant for Instagram sharing (with link sticker space) */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} ref={storyCardRef} collapsable={false}>
        <ReviewCard review={review} accent={gold} context="share" variant="story" />
      </View>

      {/* Visible regular card (also used for TikTok/Twitter sharing) */}
      <View ref={regularCardRef} collapsable={false}>
        <ReviewCard review={review} accent={gold} context="share" />
      </View>

      <View style={styles.actions}>
        <ActionButton
          icon="repost"
          active={repost.on}
          activeColor="#d98aa0"
          count={repost.n}
          onPress={() => setRepost((s) => ({ on: !s.on, n: s.n + (s.on ? -1 : 1) }))}
        />
        <ActionButton
          icon="save"
          active={save}
          activeColor="#c8a45c"
          onPress={() => setSave((s) => !s)}
        />
        <ActionButton
          icon="like"
          active={like.on}
          activeColor="#e0762f"
          count={like.n}
          onPress={() => setLike((s) => ({ on: !s.on, n: s.n + (s.on ? -1 : 1) }))}
        />
        <View style={{ flex: 1 }} />
        {kind === 'own' && (
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.shareNoteButton, { borderColor: gold, backgroundColor: `${gold}14` }]}
          >
            <Icon name="share" size={14} color={gold} />
            <Text style={[styles.shareNoteText, { color: gold }]}>Share</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  active,
  activeColor,
  count,
  onPress,
}: {
  icon: 'repost' | 'save' | 'like';
  active: boolean;
  activeColor: string;
  count?: number;
  onPress: () => void;
}) {
  const color = active ? activeColor : 'rgba(241,235,224,0.62)';

  return (
    <TouchableOpacity onPress={onPress} style={styles.actionButton}>
      <Icon name={icon} size={20} filled={active} color={color} />
      {typeof count === 'number' && count > 0 && (
        <Text style={[styles.actionCount, { color }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'Menlo',
    fontSize: 14,
    color: tokens.colors.fg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 60,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
  },
  avatarContainer: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 32,
  },
  headerInfo: {
    flex: 1,
    paddingTop: 3,
    gap: 2,
  },
  name: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 23,
    color: tokens.colors.fg,
    lineHeight: 25,
    letterSpacing: -0.23,
  },
  handle: {
    fontFamily: 'Menlo',
    fontSize: 12,
    color: 'rgba(241,235,224,0.5)',
  },
  stats: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 7,
  },
  stat: {
    gap: 2,
  },
  statNumber: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: tokens.colors.fg,
    lineHeight: 18,
  },
  statLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.95,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: 'rgba(241,235,224,0.42)',
  },
  bio: {
    marginTop: 15,
    fontFamily: 'System',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(241,235,224,0.78)',
  },
  editButton: {
    marginTop: 14,
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.16)',
    backgroundColor: 'rgba(241,235,224,0.05)',
    alignItems: 'center',
  },
  editButtonText: {
    fontFamily: 'System',
    fontSize: 13.5,
    fontWeight: '500',
    color: tokens.colors.fg,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 11,
    letterSpacing: 1.98,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(241,235,224,0.1)',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  shareText: {
    fontFamily: 'System',
    fontSize: 11.5,
    fontWeight: '600',
  },
  top4Container: {
    marginTop: 13,
    backgroundColor: tokens.colors.nearBlack,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
  },
  top4Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 13,
  },
  top4Attribution: {
    marginTop: 16,
    alignItems: 'center',
  },
  top4AttrText: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'rgba(241,235,224,0.4)',
  },
  weekScroll: {
    gap: 11,
    paddingVertical: 4,
    marginTop: 13,
  },
  weekTile: {
    width: 108,
  },
  albumTile: {
    width: (SCREEN_WIDTH - 36 - 13) / 2,
    gap: 7,
  },
  albumCover: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 13,
    elevation: 8,
  },
  albumArtPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(241,235,224,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArtLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.4)',
    textAlign: 'center',
    padding: 12,
  },
  ratingPill: {
    position: 'absolute',
    top: 7,
    right: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(8,7,6,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.1)',
  },
  albumInfo: {
    paddingLeft: 1,
  },
  albumTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    color: tokens.colors.fg,
    lineHeight: 16,
  },
  albumArtist: {
    fontFamily: 'System',
    fontSize: 11.5,
    color: 'rgba(241,235,224,0.6)',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.1)',
  },
  tab: {
    paddingBottom: 10,
    marginBottom: -1,
  },
  tabText: {
    fontFamily: 'Menlo',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: 'rgba(241,235,224,0.4)',
  },
  tabTextActive: {
    color: tokens.colors.fg,
  },
  feed: {
    gap: 26,
    marginTop: 20,
  },
  profileNote: {
    gap: 11,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 3,
  },
  noteHeaderText: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 0.42,
    color: 'rgba(241,235,224,0.5)',
  },
  noteHeaderInfo: {
    gap: 2,
  },
  noteUserName: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  noteUserHandle: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: 'rgba(241,235,224,0.45)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  actionCount: {
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  shareNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  shareNoteText: {
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: 'rgba(241,235,224,0.4)',
  },
});
