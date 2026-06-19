import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, StatusBar as RNStatusBar, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { FeedScreen, ExperienceScreen, ProfileScreen, ComposerScreen, LoginScreen, OnboardingScreen } from './src/screens';
import { MenuIcon, PlusIcon } from './src/components/atoms';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SideMenu } from './src/components/SideMenu';
import { tokens } from './src/lib/tokens';
import type { FeedReview } from './src/lib/feed-types';
// Push notifications are temporarily disabled on BOTH platforms pending an
// iOS provisioning-profile update (see TODO below + commented plugin in
// app.config.ts). The implementation is parked at ./src/services/notifications.ts
// (excluded from tsconfig). To re-enable: (1) add expo-notifications back to
// package.json, (2) un-exclude the service in tsconfig.json, (3) restore the
// plugin in app.config.ts, (4) uncomment the init block below.

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function AppContent() {
  const { user, isLoading, needsOnboarding, completeOnboarding } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'profile'>('feed');
  const [activeReview, setActiveReview] = useState<FeedReview | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // TODO: Re-enable after updating provisioning profile with push notifications
  // Initialize notifications when user is logged in
  // useEffect(() => {
  //   if (user) {
  //     initializeNotifications();
  //   }
  // }, [user]);

  // async function initializeNotifications() {
  //   try {
  //     const token = await notificationService.initialize();
  //     console.log('Push token:', token);

  //     // Schedule daily prompt (for testing, triggers after 5 seconds)
  //     await notificationService.scheduleDailyPrompt();

  //     // Listen for notification taps
  //     notificationService.addNotificationResponseListener((response) => {
  //       const data = response.notification.request.content.data;
  //       console.log('Notification tapped:', data);

  //       // TODO: Open composer with track/album from notification data
  //       setComposerOpen(true);
  //     });
  //   } catch (error) {
  //     console.error('Failed to initialize notifications:', error);
  //   }
  // }

  const openReview = (review: FeedReview) => {
    setActiveReview(review);
  };

  const closeReview = () => {
    setActiveReview(null);
  };

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={tokens.colors.fg} />
      </View>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LoginScreen />
      </View>
    );
  }

  // Show onboarding for new users who need to complete profile setup
  if (needsOnboarding) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={completeOnboarding} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#221f1b', '#161412', '#0e0d0c']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Main content */}
      <View style={styles.main}>
        {/* Sticky header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.branding}>
              <Text style={styles.appTitle}>LinerNotes</Text>
              <View style={styles.betaBadge}>
                <Text style={styles.betaText}>beta</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
              <MenuIcon size={20} color={tokens.colors.fg} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab content */}
        {activeTab === 'feed' && (
          <FeedScreen
            onOpenReview={openReview}
            onOpenComposer={() => setComposerOpen(true)}
          />
        )}
        {activeTab === 'profile' && <ProfileScreen />}

        {/* Bottom tab bar */}
        <View style={styles.tabBar}>
          <TabButton
            label="feed"
            active={activeTab === 'feed'}
            onPress={() => setActiveTab('feed')}
          />
          <LogButton onPress={() => setComposerOpen(true)} />
          <TabButton
            label="you"
            active={activeTab === 'profile'}
            onPress={() => setActiveTab('profile')}
          />
        </View>
      </View>

      {/* Experience overlay (hero expand) */}
      {activeReview && (
        <View style={styles.experienceOverlay}>
          <ExperienceScreen review={activeReview} onClose={closeReview} />
        </View>
      )}

      {/* Composer sheet */}
      {composerOpen && (
        <View style={styles.composerOverlay}>
          <ComposerScreen onClose={() => setComposerOpen(false)} />
        </View>
      )}

      {/* Side menu (friends, edit profile, log out) */}
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tab}>
      <Text
        style={[
          styles.tabLabel,
          {
            color: active ? tokens.colors.fg : tokens.colors.gold + '66',
            borderTopColor: active ? tokens.colors.gold : 'transparent',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LogButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.logButton}>
      <PlusIcon size={20} color={tokens.colors.nearBlack} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.nearBlack,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  main: {
    flex: 1,
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 12,
    minHeight: 104,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  appTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 20,
    color: tokens.colors.fg,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  betaBadge: {
    borderWidth: 1,
    borderColor: `${tokens.colors.gold}55`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'relative',
    top: -4,
  },
  betaText: {
    fontFamily: 'System',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: tokens.colors.gold,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: tokens.colors.fg + '24',
    backgroundColor: tokens.colors.nearBlack,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.gold,
    borderWidth: 1.5,
    borderColor: tokens.colors.nearBlack,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 7,
    paddingBottom: 26,
    paddingTop: 11,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabLabel: {
    fontFamily: 'System',
    fontSize: 11.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '600',
    borderTopWidth: 1.5,
    paddingTop: 2,
  },
  logButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: tokens.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  experienceOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  composerOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
