/**
 * AddPlaylistTrackModal - Search and add tracks to a playlist
 *
 * Features:
 * - Track search
 * - Add selected track to playlist
 * - Modal presentation
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@linernotes/core';
import { Icon } from './atoms/Icon';
import { api } from '../lib/api-client';

interface AddPlaylistTrackModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (track: {
    id: string;
    name: string;
    artist: string;
    album?: string;
    artworkUrl?: string;
  }) => void;
}

export function AddPlaylistTrackModal({
  visible,
  onClose,
  onAdd,
}: AddPlaylistTrackModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const gold = tokens.colors.gold;

  async function searchTracks(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.searchTracks(query, 20);
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSelectTrack(result: any) {
    const track = {
      id: String(result.trackId || result.id),
      name: result.name,
      artist: result.artist,
      album: result.album,
      artworkUrl: result.artworkUrl,
    };
    onAdd(track);
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  }

  function handleClose() {
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add a Track</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Icon name="close" size={17} color={tokens.colors.fg} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Search Input */}
            <View style={styles.searchSection}>
              <Text style={styles.sectionLabel}>SEARCH FOR A TRACK</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={(q) => {
                  setSearchQuery(q);
                  searchTracks(q);
                }}
                placeholder="search for a track..."
                placeholderTextColor="rgba(241,235,224,0.3)"
                autoFocus
                autoCorrect={false}
              />
              {isSearching && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={gold} />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              )}
            </View>

            {/* Search Results */}
            <ScrollView
              style={styles.resultsScroll}
              contentContainerStyle={styles.resultsContent}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((result, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.searchResult}
                  onPress={() => handleSelectTrack(result)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {result.name}
                    </Text>
                    <Text style={styles.searchResultArtist} numberOfLines={1}>
                      {result.artist} {result.album && `· ${result.album}`}
                    </Text>
                  </View>
                  <View style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Icon name="chevdown" size={20} color={gold} />
                  </View>
                </TouchableOpacity>
              ))}
              {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                <Text style={styles.noResults}>No tracks found. Try a different search.</Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  headerTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 20,
    color: tokens.colors.fg,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    backgroundColor: 'rgba(241,235,224,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 18,
  },
  searchSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: tokens.colors.gold,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 11,
    fontFamily: 'System',
    fontSize: 14.5,
    color: tokens.colors.fg,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.5)',
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    gap: 8,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.fg,
    marginBottom: 2,
  },
  searchResultArtist: {
    fontSize: 13,
    color: 'rgba(241,235,224,0.6)',
  },
  noResults: {
    fontFamily: 'System',
    fontSize: 14,
    color: 'rgba(241,235,224,0.4)',
    textAlign: 'center',
    marginTop: 32,
  },
});
