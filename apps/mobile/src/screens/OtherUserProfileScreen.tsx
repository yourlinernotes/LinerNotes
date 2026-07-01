/**
 * Other User Profile Screen
 * View another user's profile (read-only, no edit button)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReviewCard } from '../components/ReviewCard';
import { Icon } from '../components/atoms/Icon';
import { Avatar } from '../components/atoms/Avatar';
import { formatRelativeTime } from '../lib/time-utils';
import { api } from '../lib/api-client';
import { tokens } from '../lib/tokens';
import { reviewToFeedReview, type EnrichedReview } from '../lib/feed-adapter';
import type { FeedReview } from '../lib/feed-types';
import type { User } from '../lib/types';

interface OtherUserProfileScreenProps {
  userHandle: string;
  onClose: () => void;
  onOpenReview?: (review: FeedReview) => void;
}

interface ProfileData {
  user: User;
  reviews: EnrichedReview[];
  friendCount: number;
}

export function OtherUserProfileScreen({
  userHandle,
  onClose,
  onOpenReview,
}: OtherUserProfileScreenProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const gold = tokens.colors.gold;

  async function loadProfile() {
    try {
      setLoading(true);
      setError(false);

      // Load user data
      const userData = await api.getUser(userHandle);

      // Load user's reviews
      const reviews = await api.getUserReviews(userData.id);

      // Load friends count (if available in user data)
      const friendCount = userData.friendCount || 0;

      setProfile({
        user: userData,
        reviews,
        friendCount,
      });
    } catch (err) {
      console.error('[OtherUserProfile] Failed to load profile:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }

  useEffect(() => {
    loadProfile();
  }, [userHandle]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Icon name="back" size={20} color={tokens.colors.fg} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.fg} />
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Icon name="back" size={20} color={tokens.colors.fg} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>User not found</Text>
          <TouchableOpacity onPress={onClose} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { user, reviews, friendCount } = profile;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Icon name="back" size={20} color={tokens.colors.fg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{user.handle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.colors.fg}
          />
        }
      >
        {/* User info */}
        <View style={styles.userInfo}>
          <Avatar
            user={{ name: user.displayName, tint: gold }}
            size={72}
          />
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{user.displayName}</Text>
            <Text style={styles.handle}>@{user.handle}</Text>
            {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{reviews.length}</Text>
              <Text style={styles.statLabel}>notes</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{friendCount}</Text>
              <Text style={styles.statLabel}>friends</Text>
            </View>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.reviews}>
          <Text style={[styles.sectionLabel, { color: gold }]}>notes</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>No notes yet</Text>
          ) : (
            reviews.map((review) => {
              const feedReview = reviewToFeedReview(review, {
                name: user.displayName,
                handle: user.handle,
                tint: gold,
              });
              return (
                <TouchableOpacity
                  key={review.id}
                  onPress={() => onOpenReview?.(feedReview)}
                  style={styles.reviewItem}
                >
                  <ReviewCard review={feedReview} accent={gold} context="feed" />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 16,
    color: tokens.colors.muted,
    marginBottom: 16,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: tokens.colors.gold,
  },
  errorButtonText: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  userInfo: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  userDetails: {
    alignItems: 'center',
    gap: 4,
  },
  displayName: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 22,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  handle: {
    fontFamily: tokens.typography.rnFonts.mono,
    fontSize: 13,
    color: tokens.colors.muted,
  },
  bio: {
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(241,235,224,0.7)',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  stats: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: tokens.typography.rnFonts.bodySemibold,
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.fg,
  },
  statLabel: {
    fontFamily: tokens.typography.rnFonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: tokens.colors.muted,
    marginTop: 2,
  },
  reviews: {
    gap: 20,
  },
  sectionLabel: {
    fontFamily: tokens.typography.rnFonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: tokens.typography.rnFonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: tokens.colors.muted,
    textAlign: 'center',
    marginTop: 32,
  },
  reviewItem: {
    marginBottom: 16,
  },
});
