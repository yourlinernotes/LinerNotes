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
  Image,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReviewCard } from '../components/ReviewCard';
import { Icon } from '../components/atoms/Icon';
import { Avatar } from '../components/atoms/Avatar';
import { Stars } from '../components/atoms/Stars';
import { formatRelativeTime } from '../lib/time-utils';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { EditProfileModal } from '../components/EditProfileModal';
import { Top4Editor } from '../components/Top4Editor';
import type { User } from '../lib/types';
import { shareToInstagramStory, shareToTikTok, shareToTwitter, saveCardImage } from '../lib/share-utils';
import { reviewToFeedReview, type EnrichedReview } from '../lib/feed-adapter';
import type { FeedAuthor, FeedReview } from '../lib/feed-types';

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
    avatarUrl?: string;
  };
  bio: string;
  reviewCount: number;
  friends: number;
  joined: string;
  top4: AlbumEntry[];
  thisWeek: AlbumEntry[];
  reviews: EnrichedReview[];
  reposted: EnrichedReview[];
  saved: EnrichedReview[];
}

type TabType = 'notes' | 'saved';

export function ProfileScreen({
  onOpenReview,
}: {
  onOpenReview?: (review: FeedReview) => void;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<TabType>('notes');
  const [showEdit, setShowEdit] = useState(false);
  const [showTop4Editor, setShowTop4Editor] = useState(false);
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const gold = tokens.colors.gold;

  async function handleRefresh() {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }
  const top4CardRef = useRef(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    console.log('[Profile] loadProfile called, user:', user?.id);
    if (!user) {
      console.log('[Profile] No user, returning');
      return;
    }

    try {
      // Load independently so one failing call doesn't blank the whole profile.
      // (getMyProfile supplies bio, which the login/auth-me user lacks.)
      console.log('[Profile] Loading profile data...');
      const full = await api.getMyProfile().catch((err) => {
        console.error('[Profile] getMyProfile failed:', err);
        return null;
      });
      const reviews = await api.getUserReviews(user.id).catch((err) => {
        console.error('[Profile] getUserReviews failed:', err);
        return [];
      });
      const saved = await api.getSavedReviews().catch((err) => {
        console.error('[Profile] getSavedReviews failed:', err);
        return [];
      });
      const reposted = await api.getRepostedReviews().catch((err) => {
        console.error('[Profile] getRepostedReviews failed:', err);
        return [];
      });
      const friends = await api.getFriends().catch((err) => {
        console.error('[Profile] getFriends failed:', err);
        return [];
      });
      const u = full ?? user;
      setFullUser(u);

      // Map user's favourites to AlbumEntry format
      const top4Albums: AlbumEntry[] = (u.favourites?.albums || []).map(album => ({
        album: {
          id: album.id,
          name: album.name,
          artist: album.artist,
          artworkUrl: album.artworkUrl,
        },
        rating: 0, // Top 4 albums don't need ratings (they're favorites)
      }));

      const profileData: ProfileData = {
        user: {
          id: u.id || user.id,
          name: u.displayName || 'User',
          handle: u.handle || 'user',
          tint: '#d9b25a',
          avatarUrl: u.avatarUrl,
        },
        bio: u.bio || '',
        reviewCount: reviews.length,
        friends: friends.length,
        joined: new Date(user.createdAt || Date.now()).getFullYear().toString(),
        top4: top4Albums,
        thisWeek: [], // Will be populated when this week feature is implemented
        reviews,
        reposted,
        saved,
      };

      console.log('[Profile] Profile data loaded successfully');
      setProfile(profileData);
    } catch (error) {
      console.error('[Profile] Failed to load profile:', error);
      // Set a minimal profile to avoid infinite loading
      setProfile({
        user: {
          id: user.id,
          name: user.displayName || 'User',
          handle: user.handle || 'user',
          tint: '#d9b25a',
          avatarUrl: user.avatarUrl,
        },
        bio: '',
        reviewCount: 0,
        friends: 0,
        joined: new Date().getFullYear().toString(),
        top4: [],
        thisWeek: [],
        reviews: [],
        reposted: [],
        saved: [],
      });
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

  const handleSaveTop4 = async (albums: Array<{ id: string; name: string; artist: string; artworkUrl: string }>) => {
    try {
      // Update user's favourites
      await api.updateUser({
        favourites: {
          albums,
        },
      });

      // Reload profile to show updated Top 4
      await loadProfile();
      Alert.alert('Success', 'Your Top 4 has been updated!');
    } catch (error) {
      console.error('Failed to save Top 4:', error);
      throw error; // Re-throw so Top4Editor can show error
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const notesList = [
    ...profile.reposted.map((r) => ({ review: r, kind: 'repost' as const })),
    ...profile.reviews.map((r) => ({ review: r, kind: 'own' as const })),
  ];

  const profileAuthor: FeedAuthor = {
    name: profile.user.name,
    handle: profile.user.handle,
    tint: profile.user.tint,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.colors.fg}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { backgroundColor: `${profile.user.tint}22`, borderColor: `${profile.user.tint}66` }]}>
            {profile.user.avatarUrl ? (
              <Image source={{ uri: profile.user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: profile.user.tint }]}>
                {profile.user.name[0]}
              </Text>
            )}
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

        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <TouchableOpacity style={styles.editButton} onPress={() => setShowEdit(true)}>
          <Text style={styles.editButtonText}>Edit profile</Text>
        </TouchableOpacity>

        {/* Favourites - Top 4 */}
        {profile.top4.length > 0 ? (
          <>
            <Section
              gold={gold}
              label="favourites"
              onEdit={() => setShowTop4Editor(true)}
              onShare={handleShareTop4}
            />
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
        ) : (
          <>
            <Section
              gold={gold}
              label="favourites"
              onEdit={() => setShowTop4Editor(true)}
            />
            <TouchableOpacity
              style={styles.emptyTop4}
              onPress={() => setShowTop4Editor(true)}
            >
              <Text style={styles.emptyTop4Text}>Add your top 4 albums</Text>
              <Text style={styles.emptyTop4Subtitle}>Tap to select your favorites</Text>
            </TouchableOpacity>
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
            <ProfileNote key={kind + review.id} review={review} kind={kind} gold={gold} author={profileAuthor} onOpenReview={onOpenReview} />
          ))}
          {tab === 'saved' && profile.saved.map((review) => (
            <ProfileNote key={'sv' + review.id} review={review} kind="saved" gold={gold} author={profileAuthor} onOpenReview={onOpenReview} />
          ))}
          {tab === 'saved' && profile.saved.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>nothing saved yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit profile modal */}
      <EditProfileModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={() => {
          setShowEdit(false);
          loadProfile();
        }}
      />

      {/* Top 4 editor modal */}
      {fullUser && (
        <Top4Editor
          visible={showTop4Editor}
          currentTop4={fullUser.favourites?.albums || []}
          reviews={profile.reviews}
          onClose={() => setShowTop4Editor(false)}
          onSave={handleSaveTop4}
        />
      )}
    </View>
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

function Section({ gold, label, onShare, onEdit }: { gold: string; label: string; onShare?: () => void; onEdit?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: gold }]}>{label}</Text>
      <View style={styles.sectionLine} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {onEdit && (
          <TouchableOpacity
            onPress={onEdit}
            style={[styles.shareButton, { borderColor: gold, backgroundColor: `${gold}14` }]}
          >
            <Icon name="edit" size={12} color={gold} />
            <Text style={[styles.shareText, { color: gold }]}>edit</Text>
          </TouchableOpacity>
        )}
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
    </View>
  );
}

