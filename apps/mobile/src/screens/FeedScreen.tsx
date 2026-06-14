import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ReviewCard } from '../components/ReviewCard';
import { Avatar, RepostIcon, SaveIcon, LikeIcon } from '../components/atoms';
import { tokens } from '@linernotes/core';
import { formatRelative } from '../utils/time';
import type { FeedReview } from '../data/mockData';

interface FeedScreenProps {
  reviews: FeedReview[];
  onOpenReview: (review: FeedReview) => void;
}

export function FeedScreen({ reviews, onOpenReview }: FeedScreenProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Sticky header handled by parent */}
      <View style={styles.feed}>
        {reviews.map((review) => (
          <FeedItem
            key={review.id}
            review={review}
            onOpen={() => onOpenReview(review)}
          />
        ))}
      </View>

      <View style={styles.endMessage}>
        <Text style={styles.endText}>you're all caught up · breathe</Text>
      </View>
    </ScrollView>
  );
}

function FeedItem({ review, onOpen }: { review: FeedReview; onOpen: () => void }) {
  const [like, setLike] = useState({ on: false, n: review.likeCount });
  const [save, setSave] = useState(review.saved);
  const [repost, setRepost] = useState({ on: false, n: review.repostCount });
  const [follow, setFollow] = useState(false);

  const toggleLike = () => setLike((s) => ({ on: !s.on, n: s.n + (s.on ? -1 : 1) }));
  const toggleSave = () => setSave((s) => !s);
  const toggleRepost = () => setRepost((s) => ({ on: !s.on, n: s.n + (s.on ? -1 : 1) }));

  return (
    <View style={styles.feedItem}>
      {/* Poster row */}
      <View style={styles.poster}>
        <Avatar user={review.user} size={30} />
        <View style={styles.posterInfo}>
          <Text style={styles.userName}>{review.user.name}</Text>
          <Text style={styles.userHandle}>
            @{review.user.handle} · {formatRelative(review.at)}
          </Text>
          {review.via && (
            <View style={styles.via}>
              <RepostIcon size={11} color={`rgba(${tokens.colors.fgRgb}, 0.42)`} />
              <Text style={styles.viaText}>via {review.via.name}</Text>
            </View>
          )}
        </View>

        {review.via ? (
          <TouchableOpacity
            onPress={() => setFollow((f) => !f)}
            style={[
              styles.followButton,
              {
                borderColor: follow ? `rgba(${tokens.colors.fgRgb}, 0.22)` : tokens.colors.gold,
                backgroundColor: follow ? 'transparent' : tokens.colors.gold,
              },
            ]}
          >
            <Text
              style={[
                styles.followText,
                {
                  color: follow ? `rgba(${tokens.colors.fgRgb}, 0.7)` : tokens.colors.bg,
                },
              ]}
            >
              {follow ? 'following' : '+ follow'}
            </Text>
          </TouchableOpacity>
        ) : review.depth === 'floor' ? (
          <View style={styles.tapRatedBadge}>
            <Text style={styles.tapRatedText}>tap-rated</Text>
          </View>
        ) : null}
      </View>

      {/* The card */}
      <ReviewCard
        review={review}
        accent={tokens.colors.gold}
        onPress={onOpen}
      />

      {/* Action row */}
      <View style={styles.actions}>
        <ActionButton
          icon="repost"
          active={repost.on}
          activeColor={tokens.colors.love}
          count={repost.n}
          onPress={toggleRepost}
        />
        <ActionButton
          icon="save"
          active={save}
          activeColor={tokens.colors.goldBright}
          onPress={toggleSave}
        />
        <View style={{ flex: 1 }} />
        <ActionButton
          icon="like"
          active={like.on}
          activeColor={tokens.colors.flame}
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
  const color = active ? activeColor : `rgba(${tokens.colors.fgRgb}, 0.62)`;

  const IconComponent = icon === 'repost' ? RepostIcon : icon === 'save' ? SaveIcon : LikeIcon;

  return (
    <TouchableOpacity onPress={onPress} style={styles.actionButton}>
      <IconComponent size={20} filled={active} color={color} />
      {typeof count === 'number' && (
        <Text style={[styles.actionCount, { color }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  content: {
    paddingHorizontal: tokens.layout.feedPadding,
    paddingTop: 6,
    paddingBottom: 110,
  },
  feed: {
    gap: tokens.layout.feedGap,
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
    gap: 1,
    minWidth: 0,
  },
  userName: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: tokens.typography.sizes.userName,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.fg,
  },
  userHandle: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: tokens.typography.sizes.userHandle,
    color: `rgba(${tokens.colors.fgRgb}, 0.45)`,
    letterSpacing: 0.2,
  },
  via: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  viaText: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.3,
    color: `rgba(${tokens.colors.fgRgb}, 0.5)`,
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  followText: {
    fontFamily: tokens.typography.fonts.body,
    fontSize: 11.5,
    fontWeight: tokens.typography.weights.semibold,
    letterSpacing: 0.1,
  },
  tapRatedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `rgba(${tokens.colors.fgRgb}, 0.12)`,
    borderRadius: 999,
    flexShrink: 0,
  },
  tapRatedText: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: `rgba(${tokens.colors.fgRgb}, 0.4)`,
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
    fontFamily: tokens.typography.fonts.mono,
    fontSize: tokens.typography.sizes.actionButton,
    minWidth: 12,
  },
  endMessage: {
    alignItems: 'center',
    marginTop: 26,
  },
  endText: {
    fontFamily: tokens.typography.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: `rgba(${tokens.colors.fgRgb}, 0.3)`,
  },
});
