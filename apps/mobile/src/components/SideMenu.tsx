/**
 * Side menu (drawer) opened from the feed header.
 * Views: menu → friends & requests / edit profile, plus log out.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api-client';
import { tokens } from '../lib/tokens';
import { Icon } from './atoms/Icon';
import { EditProfileForm } from './EditProfileForm';
import type { User } from '../lib/types';

type MenuView = 'menu' | 'friends' | 'edit';

export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, logout, refreshUser } = useAuth();
  const [view, setView] = useState<MenuView>('menu');
  const gold = tokens.colors.gold;

  // Reset to the menu root whenever the drawer is reopened.
  useEffect(() => {
    if (visible) setView('menu');
  }, [visible]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* logout is local; ignore */
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.panel}>
          {/* Panel header */}
          <View style={styles.panelHeader}>
            {view !== 'menu' ? (
              <TouchableOpacity onPress={() => setView('menu')} style={styles.headerBtn}>
                <Icon name="chevdown" size={20} color={tokens.colors.fg} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerBtn} />
            )}
            <Text style={styles.panelTitle}>
              {view === 'friends' ? 'Friends' : view === 'edit' ? 'Edit profile' : 'Menu'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="close" size={18} color={tokens.colors.fg} />
            </TouchableOpacity>
          </View>

          {view === 'menu' && (
            <View>
              {/* Profile summary */}
              <View style={styles.profileHeader}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.profileAvatar} />
                ) : (
                  <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                    <Text style={styles.profileMonogram}>
                      {(user?.displayName || user?.handle || '?')[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {user?.displayName || 'User'}
                  </Text>
                  <Text style={styles.profileHandle} numberOfLines={1}>
                    @{user?.handle || 'user'}
                  </Text>
                </View>
              </View>

              <View style={styles.menuList}>
                <MenuRow label="Friends & requests" onPress={() => setView('friends')} gold={gold} />
                <MenuRow label="Edit profile" onPress={() => setView('edit')} gold={gold} />
                <MenuRow label="Log out" onPress={handleLogout} gold={gold} danger />
              </View>
            </View>
          )}

          {view === 'friends' && <FriendsView />}
          {view === 'edit' && (
            <EditProfileForm
              user={user}
              onSaved={async () => {
                await refreshUser().catch(() => {});
                setView('menu');
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({
  label,
  onPress,
  gold,
  danger,
}: {
  label: string;
  onPress: () => void;
  gold: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.menuRowText, danger && { color: '#e0762f' }]}>{label}</Text>
      {!danger && <Text style={[styles.menuRowChevron, { color: gold }]}>›</Text>}
    </TouchableOpacity>
  );
}

// ─── Friends & requests ─────────────────────────────────────────────────────

function FriendsView() {
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<Array<{ id: string; requester: User }>>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [f, r] = await Promise.all([
      api.getFriends().catch(() => []),
      api.getReceivedRequests().catch(() => []),
    ]);
    setFriends(f);
    setRequests(r);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(requesterId: string, accept: boolean) {
    try {
      await api.respondToFriendRequest(requesterId, accept);
      load();
    } catch {
      Alert.alert('Error', 'Could not update that request. Please try again.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.colors.fg} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.viewContent}>
      <Text style={styles.sectionLabel}>REQUESTS · {requests.length}</Text>
      {requests.length === 0 && <Text style={styles.empty}>no pending requests</Text>}
      {requests.map((req) => (
        <View key={req.id} style={styles.personRow}>
          <PersonInfo user={req.requester} />
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: tokens.colors.gold }]}
              onPress={() => respond(req.requester.id, true)}
            >
              <Text style={styles.reqBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reqBtn, styles.reqBtnGhost]}
              onPress={() => respond(req.requester.id, false)}
            >
              <Text style={[styles.reqBtnText, { color: tokens.colors.fg }]}>Ignore</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={[styles.sectionLabel, { marginTop: 22 }]}>FRIENDS · {friends.length}</Text>
      {friends.length === 0 && <Text style={styles.empty}>no friends yet</Text>}
      {friends.map((f) => (
        <View key={f.id} style={styles.personRow}>
          <PersonInfo user={f} />
        </View>
      ))}
    </ScrollView>
  );
}

function PersonInfo({ user }: { user: User }) {
  return (
    <View style={styles.personInfo}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.personAvatar} />
      ) : (
        <View style={[styles.personAvatar, styles.personAvatarFallback]}>
          <Text style={{ color: tokens.colors.gold, fontWeight: '600' }}>
            {(user.displayName || user.handle || '?')[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.personName} numberOfLines={1}>
          {user.displayName || 'User'}
        </Text>
        <Text style={styles.personHandle} numberOfLines={1}>
          @{user.handle || 'user'}
        </Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    width: '80%',
    maxWidth: 340,
    backgroundColor: tokens.colors.bg,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(241,235,224,0.1)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  headerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { fontFamily: 'System', fontSize: 16, fontWeight: '600', color: tokens.colors.fg },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  profileAvatar: { width: 52, height: 52, borderRadius: 26 },
  profileAvatarFallback: {
    backgroundColor: 'rgba(217,178,90,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMonogram: { color: tokens.colors.gold, fontWeight: '600', fontSize: 22 },
  profileName: { fontFamily: 'System', fontSize: 17, fontWeight: '600', color: tokens.colors.fg },
  profileHandle: { fontFamily: 'Menlo', fontSize: 12, color: 'rgba(241,235,224,0.5)', marginTop: 2 },
  menuList: { paddingTop: 8 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 17,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.06)',
  },
  menuRowText: { fontFamily: 'System', fontSize: 15.5, color: tokens.colors.fg },
  menuRowChevron: { fontSize: 20 },
  viewContent: { padding: 18, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: 'rgba(241,235,224,0.45)',
    marginBottom: 10,
  },
  empty: { fontFamily: 'System', fontSize: 13, color: 'rgba(241,235,224,0.4)', marginBottom: 8 },
  personRow: { marginBottom: 14 },
  personInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personAvatar: { width: 38, height: 38, borderRadius: 19 },
  personAvatarFallback: {
    backgroundColor: 'rgba(217,178,90,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personName: { fontFamily: 'System', fontSize: 14, fontWeight: '600', color: tokens.colors.fg },
  personHandle: { fontFamily: 'Menlo', fontSize: 11, color: 'rgba(241,235,224,0.45)' },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 8, paddingLeft: 48 },
  reqBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  reqBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(241,235,224,0.2)' },
  reqBtnText: { fontFamily: 'System', fontSize: 12.5, fontWeight: '600', color: tokens.colors.nearBlack },
  fieldLabel: {
    fontFamily: 'Menlo',
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: 'rgba(241,235,224,0.45)',
    marginBottom: 7,
    marginTop: 14,
  },
  input: {
    backgroundColor: 'rgba(241,235,224,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(241,235,224,0.14)',
    borderRadius: 12,
    padding: 12,
    fontFamily: 'System',
    fontSize: 14.5,
    color: tokens.colors.fg,
  },
  saveBtn: { marginTop: 24, padding: 14, borderRadius: 13, alignItems: 'center' },
  saveBtnText: { fontFamily: 'System', fontSize: 15, fontWeight: '600' },
});