function AlbumTile({ entry, big }: { entry: AlbumEntry; big?: boolean }) {
  const gold = tokens.colors.gold;
  // Two-up grid for the Top 4 (big); narrower fixed tiles for the week row.
  const tileWidth = big ? (SCREEN_WIDTH - 82) / 2 : 108;
  const art = entry.album?.artworkUrl;
  const title = entry.album?.name || entry.album?.title || 'Unknown Album';

  return (
    <TouchableOpacity style={[styles.albumTile, { width: tileWidth }]} activeOpacity={0.85}>
      <View style={styles.albumCover}>
        {art ? (
          <Image source={{ uri: art }} style={styles.albumArtImage} />
        ) : (
          <View style={styles.albumArtPlaceholder}>
            <Text style={styles.albumArtLabel}>{title.toLowerCase()}</Text>
          </View>
        )}
        {entry.rating > 0 && (
          <View style={styles.ratingPill}>
            <Stars rating={entry.rating} size={9} color={gold} />
          </View>
        )}
      </View>
      <View style={styles.albumInfo}>
        <Text style={[styles.albumTitle, { fontSize: big ? 14.5 : 13 }]} numberOfLines={1}>
          {title}
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
  author,
  onOpenReview,
}: {
  review: EnrichedReview;
  kind: 'own' | 'repost' | 'saved';
  gold: string;
  author: FeedAuthor;
  onOpenReview?: (review: FeedReview) => void;
}) {
  const feedReview = reviewToFeedReview(review, author);
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
          <Avatar user={{ name: review.user.name, tint: review.user.tint || gold }} size={28} />
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
        <ReviewCard review={feedReview} accent={gold} context="share" variant="story" />
      </View>

      {/* Hidden plain card for TikTok/Twitter export */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} ref={regularCardRef} collapsable={false}>
        <ReviewCard review={feedReview} accent={gold} context="share" />
      </View>

      {/* Visible card — tap to open the full review */}
      <ReviewCard
        review={feedReview}
        accent={gold}
        context="feed"
        onPress={() => onOpenReview?.(feedReview)}
      />

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
  editModal: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  editModalTitle: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  editModalClose: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: 116, // Account for App.tsx sticky header (104px + 12px spacing)
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
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
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
    justifyContent: 'space-between',
    rowGap: 16,
    columnGap: 13,
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
  emptyTop4: {
    marginTop: 13,
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(241,235,224,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTop4Text: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.fg,
    marginBottom: 6,
  },
  emptyTop4Subtitle: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.5)',
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
  albumArtImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
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
