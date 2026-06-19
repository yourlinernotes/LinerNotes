import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { tokens } from '../lib/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReviewCard } from '../components/ReviewCard';
import { PromptShelf } from '../components/PromptShelf';
import { Icon } from '../components/atoms/Icon';
import { Avatar } from '../components/atoms/Avatar';
import { formatRelativeTime } from '../lib/time-utils';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { askingEngine } from '../services/askingEngine';
import { lastfm } from '../services/lastfm';
import { reviewToFeedReview } from '../lib/feed-adapter';
import type { Review } from '../lib/types';
import type { FeedReview } from '../lib/feed-types';
import type { PromptTrigger } from '../services/askingEngine';

interface FeedItemData {
  id: string;
  review: Review;
  user: {
    id: string;
    displayName: string;
    handle: string;
    tint: string;
  };
  likeCount: number;
  repostCount: number;
  saved: boolean;
  via?: { name: string; handle: string };
  createdAt: string;
}

interface FeedScreenProps {
  onOpenReview?: (review: FeedReview) => void;
  onOpenComposer?: () => void;
}

export function FeedScreen({ onOpenReview, onOpenComposer }: FeedScreenProps) {
  const { user } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPrompts, setCurrentPrompts] = useState<PromptTrigger[]>([]);
  const [lastFmConnected, setLastFmConnected] = useState(false);

  async function loadFeed() {
    try {
      setIsLoading(true);

      // Load feed items from API
      const data = await api.getFeedReviews({ limit: 20 });

      // Map reviews to feed items
      // Note: Backend should return user data with reviews, for now we'll handle missing data gracefully
      const items: FeedItemData[] = data.reviews.map((review: any) => ({
        id: review.id,
        review,
        user: {
          id: review.user?.id || review.userId,
          displayName: review.user?.displayName || review.user?.name || 'User',
          handle: review.user?.handle || 'user',
          tint: tokens.colors.gold,
        },
        likeCount: review.likeCount || 0,
        repostCount: review.repostCount || 0,
        saved: review.saved || false,
        createdAt: review.createdAt,
      }));
      setFeedItems(items);

      // Load asking engine prompt
      loadPrompt();
    } catch (error) {
      console.error('Failed to load feed:', error);
      // Set empty feed on error so user doesn't see indefinite loading
      setFeedItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPrompt() {
    try {
      // Last.fm powers live-listening prompts (optional).
      const isConnected = await lastfm.isConnected();
      setLastFmConnected(isConnected);
      const username = isConnected ? (await lastfm.getUsername()) ?? undefined : undefined;

      // Profile Top 4 powers prompts even without Last.fm connected.
      const top4Albums = (user?.favourites?.albums ?? []).map((a) => ({
        artist: a.artist,
        title: a.name,
      }));

      // No cooldown for the in-feed shelf — surface whatever is worth a note.
      const prompts = await askingEngine.getFeedPrompts(username, top4Albums);
      setCurrentPrompts(prompts);
    } catch (error) {
      console.error('Failed to load asking engine prompt:', error);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadFeed();
    setIsRefreshing(false);
  }

  useEffect(() => {
    loadFeed();
  }, []);

  function handleOpenReview(review: FeedReview) {
    if (onOpenReview) {
      onOpenReview(review);
    }
  }

  function handleOpenComposer(prompt: PromptTrigger) {
    console.log('Opening composer for prompt:', prompt);
    // Open the composer - track/album pre-filling will be implemented when we add prompt data structure
    if (onOpenComposer) {
      onOpenComposer();
    }
  }

  async function handleDismissPrompt(promptId: string) {
    await askingEngine.dismissPrompt(promptId);
    setCurrentPrompts((prev) => prev.filter((p) => p.id !== promptId));
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={tokens.colors.fg} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        renderItem={({ item }) => (
          <FeedItem item={item} onOpen={handleOpenReview} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          currentPrompts.length > 0 ? (
            <PromptShelf
              prompts={currentPrompts}
              accent={tokens.colors.gold}
              onOpenComposer={handleOpenComposer}
              onDismiss={handleDismissPrompt}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.colors.fg}
          />
        }
        ListFooterComponent={
          <View style={styles.endMessage}>
            <Text style={styles.endText}>you're all caught up · breathe</Text>
          </View>
        }
      />
    </View>
  );
}

function FeedItem({ item, onOpen }: { item: FeedItemData; onOpen: (review: FeedReview) => void }) {
  const [like, setLike] = useState({ on: false, n: item.likeCount });
  const [save, setSave] = useState(item.saved);
  const [repost, setRepost] = useState({ on: false, n: item.repostCount });
  const [follow, setFollow] = useState(false);

  const feedReview = reviewToFeedReview(item.review, {
    name: item.user.displayName,
    handle: item.user.handle,
    tint: item.user.tint,
  });

  const toggleLike = async () => {
    const newState = !like.on;
    const newCount = like.n + (like.on ? -1 : 1);
    setLike({ on: newState, n: newCount });

    try {
      await api.toggleAction(item.review.id, 'like');
    } catch (error) {
      console.error('Failed to toggle like:', error);
      // Revert on error
      setLike({ on: !newState, n: like.n });
    }
  };

  const toggleSave = async () => {
    const newState = !save;
    setSave(newState);

    try {
      await api.toggleAction(item.review.id, 'save');
    } catch (error) {
      console.error('Failed to toggle save:', error);
      setSave(!newState);
    }
  };

  const toggleRepost = async () => {
    const newState = !repost.on;
    const newCount = repost.n + (repost.on ? -1 : 1);
    setRepost({ on: newState, n: newCount });

    try {
      await api.toggleAction(item.review.id, 'repost');
    } catch (error) {
      console.error('Failed to toggle repost:', error);
      // Revert on error
      setRepost({ on: !newState, n: repost.n });
    }
  };

  // Determine depth based on review content
  const depth = !item.review.take ? 'floor' : item.review.take && item.review.notes.length > 0 ? 'full' : 'caption';

  return (
    <View style={styles.feedItem}>
      {/* Poster row */}
      <View style={styles.poster}>
        <Avatar user={{ name: item.user.displayName, tint: item.user.tint }} size={30} />
        <View style={styles.posterInfo}>
          <Text style={styles.userName}>{item.user.displayName}</Text>
          <Text style={styles.userHandle}>
            @{item.user.handle} · {formatRelativeTime(item.createdAt)}
          </Text>
          {item.via && (
            <View style={styles.via}>
              <Icon name="repost" size={11} color="rgba(241,235,224,0.42)" />
              <Text style={styles.viaText}>via {item.via.name}</Text>
            </View>
          )}
        </View>

        {item.via ? (
          <TouchableOpacity
            onPress={() => setFollow((f) => !f)}
            style={[
              styles.followButton,
              {
                borderColor: follow ? 'rgba(241,235,224,0.22)' : tokens.colors.gold,
                backgroundColor: follow ? 'transparent' : tokens.colors.gold,
              },
            ]}
          >
            <Text
              style={[
                styles.followText,
                {
                  color: follow ? 'rgba(241,235,224,0.7)' : tokens.colors.nearBlack,
                },
              ]}
            >
              {follow ? 'following' : '+ follow'}
            </Text>
          </TouchableOpacity>
        ) : depth === 'floor' ? (
          <View style={styles.tapRatedBadge}>
            <Text style={styles.tapRatedText}>tap-rated</Text>
          </View>
        ) : null}
      </View>

      {/* The card */}
      <ReviewCard
        review={feedReview}
        accent={tokens.colors.gold}
        onPress={() => onOpen(feedReview)}
        context="feed"
      />

      {/* Action row */}
      <View style={styles.actions}>
        <ActionButton
          icon="repost"
          active={repost.on}
          activeColor="#d98aa0"
          count={repost.n}
          onPress={toggleRepost}
        />
        <ActionButton
          icon="save"
          active={save}
          activeColor="#c8a45c"
          onPress={toggleSave}
        />
        <View style={{ flex: 1 }} />
        <ActionButton
          icon="like"
          active={like.on}
          activeColor="#e0762f"
          count={like.n}
          onPress={toggleLike}
        />
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
      {typeof count === 'number' && (
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  logo: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.fg,
    letterSpacing: -0.4,
  },
  headerTitle: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.fg,
    letterSpacing: -0.17,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 116, // Account for App.tsx sticky header (104px + 12px spacing)
    paddingBottom: 110,
    gap: 28,
  },
  feedItem: {
    gap: 11,
  },
  poster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 3,
  },
  posterInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  userName: {
    fontFamily: 'System',
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  userHandle: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    color: 'rgba(241,235,224,0.45)',
    letterSpacing: 0.21,
  },
  via: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  viaText: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.29,
    color: 'rgba(241,235,224,0.5)',
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  followText: {
    fontFamily: 'System',
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.12,
  },
  tapRatedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.12)',
    borderRadius: 999,
    flexShrink: 0,
  },
  tapRatedText: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.48,
    color: 'rgba(241,235,224,0.4)',
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
    minWidth: 12,
  },
  endMessage: {
    alignItems: 'center',
    marginTop: 26,
    paddingBottom: 20,
  },
  endText: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: 'rgba(241,235,224,0.3)',
  },
});
