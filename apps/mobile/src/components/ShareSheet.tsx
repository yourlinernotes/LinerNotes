/**
 * ShareSheet - Bottom sheet modal for sharing cards
 * Based on Claude Design: LNShareSheet
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { tokens } from '../lib/tokens';
import { Icon } from './atoms/Icon';

interface ShareFormat {
  id: 'instagram' | 'tiktok' | 'camera' | 'twitter';
  label: string;
  swatch: string;
}

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  onExport: (format: ShareFormat['id']) => Promise<void>;
  accent?: string;
  type: 'review' | 'top4' | 'profile';
  hasFull?: boolean; // For reviews with full body content
  children: React.ReactNode; // Card preview
}

const FORMATS: ShareFormat[] = [
  { id: 'instagram', label: 'Instagram Story', swatch: '#d98aa0' },
  { id: 'tiktok', label: 'TikTok', swatch: '#3fc8ea' },
  { id: 'camera', label: 'Camera Roll', swatch: 'rgba(241,235,224,0.5)' },
  { id: 'twitter', label: 'Twitter', swatch: '#1DA1F2' },
];

export function ShareSheet({
  visible,
  onClose,
  onExport,
  accent,
  type,
  hasFull = false,
  children,
}: ShareSheetProps) {
  const gold = accent || tokens.colors.gold;
  const [format, setFormat] = useState<ShareFormat['id']>('instagram');
  const [isExporting, setIsExporting] = useState(false);
  const [done, setDone] = useState(false);

  const showLinkSlot = format === 'instagram'; // Only Instagram Story has link slot
  const isIdentity = type === 'top4' || type === 'profile';

  // Get contextual note based on format and content type
  const getNote = () => {
    if (format === 'camera') {
      return "Saved to Camera Roll. Link copied — paste it anywhere.";
    }

    if (format === 'instagram') {
      if (type === 'profile') {
        return "Link copied. Drop a link sticker on the dashed zone so taps reach your profile.";
      }
      if (type === 'top4') {
        return "Link copied. Drop a link sticker on the dashed zone.";
      }
      // Review
      if (hasFull) {
        return "Link copied. Drop a link sticker on the dashed zone so taps reach your full review.";
      }
      return "Link copied. Drop a link sticker on the dashed zone.";
    }

    if (format === 'tiktok') {
      return "Link copied. TikTok composer will open — paste the link in your caption.";
    }

    if (format === 'twitter') {
      return "Link copied. Twitter composer will open — paste the link in your tweet.";
    }

    return "Link copied.";
  };

  // Get export button label
  const getExportLabel = () => {
    if (done) return "✓ Link copied · exported";
    switch (format) {
      case 'camera': return 'Save to Camera Roll';
      case 'instagram': return 'Share to Instagram Story';
      case 'tiktok': return 'Open TikTok';
      case 'twitter': return 'Open Twitter';
    }
  };

  // Get sheet title
  const getTitle = () => {
    switch (type) {
      case 'top4': return 'Share your Top 4';
      case 'profile': return 'Share your profile';
      default: return 'Share your note';
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(format);
      setDone(true);
      setTimeout(() => {
        onClose();
        // Reset state after modal closes
        setTimeout(() => {
          setDone(false);
          setFormat('instagram');
        }, 300);
      }, 1100);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{getTitle()}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
            >
              <Icon name="close" size={16} color={tokens.colors.fg} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Live preview */}
            <View style={styles.previewContainer}>
              {React.isValidElement(children)
                ? React.cloneElement(children as React.ReactElement<any>, {
                    linkSlot: showLinkSlot && (type === 'profile' || hasFull),
                  })
                : children}
            </View>

            {/* Format picker */}
            <Text style={styles.sectionLabel}>EXPORT TO</Text>
            <View style={styles.formatGrid}>
              {FORMATS.map((f) => {
                const isSelected = format === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setFormat(f.id)}
                    style={[
                      styles.formatButton,
                      {
                        borderColor: isSelected ? gold : tokens.colors.fg + '24',
                        backgroundColor: isSelected ? `${gold}14` : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[styles.formatSwatch, { backgroundColor: f.swatch }]}
                    />
                    <Text
                      style={[
                        styles.formatLabel,
                        {
                          color: isSelected
                            ? tokens.colors.fg
                            : tokens.colors.fg + 'CC',
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Contextual note */}
            <View
              style={[
                styles.noteContainer,
                {
                  backgroundColor: `${gold}0c`,
                  borderColor: `${gold}33`,
                },
              ]}
            >
              <View style={styles.noteIcon}>
                <Icon name="bookmark" size={15} color={gold} />
              </View>
              <Text style={styles.noteText}>{getNote()}</Text>
            </View>

            {/* Export button */}
            <TouchableOpacity
              onPress={handleExport}
              disabled={isExporting || done}
              style={[
                styles.exportButton,
                {
                  backgroundColor: done ? '#1db954' : gold,
                },
              ]}
            >
              <Text style={styles.exportButtonText}>{getExportLabel()}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 5, 5, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.fg + '1A',
    maxHeight: '92%',
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: tokens.colors.fg + '33',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 6,
    paddingBottom: 10,
  },
  title: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 19,
    color: tokens.colors.fg,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.fg + '24',
    backgroundColor: tokens.colors.fg + '0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 4,
    paddingBottom: 24,
  },
  previewContainer: {
    maxWidth: 300,
    alignSelf: 'center',
    width: '100%',
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 1.68,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: tokens.colors.fg + '80',
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  formatButton: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  formatSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  formatLabel: {
    fontFamily: 'System',
    fontSize: 13.5,
    fontWeight: '600',
  },
  noteContainer: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteIcon: {
    marginTop: 1,
  },
  noteText: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 12.5,
    lineHeight: 17.5,
    color: tokens.colors.fg + 'D1',
  },
  exportButton: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  exportButtonText: {
    fontFamily: 'System',
    fontSize: 15.5,
    fontWeight: '600',
    color: tokens.colors.nearBlack,
  },
});
