import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme, Animated } from 'react-native';
import { Title, useTheme, Text, Surface, ProgressBar, IconButton, Button } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';

export default function DashboardScreen({ navigation }) {
  const committees = useStore((state) => state.committees);
  const members = useStore((state) => state.members);
  const importState = useStore((state) => state.importState);
  const fetchData = useStore((state) => state.fetchData);
  const [adminName, setAdminName] = useState('Admin');
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // --- Backup & Restore Logic ---
  const handleExport = async () => {
    try {
      const fullState = { committees, members };
      const jsonString = JSON.stringify(fullState);
      const fileName = `CommitteeBox_Backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, jsonString);
      await Sharing.shareAsync(fileUri);
    } catch (e) {
      console.log('Export failed', e);
      alert('Backup failed. Please try again.');
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);
      const importedData = JSON.parse(content);

      if (importedData.committees && importedData.members) {
        importState(importedData);
        alert('Data Restored Successfully!');
      } else {
        alert('Invalid backup file. Please select a valid Committee Box backup.');
      }
    } catch (e) {
      console.log('Import failed', e);
      alert('Restore failed. Ensure the file is a valid JSON backup.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Initial fetch
    fetchData();
    
    // Get Admin Name
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.display_name) {
        setAdminName(user.user_metadata.display_name);
      }
    });

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  // Metrics
  const totalMembers = members.length;
  const activeCommitteesCount = committees.filter(c => (c.payouts?.length || 0) < (c.members?.length || 0)).length;
  const completedCommitteesCount = committees.length - activeCommitteesCount;
  
  const totalMoneyManaged = committees.reduce((acc, c) => acc + c.totalAmount * c.cycles * (c.frequency === 'Weekly' ? (c.payoutsPerCycle || 2) : 1), 0);
  const totalDisbursed = committees.reduce((acc, c) => acc + c.payouts.reduce((a, p) => a + p.amount, 0), 0);
  const totalCollected = committees.reduce((acc, c) => {
    const perPayment = c.frequency === 'Weekly' ? c.weeklyContribution : c.contributionAmount;
    return acc + c.contributions.filter(co => co.status === 'paid').length * perPayment;
  }, 0);

  // Pending payouts
  let pendingPayouts = [];
  committees.forEach(c => {
    const paymentsPerCycle = c.paymentsPerCycle || 1;
    const payoutsPerCycle = c.frequency === 'Weekly' ? (c.payoutsPerCycle || 2) : 1;
    c.schedule.forEach(s => {
      const totalNeeded = c.members.length * paymentsPerCycle;
      const totalMade = c.contributions.filter(co => co.cycleNumber === s.cycleNumber && co.status === 'paid').length;
      const cyclePays = c.payouts.filter(p => p.cycleNumber === s.cycleNumber);
      if (totalMade >= totalNeeded && cyclePays.length < payoutsPerCycle) {
        pendingPayouts.push({ committeeId: c.id, committeeName: c.name, label: s.label, amount: c.totalAmount });
      }
    });
  });

  // Active collections
  let activeCollections = [];
  committees.filter(c => (c.payouts?.length || 0) < (c.members?.length || 0)).forEach(c => {
    const paymentsPerCycle = c.paymentsPerCycle || 1;
    const activeCycle = c.schedule.find(s => {
      const totalNeeded = c.members.length * paymentsPerCycle;
      const totalMade = c.contributions.filter(co => co.cycleNumber === s.cycleNumber && co.status === 'paid').length;
      return totalMade < totalNeeded;
    });
    if (activeCycle) {
      const totalNeeded = c.members.length * paymentsPerCycle;
      const totalMade = c.contributions.filter(co => co.cycleNumber === activeCycle.cycleNumber && co.status === 'paid').length;
      activeCollections.push({
        committeeId: c.id, committeeName: c.name, label: activeCycle.label,
        progress: totalMade / totalNeeded, paid: totalMade, total: totalNeeded,
      });
    }
  });

  const themePreference = useStore((state) => state.themePreference);
  const setThemePreference = useStore((state) => state.setThemePreference);

  const toggleTheme = () => {
    const next = themePreference === 'light' ? 'dark' : themePreference === 'dark' ? 'system' : 'light';
    setThemePreference(next);
  };

  const themeIcon = themePreference === 'light' ? 'weather-sunny' : themePreference === 'dark' ? 'weather-night' : 'brightness-auto';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: '#064E3B', paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title style={[styles.headerTitle, { color: '#D4AF37', fontSize: 32, fontWeight: 'bold', fontFamily: 'serif' }]}>وصلة</Title>
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon={themeIcon} iconColor="#D4AF37" size={24} onPress={toggleTheme} />
            <IconButton icon="logout" iconColor="#D4AF37" size={24} onPress={handleLogout} />
          </View>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '500', fontFamily: 'serif' }}>Marhaba, {adminName} 👋</Text>
      </View>
      
      <Animated.ScrollView contentContainerStyle={styles.content}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Stats Grid */}
        <Animated.View style={[styles.statsGrid, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient colors={isDark ? ['#667eea', '#764ba2'] : ['#6200EE', '#9D50BB']} style={styles.statCard} start={{x:0,y:0}} end={{x:1,y:1}}>
            <Text style={styles.statEmoji}>📋</Text>
            <Text style={styles.statNumber}>{activeCommitteesCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </LinearGradient>
          <LinearGradient colors={isDark ? ['#00c6ff', '#0072ff'] : ['#4facfe', '#00f2fe']} style={styles.statCard} start={{x:0,y:0}} end={{x:1,y:1}}>
            <Text style={styles.statEmoji}>👥</Text>
            <Text style={styles.statNumber}>{totalMembers}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </LinearGradient>
          <LinearGradient colors={isDark ? ['#f093fb', '#f5576c'] : ['#fa709a', '#fee140']} style={styles.statCard} start={{x:0,y:0}} end={{x:1,y:1}}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={styles.statNumber}>{completedCommitteesCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </LinearGradient>
        </Animated.View>

        {/* Financial Summary */}
        <Surface style={[styles.financialCard, { backgroundColor: theme.colors.surface, borderColor: '#eee', borderWidth: isDark ? 0 : 1 }]} elevation={2}>
          <Title style={[styles.finTitle, { color: theme.colors.primary, fontFamily: 'serif' }]}>💰 Global Ledger</Title>
          <View style={styles.finRow}>
            <View style={styles.finItem}>
              <Text style={{ color: isDark ? '#aaa' : '#666', fontSize: 11, fontWeight: 'bold' }}>COLLECTED</Text>
              <Text style={[styles.finValue, { color: '#2e7d32' }]}>Rs {totalCollected.toLocaleString()}</Text>
            </View>
            <View style={[styles.finDivider, { backgroundColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(6,78,59,0.1)' }]} />
            <View style={styles.finItem}>
              <Text style={{ color: isDark ? '#aaa' : '#666', fontSize: 11, fontWeight: 'bold' }}>DISBURSED</Text>
              <Text style={[styles.finValue, { color: '#B8860B' }]}>Rs {totalDisbursed.toLocaleString()}</Text>
            </View>
            <View style={[styles.finDivider, { backgroundColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(6,78,59,0.1)' }]} />
            <View style={styles.finItem}>
              <Text style={{ color: isDark ? '#aaa' : '#666', fontSize: 11, fontWeight: 'bold' }}>TOTAL</Text>
              <Text style={[styles.finValue, { color: theme.colors.primary }]}>Rs {totalMoneyManaged.toLocaleString()}</Text>
            </View>
          </View>
        </Surface>

        {/* Pending Payouts */}
        <Title style={[styles.sectionTitle, { color: theme.colors.onBackground, fontFamily: 'serif' }]}>⏳ Pending Payouts</Title>
        {pendingPayouts.length === 0 ? (
          <Surface style={[styles.surfaceCard, { backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : '#F0FDF4', borderColor: '#4caf50', borderWidth: isDark ? 0 : 1 }]} elevation={1}>
            <Text style={{ color: '#2e7d32', fontWeight: '500' }}>✓ All caught up! No pending payouts.</Text>
          </Surface>
        ) : (
          pendingPayouts.map((payout, idx) => (
            <Surface key={idx} style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : '#FFFBEB', borderColor: '#D4AF37', borderWidth: 1 }]} elevation={2}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#B8860B', fontWeight: 'bold', fontSize: 15 }}>💰 Payout Ready</Text>
                <Text style={{ color: theme.colors.onSurface, marginTop: 2, fontWeight: '500' }}>{payout.committeeName} — {payout.label}</Text>
                <Text style={{ color: '#064E3B', fontWeight: 'bold', fontSize: 16 }}>Rs {payout.amount.toLocaleString()}</Text>
              </View>
            </Surface>
          ))
        )}

        {/* Active Collections */}
        <Title style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>📊 Active Collections</Title>
        {activeCollections.length === 0 ? (
          <Surface style={[styles.surfaceCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text style={{ color: isDark ? '#aaa' : '#666' }}>No active collections. Create a committee!</Text>
          </Surface>
        ) : (
          activeCollections.map((col, idx) => (
            <Surface key={idx} style={[styles.surfaceCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.onSurface, fontWeight: 'bold', fontSize: 15 }}>{col.committeeName}</Text>
                  <Text style={{ color: isDark ? '#aaa' : '#666', fontSize: 13 }}>{col.label}</Text>
                </View>
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{col.paid}/{col.total}</Text>
              </View>
              <ProgressBar progress={col.progress} color={col.progress >= 1 ? '#4caf50' : theme.colors.primary} style={{ borderRadius: 4, height: 6 }} />
            </Surface>
          ))
        )}

      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 60, paddingBottom: 8 },
  headerTitle: { fontSize: 30, fontWeight: 'bold' },
  content: { padding: 16, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { 
    flex: 1, padding: 16, borderRadius: 16, alignItems: 'center',
    elevation: 4, shadowColor: '#6200EE', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  statEmoji: { fontSize: 20, marginBottom: 4 },
  statNumber: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  financialCard: { borderRadius: 16, padding: 16, marginBottom: 20 },
  finTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  finRow: { flexDirection: 'row', alignItems: 'center' },
  finItem: { flex: 1, alignItems: 'center' },
  finValue: { fontWeight: 'bold', fontSize: 14, marginTop: 4 },
  finDivider: { width: 1, height: 36 },
  sectionTitle: { marginBottom: 12, fontWeight: 'bold', fontSize: 18 },
  surfaceCard: { padding: 16, borderRadius: 16, marginBottom: 12 },
  actionCard: { padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
});
