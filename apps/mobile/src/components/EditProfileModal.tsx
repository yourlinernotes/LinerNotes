/**
 * Full-screen Edit Profile modal, shared by the profile page and the side menu.
 * Fetches the full current-user profile on open (so bio pre-fills correctly).
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { tokens } from '../lib/tokens';
import { Icon } from './atoms/Icon';
import { EditProfileForm } from './EditProfileForm';
import type { User } from '../lib/types';

export function EditProfileModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api
      .getMyProfile()
      .then((u) => setFullUser(u))
      .catch(() => setFullUser(user))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit profile</Text>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <Icon name="close" size={18} color={tokens.colors.fg} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.fg} />
          </View>
        ) : (
          <EditProfileForm user={fullUser ?? user} onSaved={onSaved} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: tokens.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,235,224,0.08)',
  },
  title: { fontFamily: tokens.typography.rnFonts.bodySemibold, fontSize: 18, fontWeight: '600', color: tokens.colors.fg },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
