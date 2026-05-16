import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, useColorScheme, Alert, SectionList } from 'react-native';
import { FAB, useTheme, Text, Surface, IconButton } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';

export default function CommitteesScreen({ navigation }) {
  const committees = useStore((state) => state.committees);
  const deleteCommittee = useStore((state) => state.deleteCommittee);
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Separate active vs completed with safety checks
  const activeCommittees = (committees || []).filter(c => {
    return (c.payouts?.length || 0) < (c.members?.length || 0);
  });

  const completedCommittees = (committees || []).filter(c => {
    return (c.payouts?.length || 0) >= (c.members?.length || 0);
  });

  const handleDelete = (committee) => {
    Alert.alert(
      'Delete Committee',
      `Are you sure you want to delete "${committee.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCommittee(committee.id) },
      ]
    );
  };

  const renderItem = (item) => {
    if (!item) return null;
    const isWeekly = item.frequency === 'Weekly';
    const totalMembers = item.members?.length || 0;
    const payoutsCount = item.payouts?.length || 0;
    const completionPercent = totalMembers > 0 ? Math.round((payoutsCount / totalMembers) * 100) : 0;
    const isComplete = payoutsCount >= totalMembers;

    return (
      <TouchableOpacity onPress={() => navigation.navigate('CommitteeDetail', { committeeId: item.id })} activeOpacity={0.8}>
        <Surface style={[styles.listItem, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>{item.name}</Text>
            </View>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, { backgroundColor: isDark ? '#333' : '#F0E6FF', color: theme.colors.primary }]}>{item.frequency}</Text>
              {isComplete && <Text style={[styles.badge, { backgroundColor: '#E8F5E9', color: '#4caf50', marginLeft: 6 }]}>✓ Done</Text>}
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={{ color: isDark ? '#aaa' : '#888', fontSize: 11 }}>Members</Text>
              <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>{item.members.length}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={{ color: isDark ? '#aaa' : '#888', fontSize: 11 }}>{isWeekly ? 'Weekly' : 'Monthly'}</Text>
              <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>Rs {(isWeekly ? item.weeklyContribution : Math.round(item.contributionAmount)).toLocaleString()}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={{ color: isDark ? '#aaa' : '#888', fontSize: 11 }}>Payout</Text>
              <Text style={[styles.infoValue, { color: '#4caf50' }]}>Rs {item.totalAmount.toLocaleString()}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            <View style={[styles.progressBg, { backgroundColor: isDark ? '#333' : '#e0e0e0' }]}>
              <View style={[styles.progressFill, { width: `${completionPercent}%`, backgroundColor: isComplete ? '#4caf50' : theme.colors.primary }]} />
            </View>
            <Text style={{ color: isDark ? '#aaa' : '#888', fontSize: 11, marginLeft: 8 }}>{completionPercent}%</Text>
          </View>

          <View style={styles.cardFooter}>
            <Text style={{ color: isDark ? '#aaa' : '#888', fontSize: 12 }}>
              {item.schedule?.[0]?.label} → {item.schedule?.[item.schedule.length - 1]?.label}
            </Text>
            <IconButton icon="delete-outline" iconColor="#f44336" size={20} style={{ margin: 0 }}
              onPress={() => handleDelete(item)} />
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const sections = [];
  if (activeCommittees.length > 0) sections.push({ title: 'Active', data: activeCommittees });
  if (completedCommittees.length > 0) sections.push({ title: 'Completed', data: completedCommittees });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {committees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.onBackground }]}>No Committees Yet</Text>
          <Text style={{ color: isDark ? '#aaa' : '#888', textAlign: 'center' }}>Press the + button below to create your first committee.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => renderItem(item)}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={[styles.sectionHeader, { color: theme.colors.onBackground }]}>
              {title === 'Completed' ? '✅ ' : '🔵 '}{title} ({title === 'Active' ? activeCommittees.length : completedCommittees.length})
            </Text>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
      <FAB icon="plus" style={[styles.fab, { backgroundColor: theme.colors.primary }]} color="white"
        onPress={() => navigation.navigate('CreateCommittee')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 80 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  listItem: { marginBottom: 12, borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontSize: 11, overflow: 'hidden', fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoItem: { alignItems: 'center' },
  infoValue: { fontWeight: 'bold', fontSize: 14, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
