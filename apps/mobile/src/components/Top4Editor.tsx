/**
 * Top 4 Editor - Modal for selecting favorite albums
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../lib/tokens';
import { Icon } from './atoms/Icon';
import { api } from '../lib/api-client';

interface Album {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string;
}

interface Top4EditorProps {
  visible: boolean;
  currentTop4: Album[];
  onClose: () => void;
  onSave: (albums: Album[]) => Promise<void>;
}

export function Top4Editor({ visible, currentTop4, onClose, onSave }: Top4EditorProps) {
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>(currentTop4);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Album[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const gold = tokens.colors.gold;

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await api.searchAlbums(searchQuery);
      setSearchResults(results.slice(0, 20)); // Limit to 20 results
    } catch (error) {
      console.error('Failed to search albums:', error);
      Alert.alert('Search failed', 'Could not search for albums. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }

  function toggleAlbum(album: Album) {
    const isSelected = selectedAlbums.some(a => a.id === album.id);

    if (isSelected) {
      setSelectedAlbums(selectedAlbums.filter(a => a.id !== album.id));
    } else {
      if (selectedAlbums.length >= 4) {
        Alert.alert('Maximum reached', 'You can only select up to 4 albums');
        return;
      }
      setSelectedAlbums([...selectedAlbums, album]);
    }
  }

  async function handleSave() {
    if (selectedAlbums.length !== 4) {
      Alert.alert('Select 4 albums', 'Please select exactly 4 albums for your favorites');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedAlbums);
      onClose();
    } catch (error) {
      console.error('Failed to save Top 4:', error);
      Alert.alert('Save failed', 'Could not save your Top 4. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedAlbums(currentTop4);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <LinearGradient
          colors={['#221f1b', '#161412', '#0e0d0c']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Edit Top 4</Text>
              <Text style={styles.subtitle}>
                {selectedAlbums.length}/4 selected
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Icon name="close" size={20} color={tokens.colors.fg} />
            </TouchableOpacity>
          </View>

          {/* Selected Albums */}
          {selectedAlbums.length > 0 && (
            <View style={styles.selectedSection}>
              <Text style={styles.sectionLabel}>YOUR TOP 4</Text>
              <View style={styles.selectedGrid}>
                {selectedAlbums.map((album, index) => (
                  <TouchableOpacity
                    key={album.id}
                    onPress={() => toggleAlbum(album)}
                    style={styles.selectedAlbum}
                  >
                    <Image source={{ uri: album.artworkUrl }} style={styles.selectedArt} />
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>{index + 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {/* Empty slots */}
                {[...Array(4 - selectedAlbums.length)].map((_, i) => (
                  <View key={`empty-${i}`} style={styles.emptySlot}>
                    <Text style={styles.emptySlotText}>+</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchSection}>
            <Text style={styles.sectionLabel}>SEARCH ALBUMS</Text>
            <View style={styles.searchRow}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                placeholder="Search for albums..."
                placeholderTextColor="rgba(241,235,224,0.3)"
                style={styles.searchInput}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                style={[
                  styles.searchButton,
                  { backgroundColor: isSearching || !searchQuery.trim() ? 'rgba(241,235,224,0.12)' : gold },
                ]}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color={tokens.colors.nearBlack} />
                ) : (
                  <Text style={[styles.searchButtonText, { color: tokens.colors.nearBlack }]}>
                    Search
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Results */}
          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedAlbums.some(a => a.id === item.id);
                return (
                  <TouchableOpacity
                    onPress={() => toggleAlbum(item)}
                    style={[
                      styles.resultItem,
                      isSelected && { backgroundColor: `${gold}14`, borderColor: gold },
                    ]}
                  >
                    <Image source={{ uri: item.artworkUrl }} style={styles.resultArt} />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultAlbum} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultArtist} numberOfLines={1}>
                        {item.artist}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkmark, { backgroundColor: gold }]}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={selectedAlbums.length !== 4 || isSaving}
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    selectedAlbums.length === 4 && !isSaving ? gold : 'rgba(241,235,224,0.12)',
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={tokens.colors.nearBlack} />
              ) : (
                <Text
                  style={[
                    styles.saveButtonText,
                    {
                      color:
                        selectedAlbums.length === 4
                          ? tokens.colors.nearBlack
                          : 'rgba(241,235,224,0.4)',
                    },
                  ]}
                >
                  Save Top 4
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  title: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    color: tokens.colors.fg,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: 'Menlo',
    fontSize: 12,
    color: tokens.colors.gold,
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: `${tokens.colors.fg}24`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: 'rgba(241,235,224,0.45)',
    marginBottom: 12,
  },
  selectedGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  selectedAlbum: {
    width: 70,
    height: 70,
    borderRadius: 8,
    position: 'relative',
  },
  selectedArt: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.nearBlack,
  },
  emptySlot: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(241,235,224,0.18)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontSize: 24,
    color: 'rgba(241,235,224,0.3)',
  },
  searchSection: {
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 12,
    fontFamily: 'System',
    fontSize: 14.5,
    color: tokens.colors.fg,
  },
  searchButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsList: {
    paddingBottom: 100,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(241,235,224,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.08)',
    marginBottom: 8,
  },
  resultArt: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultAlbum: {
    fontFamily: 'System',
    fontSize: 14.5,
    fontWeight: '600',
    color: tokens.colors.fg,
    marginBottom: 2,
  },
  resultArtist: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(241,235,224,0.6)',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 14,
    color: tokens.colors.nearBlack,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: 34,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
  },
});
