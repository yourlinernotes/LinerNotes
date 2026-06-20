import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlbumArt, Stars, SaveIcon, ReactionIcon } from './atoms';
import type { FeedReview } from '../lib/feed-types';
import { tokens } from '../lib/tokens';

interface ReviewCardProps {
  review: FeedReview;
  accent?: string;
  onPress?: () => void;
  context?: 'feed' | 'share';
  variant?: 'story' | 'cameraRoll'; // story = space for link sticker, cameraRoll = no space
}

export function ReviewCard({ review, accent, onPress, context = 'feed', variant }: ReviewCardProps) {
  const { album, rating } = review;
  const gold = accent || tokens.colors.gold;
  const isAlbum = !!(album.tracks && album.tracks.length > 0);

  // Depth is derived from content
  const depth = !review.take ? 'floor' : review.body ? 'full' : 'caption';

  const showPill = rating > 0 && album.kind !== 'playlist';
  const hasFullReview = !!review.body;

  // Show CTA/link slot:
  // - Feed: show simple CTA when there's a full review
  // - Share + Story: show dashed link sticker slot when there's a full review
  // - Share + Camera Roll: no CTA (link is copied, but no visual slot)
  const showCTA = context === 'feed' && hasFullReview;
  const showLinkSlot = context === 'share' && variant === 'story' && hasFullReview;

  const padding = tokens.layout.cardPadding[depth];

  // Add top padding for story variant (space for link sticker)
  const topPadding = variant === 'story' ? 80 : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, topPadding > 0 && { paddingTop: topPadding }]}
      disabled={!onPress}
    >
      {/* Subtle accent tint */}
      <View
        style={[
          styles.tint,
          {
            backgroundColor: `${album.palette.accent}${
              depth === 'full' ? '20' : depth === 'caption' ? '16' : '12'
            }`,
          },
        ]}
      />

      {/* Album art */}
      <View style={styles.artContainer}>
        <AlbumArt
          palette={album.palette}
          artworkUrl={album.artworkUrl}
          label={album.title.toLowerCase()}
          dim
        >
          {showPill && (
            <View style={styles.ratingPill}>
              <Stars rating={rating} size={12} color={gold} showNum={false} />
            </View>
          )}
          {(album.kind === 'playlist' || isAlbum) && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {album.kind === 'playlist' ? 'playlist' : 'album review'}
              </Text>
            </View>
          )}
        </AlbumArt>
      </View>

      {/* Content */}
      <View style={[styles.content, { padding: padding.vertical }]}>
        {/* Title + artist */}
        <View style={styles.titleSection}>
          <Text style={styles.title} numberOfLines={2}>
            {album.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {album.artist}
          </Text>
        </View>

        {/* Preview line */}
        {review.take && (
          <Text style={styles.previewLine} numberOfLines={2}>
            {review.take.split('\n')[0]}
          </Text>
        )}

        {/* Floor: rating is the statement */}
        {depth === 'floor' && album.kind !== 'playlist' && rating > 0 && (
          <View style={styles.floorRating}>
            <Stars rating={rating} size={17} color={gold} showNum={false} />
            <Text style={[styles.ratingNum, { color: gold }]}>
              {rating.toFixed(1)}
            </Text>
            <Text style={styles.ratedLabel}>rated</Text>
          </View>
        )}

        {/* The moment */}
        {depth !== 'floor' && review.notes && review.notes.length > 0 && (
          <View style={styles.momentContainer}>
            <View style={[styles.momentNotch, { backgroundColor: gold }]}>
              <Text style={styles.momentTime}>
                {formatTime(review.notes[0].sec)}
              </Text>
            </View>
            <Text style={styles.momentNote} numberOfLines={2}>
              {review.notes[0].note}
            </Text>
          </View>
        )}

        {/* Album: track strip */}
        {isAlbum && album.tracks && <TrackStrip tracks={album.tracks} gold={gold} />}

        {/* CTA — plain text for feed */}
        {showCTA && (
          <Text style={[styles.ctaText, { color: gold }]}>
            tap to read the full review
          </Text>
        )}

        {/* Link sticker slot — dashed border for story exports */}
        {showLinkSlot && (
          <View style={[styles.linkSlot, { borderColor: `${gold}66`, backgroundColor: `${gold}0A` }]}>
            <Text style={[styles.linkSlotTitle, { color: gold }]}>
              Tap to read the full review
            </Text>
            <Text style={[styles.linkSlotHint, { color: `${gold}99` }]}>
              Drop your link sticker here, it's already copied
            </Text>
          </View>
        )}

        {/* Footer - export only */}
        {context === 'share' && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Made on LinerNotes</Text>
            <Text style={styles.footerText}>@{review.user.handle}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function TrackStrip({ tracks, gold }: { tracks: any[]; gold: string }) {
  const totalMoments = tracks.reduce((sum, t) => sum + (t.moments?.length || 0), 0);

  return (
    <View style={styles.strip}>
      {totalMoments > 0 && (
        <View style={styles.stripHeader}>
          <Text style={styles.stripLabel}>the ones that stuck</Text>
          <View style={styles.momentCount}>
            <SaveIcon size={11} color={gold} />
            <Text style={[styles.momentCountText, { color: gold }]}>
              {totalMoments} moment{totalMoments > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}
      {tracks.map((t) => (
        <View key={t.n} style={styles.trackRow}>
          <Text style={styles.trackNum}>{String(t.n).padStart(2, '0')}</Text>
          <Text
            style={[
              styles.trackName,
              { color: t.reaction ? tokens.colors.fg : tokens.colors.fg + '88' },
            ]}
            numberOfLines={1}
          >
            {t.name}
          </Text>
          {t.moments && t.moments.length > 0 && (
            <View style={[styles.trackMomentBadge, { backgroundColor: `${gold}16` }]}>
              <SaveIcon size={10} color={gold} />
              <Text style={[styles.trackMomentCount, { color: gold }]}>
                {t.moments.length}
              </Text>
            </View>
          )}
          {t.reaction ? (
            <ReactionIcon kind={t.reaction} size={16} />
          ) : (
            <View style={styles.emptyReaction} />
          )}
        </View>
      ))}
    </View>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: tokens.layout.radius.card,
    backgroundColor: tokens.colors.nearBlack,
    borderWidth: 1,
    borderColor: tokens.colors.fg + '12',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 10,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
    pointerEvents: 'none',
  },
  artContainer: {
    width: '100%',
  },
  ratingPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: tokens.layout.radius.pill,
    backgroundColor: 'rgba(8, 7, 6, 0.55)',
    borderWidth: 1,
    borderColor: tokens.colors.fg + '1A',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: tokens.layout.radius.pill,
    backgroundColor: 'rgba(8, 7, 6, 0.5)',
    borderWidth: 1,
    borderColor: tokens.colors.fg + '1A',
  },
  badgeText: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: tokens.colors.fg,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  titleSection: {
    gap: 2,
  },
  title: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 22.4,
    color: tokens.colors.fg,
    letterSpacing: -0.2,
  },
  artist: {
    fontFamily: 'System',
    fontSize: 15,
    color: tokens.colors.muted,
  },
  previewLine: {
    fontFamily: 'System',
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22.4,
    color: tokens.colors.fg,
  },
  floorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 1,
  },
  ratingNum: {
    fontFamily: 'Menlo',
    fontSize: 15,
    letterSpacing: -0.3,
  },
  ratedLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 0.8,
    color: tokens.colors.fg + '61',
    textTransform: 'uppercase',
    marginLeft: 2,
  },
  momentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 1,
  },
  momentNotch: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  momentTime: {
    fontFamily: 'Menlo',
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
    letterSpacing: -0.25,
  },
  momentNote: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13.5,
    lineHeight: 18.225,
    color: tokens.colors.fg + 'DC',
  },
  strip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.fg + '17',
    backgroundColor: tokens.colors.fg + '05',
    overflow: 'hidden',
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.fg + '12',
  },
  stripLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: tokens.colors.fg + '80',
  },
  momentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  momentCountText: {
    fontFamily: 'Menlo',
    fontSize: 10,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.fg + '0D',
  },
  trackNum: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    color: tokens.colors.fg + '61',
    width: 16,
  },
  trackName: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 13.5,
  },
  trackMomentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  trackMomentCount: {
    fontFamily: 'Menlo',
    fontSize: 10,
  },
  emptyReaction: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colors.fg + '2E',
  },
  ctaText: {
    marginTop: 2,
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  linkSlot: {
    marginTop: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  linkSlotTitle: {
    fontFamily: 'System',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  linkSlotHint: {
    fontFamily: 'Menlo',
    fontSize: 9,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  footer: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.fg + '1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: tokens.colors.fg + '73',
  },
});
