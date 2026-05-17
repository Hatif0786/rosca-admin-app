import React from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme, Alert, SectionList, Animated } from 'react-native';
import { FAB, useTheme, Text, Surface, IconButton, Title, Paragraph } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';

export default function CommitteesScreen({ navigation }) {
  const committees = useStore((state) => state.committees);
  const deleteCommittee = useStore((state) => state.deleteCommittee);
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const activeCommittees = (committees || []).filter(c => (c.payouts?.length || 0) < (c.members?.length || 0));
  const completedCommittees = (committees || []).filter(c => (c.payouts?.length || 0) >= (c.members?.length || 0));

  const handleDelete = (committee) => {
    Alert.alert('Delete Committee', `Remove "${committee.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCommittee(committee.id) },
    ]);
  };

  const renderItem = (item) => {
    if (!item) return null;
    const isWeekly = item.frequency === 'Weekly';
    const totalMembers = item.members?.length || 0;
    const payoutsCount = item.payouts?.length || 0;
    const completionPercent = totalMembers > 0 ? (payoutsCount / totalMembers) : 0;
    const isComplete = payoutsCount >= totalMembers;

    return (
      <TouchableOpacity onPress={() => navigation.navigate('CommitteeDetail', { committeeId: item.id })} activeOpacity={0.9}>
        <Surface style={[styles.listItem, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Title style={[styles.title, { color: theme.colors.onSurface }]}>{item.name}</Title>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: isDark ? '#064E3B44' : '#F0FDF4' }]}>
                  <Text style={[styles.badgeText, { color: '#10b981' }]}>{item.frequency}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: isDark ? '#B8860B22' : '#FFFBEB', marginLeft: 6 }]}>
                  <Text style={[styles.badgeText, { color: '#D4AF37' }]}>{item.payout_method || 'Fixed'}</Text>
                </View>
              </View>
            </View>
            <IconButton icon="delete-outline" iconColor={isDark ? '#666' : '#ccc'} size={22} onPress={() => handleDelete(item)} />
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>MEMBERS</Text>
              <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>{totalMembers}</Text>
            </View>
            <View style={[styles.dividerVertical, { backgroundColor: theme.colors.outline }]} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>CONTRIBUTION</Text>
              <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>Rs {(isWeekly ? item.weeklyContribution : Math.round(item.contributionAmount)).toLocaleString()}</Text>
            </View>
            <View style={[styles.dividerVertical, { backgroundColor: theme.colors.outline }]} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>TOTAL POT</Text>
              <Text style={[styles.infoValue, { color: '#10b981' }]}>Rs {item.totalAmount.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.infoLabel}>DISBURSEMENT PROGRESS</Text>
              <Text style={[styles.progressText, { color: theme.colors.primary }]}>{Math.round(completionPercent * 100)}%</Text>
            </View>
            <View style={[styles.progressBg, { backgroundColor: isDark ? '#222' : '#f0f0f0' }]}>
              <View style={[styles.progressFill, { width: `${completionPercent * 100}%`, backgroundColor: isComplete ? '#10b981' : '#D4AF37' }]} />
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const sections = [];
  if (activeCommittees.length > 0) sections.push({ title: 'ACTIVE COMMITTEES', data: activeCommittees });
  if (completedCommittees.length > 0) sections.push({ title: 'COMPLETED HISTORY', data: completedCommittees });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#064E3B', '#022C22']} style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Icon name="rhombus-split" size={32} color="#D4AF37" style={{ marginRight: 12 }} />
            <View>
              <Text style={styles.arabicHeading}>سجل الجمعيات</Text>
              <Title style={styles.headerTitle}>Committees</Title>
              <Text style={styles.headerSubtitle}>Manage your saving groups</Text>
            </View>
          </View>
          <IconButton 
            icon="plus-circle" 
            iconColor="#D4AF37" 
            size={32} 
            onPress={() => navigation.navigate('CreateCommittee')} 
          />
        </View>
      </LinearGradient>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {committees.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="book-plus-outline" size={80} color={isDark ? '#222' : '#eee'} />
            <Title style={[styles.emptyTitle, { color: theme.colors.onBackground }]}>No Committees</Title>
            <Text style={{ color: '#888', textAlign: 'center' }}>Tap the + button to start your first group.</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={({ item }) => renderItem(item)}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeaderContainer}>
                <Text style={[styles.sectionHeader, { color: title.includes('ACTIVE') ? '#D4AF37' : '#888' }]}>{title}</Text>
                <View style={[styles.headerLine, { backgroundColor: theme.colors.outline }]} />
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 55, paddingBottom: 25, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
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
  arabicHeading: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'serif',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  listContent: { padding: 20, paddingBottom: 100 },
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', letterSpacing: 2, marginRight: 10 },
  headerLine: { flex: 1, height: 1 },
  listItem: { marginBottom: 20, borderRadius: 28, padding: 24 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', fontFamily: 'serif' },
  badgeRow: { flexDirection: 'row', marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  infoGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  infoCol: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 10, color: '#888', fontWeight: 'bold', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  dividerVertical: { width: 1, height: 20 },
  progressSection: { marginTop: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressText: { fontSize: 12, fontWeight: 'bold' },
  progressBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  fab: { position: 'absolute', margin: 20, right: 0, bottom: 20, borderRadius: 28 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 16 },
});
