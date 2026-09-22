import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme, Animated, TouchableOpacity, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Title, useTheme, Text, Surface, ProgressBar, IconButton, Button, Paragraph, Avatar } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

function SkeletonCard({ style }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return <Animated.View style={[style, { opacity, backgroundColor: '#E5E7EB' }]} />;
}

const BARAKAH_AYAHS = [
  { text: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', ref: 'SURAH IBRAHIM 14:7' },
  { text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ', ref: 'SURAH AT-TALAQ 65:2-3' },
  { text: 'يَمْحَقُ اللَّهُ الرِّبَا وَيُرْبِي الصَّدَقَاتِ', ref: 'SURAH AL-BAQARAH 2:276' },
  { text: 'إِنَّ اللَّهَ هُوَ الرَّزَّاقُ ذُو الْقُوَّةِ الْمَتِينُ', ref: 'SURAH ADH-DHARIYAT 51:58' },
  { text: 'وَمَا أَنفَقْتُم مِّن شَيْءٍ فَهو يُخْلِفُهُ', ref: 'SURAH SABA 34:39' },
];

export default function DashboardScreen({ navigation }) {
  const committees = useStore((state) => state.committees);
  const members = useStore((state) => state.members);
  const importState = useStore((state) => state.importState);
  const fetchData = useStore((state) => state.fetchData);
  const [adminName, setAdminName] = useState('Admin');
  const [loading, setLoading] = useState(true);
  const [showAdminControls, setShowAdminControls] = useState(false);
  const [selectedAyah, setSelectedAyah] = useState(BARAKAH_AYAHS[0]);
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  const themePreference = useStore((state) => state.themePreference);
  const setThemePreference = useStore((state) => state.setThemePreference);
  const toggleTheme = () => {
    const next = themePreference === 'light' ? 'dark' : themePreference === 'dark' ? 'system' : 'light';
    setThemePreference(next);
  };
  const themeIcon = themePreference === 'light' ? 'weather-sunny' : themePreference === 'dark' ? 'weather-night' : 'brightness-auto';

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Select a random Ayah for this session
    setSelectedAyah(BARAKAH_AYAHS[Math.floor(Math.random() * BARAKAH_AYAHS.length)]);
    
    const loadData = async () => {
      await fetchData();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        setAdminName(user.user_metadata.full_name || user.user_metadata.display_name || user.user_metadata.name || 'Admin');
      }
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

      // In-app update check against production releases manifest
      try {
        const resp = await fetch('https://hatif0786.github.io/rosca-admin-app/website-blueprint/releases.json');
        if (resp.ok) {
          const manifest = await resp.json();
          const latest = manifest?.latestRelease;
          if (latest && latest.version && latest.version !== '1.0.1') {
            const currentParts = '1.0.1'.split('.').map(Number);
            const latestParts = latest.version.split('.').map(Number);
            const isNewer = latestParts[0] > currentParts[0] || 
              (latestParts[0] === currentParts[0] && latestParts[1] > currentParts[1]) ||
              (latestParts[0] === currentParts[0] && latestParts[1] === currentParts[1] && latestParts[2] > currentParts[2]);

            if (isNewer) {
              const downloadUrl = latest.downloadUrl || 'https://hatif0786.github.io/rosca-admin-app/';
              const notes = (latest.releaseNotes || []).join('\n• ');
              const { Alert, Linking } = require('react-native');
              Alert.alert(
                `🚀 New Update Available (v${latest.version})`,
                `A new stable version of Rizqly is ready!\n\n${notes ? '• ' + notes + '\n\n' : ''}Would you like to download the update now?`,
                [
                  { text: 'Later', style: 'cancel' },
                  { text: 'Update Now', onPress: () => Linking.openURL(downloadUrl) }
                ]
              );
            }
          }
        }
      } catch (err) {
        console.log('[Update Check Skipped]:', err.message);
      }
    };
    loadData();
  }, []);

  // Dynamic Transaction Aggregator for Live Activity Feed
  let allTransactions = [];
  committees.forEach(c => {
    // 1. Paid Contributions
    (c.contributions || []).forEach(con => {
      if (con.status === 'paid') {
        const m = members.find(mem => mem.id === con.memberId);
        allTransactions.push({
          id: `${c.id}_con_${con.memberId}_${con.cycleNumber}_${con.paymentNumber}`,
          type: 'Contribution',
          amount: c.weeklyContribution || c.contributionAmount,
          memberName: m ? m.name : 'Unknown',
          committeeName: c.name,
          date: con.updated_at || con.updatedAt || c.start_date || c.startDate,
          label: c.frequency === 'Weekly' ? `W${con.paymentNumber} • Cycle ${con.cycleNumber}` : `Cycle ${con.cycleNumber}`
        });
      }
    });
    
    // 2. Disbursed Payouts
    (c.payouts || []).forEach(p => {
      const m = members.find(mem => mem.id === p.memberId);
      allTransactions.push({
        id: `${c.id}_pay_${p.memberId}_${p.cycleNumber}`,
        type: 'Payout',
        amount: p.amount,
        memberName: m ? m.name : 'Unknown',
        committeeName: c.name,
        date: p.date,
        label: `Cycle ${p.cycleNumber} Disbursed`
      });
    });
  });
  
  // Sort by date (newest first)
  allTransactions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // --- Metrics ---
  const activeCommitteesCount = committees.filter(c => (c.payouts?.length || 0) < (c.members?.length || 0)).length;
  const totalMoneyManaged = committees.reduce((acc, c) => acc + (Number(c.totalAmount) * Number(c.cycles)), 0);
  const totalDisbursed = committees.reduce((acc, c) => acc + (c.payouts?.reduce((a, p) => a + Number(p.amount), 0) || 0), 0);
  
  let pendingPayoutsCount = 0;
  committees.forEach(c => {
    const payoutsPerCycle = c.frequency === 'Weekly' ? (c.payoutsPerCycle || 2) : 1;
    c.schedule?.forEach(s => {
      const totalNeeded = c.members.length * (c.paymentsPerCycle || 1);
      const totalMade = (c.contributions || []).filter(co => co.cycleNumber === s.cycleNumber && co.status === 'paid').length;
      const cyclePays = (c.payouts || []).filter(p => p.cycleNumber === s.cycleNumber);
      if (totalMade >= totalNeeded && cyclePays.length < payoutsPerCycle) pendingPayoutsCount++;
    });
  });

  const handleLogout = async () => await supabase.auth.signOut();
  const handleExport = async () => {
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        alert("Sharing is not available on this device");
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}Rizqly_Backup.json`;
      const backupData = JSON.stringify({ committees, members }, null, 2);
      await FileSystem.writeAsStringAsync(fileUri, backupData);
      
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Rizqly Backup Data',
        UTI: 'public.json'
      });
    } catch (e) { 
      console.error(e);
      alert('Backup failed: ' + e.message); 
    }
  };

  const handleImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled) return;
    try {
      const uri = result.assets ? result.assets[0].uri : result.uri;
      const content = await FileSystem.readAsStringAsync(uri);
      const data = JSON.parse(content);
      if (data.committees && data.members) { importState(data); alert('Restored!'); }
    } catch (e) { alert('Restore failed.'); }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.heroHeader, { backgroundColor: '#064E3B' }]}>
          <SkeletonCard style={{ width: 150, height: 20, borderRadius: 10, marginBottom: 10 }} />
          <SkeletonCard style={{ width: 200, height: 40, borderRadius: 10 }} />
          <SkeletonCard style={[styles.mainBalanceBox, { height: 180, marginTop: 30, width: '100%' }]} />
        </View>
        <View style={styles.content}>
          <SkeletonCard style={[styles.summaryPanel, { height: 100 }]} />
          <SkeletonCard style={[styles.toolCard, { height: 150, marginTop: 30 }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.ScrollView 
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={['#064E3B', '#022C22']} style={styles.heroHeader}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Icon name="rhombus-split" size={38} color="#D4AF37" style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.arabicHeading}>أهلاً وسهلاً</Text>
                <Title style={styles.headerTitle}>بيت المال</Title>
                <Text style={styles.headerSubtitle}>Welcome, {adminName}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <IconButton 
                icon={showAdminControls ? "cog" : "cog-outline"} 
                iconColor="#D4AF37" 
                size={24} 
                style={{ margin: 0 }}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowAdminControls(!showAdminControls);
                }} 
              />
              <IconButton icon={themeIcon} iconColor="#D4AF37" size={24} style={{ margin: 0 }} onPress={toggleTheme} />
              <IconButton icon="logout" iconColor="#D4AF37" size={24} style={{ margin: 0 }} onPress={handleLogout} />
            </View>
          </View>
          
          <Surface style={styles.mainBalanceBox} elevation={0}>
            <Text style={styles.balanceLabel}>TOTAL VOLUME UNDER MANAGEMENT</Text>
            <Text style={styles.balanceValue}>Rs {totalMoneyManaged.toLocaleString()}</Text>
            <View style={styles.balanceStats}>
              <View style={styles.balItem}>
                <Text style={styles.balLabel}>DISBURSED</Text>
                <Text style={styles.balValue}>Rs {totalDisbursed.toLocaleString()}</Text>
              </View>
              <View style={styles.balDivider} />
              <View style={styles.balItem}>
                <Text style={styles.balLabel}>AVAILABLE</Text>
                <Text style={styles.balValue}>Rs {(totalMoneyManaged - totalDisbursed).toLocaleString()}</Text>
              </View>
            </View>
          </Surface>
        </LinearGradient>

        <View style={styles.content}>
          <Surface style={[styles.summaryPanel, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.metricRow}>
              <TouchableOpacity style={styles.metricItem} onPress={() => navigation.navigate('Committees')}>
                <Icon name="chart-box-outline" size={22} color="#D4AF37" />
                <Text style={[styles.metricNumber, { color: theme.colors.onSurface }]}>{activeCommitteesCount}</Text>
                <Text style={styles.metricSub}>Active Groups</Text>
              </TouchableOpacity>
              <View style={styles.vDivider} />
              <TouchableOpacity style={styles.metricItem} onPress={() => navigation.navigate('Members')}>
                <Icon name="account-group-outline" size={22} color="#D4AF37" />
                <Text style={[styles.metricNumber, { color: theme.colors.onSurface }]}>{members.length}</Text>
                <Text style={styles.metricSub}>Total Members</Text>
              </TouchableOpacity>
              <View style={styles.vDivider} />
              <TouchableOpacity style={styles.metricItem} onPress={() => navigation.navigate('Committees')}>
                <Icon name="clock-alert-outline" size={22} color={pendingPayoutsCount > 0 ? '#ef4444' : '#10b981'} />
                <Text style={[styles.metricNumber, { color: theme.colors.onSurface }]}>{pendingPayoutsCount}</Text>
                <Text style={styles.metricSub}>Open Payouts</Text>
              </TouchableOpacity>
            </View>
          </Surface>

          {/* --- Live Recent Activity Feed --- */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
              <Title style={[styles.sectionHeader, { color: theme.colors.onSurface, marginBottom: 0 }]}>Recent Activity</Title>
              <Button mode="text" compact onPress={() => navigation.navigate('Ledger')} textColor="#D4AF37" labelStyle={{ fontWeight: 'bold' }}>View All</Button>
            </View>
            
            {allTransactions.length === 0 ? (
              <Surface style={[styles.toolCard, { backgroundColor: theme.colors.surface, padding: 24, alignItems: 'center', justifyContent: 'center' }]} elevation={1}>
                <Icon name="swap-horizontal" size={32} color="#D4AF37" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#888', textAlign: 'center', fontSize: 13 }}>No recent transactions recorded yet.</Text>
              </Surface>
            ) : (
              <Surface style={[styles.toolCard, { backgroundColor: theme.colors.surface, padding: 8 }]} elevation={1}>
                {allTransactions.slice(0, 3).map((t, idx) => (
                  <View key={t.id} style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Avatar.Icon 
                          size={36} 
                          icon={t.type === 'Payout' ? 'arrow-up-bold' : 'arrow-down-bold'} 
                          backgroundColor={t.type === 'Payout' ? 'rgba(212, 175, 55, 0.12)' : 'rgba(16, 185, 129, 0.12)'} 
                          color={t.type === 'Payout' ? '#D4AF37' : '#10b981'} 
                        />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={{ color: theme.colors.onSurface, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{t.memberName}</Text>
                          <Text style={{ color: '#888', fontSize: 11 }} numberOfLines={1}>{t.committeeName} • {t.label}</Text>
                        </View>
                      </View>
                      <Text style={{ fontWeight: 'bold', color: t.type === 'Payout' ? '#D4AF37' : '#10b981', fontSize: 15 }}>
                        {t.type === 'Payout' ? '-' : '+'} Rs {t.amount.toLocaleString()}
                      </Text>
                    </View>
                    {idx < 2 && idx < allTransactions.length - 1 && (
                      <View style={[styles.hDivider, { backgroundColor: theme.colors.outline, marginTop: 12, marginHorizontal: 0 }]} />
                    )}
                  </View>
                ))}
              </Surface>
            )}
          </View>

          {showAdminControls && (
            <View style={styles.section}>
              <Title style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>Administrative Controls</Title>
              <Surface style={[styles.toolCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <TouchableOpacity style={styles.toolRow} onPress={handleExport}>
                  <View style={styles.toolIconBox}>
                    <Icon name="database-export-outline" size={22} color="#064E3B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toolTitle, { color: theme.colors.onSurface }]}>Export Local Backup</Text>
                    <Text style={styles.toolHint}>Secure your entire ledger as a JSON file</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#ccc" />
                </TouchableOpacity>
                
                <View style={[styles.hDivider, { backgroundColor: theme.colors.outline }]} />
                
                <TouchableOpacity style={styles.toolRow} onPress={handleImport}>
                  <View style={styles.toolIconBox}>
                    <Icon name="database-import-outline" size={22} color="#064E3B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toolTitle, { color: theme.colors.onSurface }]}>Restore from Backup</Text>
                    <Text style={styles.toolHint}>Import records from a previous export</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#ccc" />
                </TouchableOpacity>

                <View style={[styles.hDivider, { backgroundColor: theme.colors.outline }]} />

                <TouchableOpacity style={styles.toolRow} onPress={() => navigation.navigate('WhatsAppSettings')}>
                  <View style={[styles.toolIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Icon name="whatsapp" size={22} color="#92400E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toolTitle, { color: theme.colors.onSurface }]}>WhatsApp Integration</Text>
                    <Text style={styles.toolHint}>Connect QR code & dedicated WhatsApp instance</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#ccc" />
                </TouchableOpacity>
              </Surface>
            </View>
          )}
          
          <View style={styles.ayahRow}>
            <Text style={styles.ayahText}>{selectedAyah.text}</Text>
            <Text style={styles.ayahSub}>{selectedAyah.ref}</Text>
          </View>

          <View style={styles.copyrightRow}>
            <Text style={styles.copyrightText}>© 2026 RIZQLY • DEVELOPED BY HATIF</Text>
            <Text style={styles.copyrightSub}>ALL RIGHTS RESERVED • VERSION 1.0.1</Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 10 },
  heroHeader: { padding: 24, paddingTop: 55, paddingBottom: 25, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  arabicHeading: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'serif',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'serif',
    letterSpacing: 0.5,
    lineHeight: 32,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  headerActions: { flexDirection: 'row' },
  mainBalanceBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', padding: 24, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  balanceLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
  balanceValue: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 12, fontFamily: 'serif' },
  balanceStats: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginTop: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  balItem: { alignItems: 'center' },
  balLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 'bold' },
  balValue: { color: '#D4AF37', fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  balDivider: { width: 1, height: 25, backgroundColor: 'rgba(255,255,255,0.1)' },
  content: { padding: 20, marginTop: -40 },
  summaryPanel: { borderRadius: 32, padding: 20 },
  metricRow: { flexDirection: 'row', alignItems: 'center' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricNumber: { fontSize: 24, fontWeight: 'bold', marginTop: 6 },
  metricSub: { fontSize: 10, color: '#888', marginTop: 2, fontWeight: 'bold' },
  vDivider: { width: 1, height: 40, backgroundColor: 'rgba(0,0,0,0.05)' },
  section: { marginTop: 35 },
  sectionHeader: { fontSize: 20, fontWeight: 'bold', fontFamily: 'serif', marginBottom: 16, marginLeft: 4 },
  toolCard: { borderRadius: 32, padding: 10 },
  toolRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  toolIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  toolTitle: { fontSize: 16, fontWeight: 'bold' },
  toolHint: { fontSize: 12, color: '#888', marginTop: 2 },
  hDivider: { height: 1, marginHorizontal: 20 },
  ayahRow: { marginTop: 15, marginBottom: 10, alignItems: 'center' },
  ayahText: { fontSize: 32, color: '#D4AF37', fontFamily: 'serif', lineHeight: 48, textAlign: 'center', fontWeight: 'bold' },
  ayahSub: { fontSize: 9, color: 'rgba(212, 175, 55, 0.4)', letterSpacing: 3, marginTop: 8, fontWeight: 'bold' },
  copyrightRow: { alignItems: 'center', marginBottom: 5, opacity: 0.3 },
  copyrightText: { fontSize: 9, color: '#D4AF37', letterSpacing: 2, fontWeight: 'bold' },
  copyrightSub: { fontSize: 7, color: '#D4AF37', letterSpacing: 1, marginTop: 4 },
});
