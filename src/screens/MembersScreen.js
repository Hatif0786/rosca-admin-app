import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, useColorScheme, Animated, TouchableOpacity, Alert, Linking } from 'react-native';
import { List, FAB, useTheme, Text, Surface, Avatar, IconButton, Title, Paragraph } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';

export default function MembersScreen({ navigation }) {
  const members = useStore((state) => state.members);
  const committees = useStore((state) => state.committees);
  const deleteMember = useStore((state) => state.deleteMember);
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const getMemberStats = (memberId) => {
    let committeeCount = 0;
    let totalPaid = 0;
    let totalReceived = 0;
    committees.forEach(c => {
      if (c.members?.includes(memberId)) {
        committeeCount++;
        totalPaid += (c.contributions || []).filter(cont => cont.memberId === memberId && cont.status === 'paid').length;
        (c.payouts || []).forEach(p => {
          if (p.memberId === memberId) totalReceived += p.amount;
        });
      }
    });
    return { committeeCount, totalPaid, totalReceived };
  };

  const handleDelete = (member) => {
    const inCommittees = committees.filter(c => c.members?.includes(member.id));
    if (inCommittees.length > 0) {
      Alert.alert('Cannot Delete', `${member.name} is active in ${inCommittees.length} committee(s).`);
      return;
    }
    Alert.alert('Delete Member', `Remove "${member.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMember(member.id) },
    ]);
  };

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const renderItem = ({ item, index }) => {
    const stats = getMemberStats(item.id);
    
    return (
      <Surface style={[styles.listItem, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.memberRow}>
          <Surface style={[styles.avatarContainer, { backgroundColor: isDark ? '#064E3B22' : '#F0FDF4' }]} elevation={0}>
             <Avatar.Text 
                size={48} 
                label={item.name.substring(0, 1).toUpperCase()} 
                style={{ backgroundColor: '#D4AF37' }} 
                color="#fff" 
                labelStyle={{ fontFamily: 'serif', fontWeight: 'bold' }}
              />
          </Surface>
          
          <View style={styles.memberInfo}>
            <Title style={[styles.memberName, { color: theme.colors.onSurface }]}>{item.name}</Title>
            <TouchableOpacity onPress={() => handleCall(item.phone)} style={styles.phoneRow}>
              <IconButton icon="phone-outline" iconColor={theme.colors.primary} size={14} style={{ margin: 0, padding: 0 }} />
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '500' }}>
                {item.phone || 'No phone added'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <IconButton 
            icon="delete-outline" 
            iconColor={isDark ? '#666' : '#ccc'} 
            size={22} 
            onPress={() => handleDelete(item)} 
          />
        </View>
        
        <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#eee' }]} />
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{stats.committeeCount}</Text>
            <Text style={styles.statLabel}>Active Groups</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#059669' }]}>{stats.totalPaid}</Text>
            <Text style={styles.statLabel}>Total Saved</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#D4AF37' }]}>
              {stats.totalReceived > 0 ? `Rs ${(stats.totalReceived / 1000).toFixed(1)}k` : '—'}
            </Text>
            <Text style={styles.statLabel}>Disbursed</Text>
          </View>
        </View>
      </Surface>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <LinearGradient
          colors={['#064E3B', '#022C22']}
          start={{x:0, y:0}} end={{x:1, y:1}}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Title style={styles.headerTitle}>Member Directory</Title>
              <Paragraph style={{ color: 'rgba(255,255,255,0.7)' }}>Manage your committee network</Paragraph>
            </View>
            <Surface style={styles.countBadge} elevation={4}>
              <Text style={styles.countText}>{members.length}</Text>
            </Surface>
          </View>
        </LinearGradient>

        <FlatList
          data={members}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconButton icon="account-group-outline" size={80} iconColor={isDark ? '#333' : '#eee'} />
              <Title style={[styles.emptyTitle, { color: theme.colors.onBackground }]}>No Members Yet</Title>
              <Text style={{ color: '#888', textAlign: 'center' }}>Grow your community by adding members.</Text>
            </View>
          }
        />
      </Animated.View>
      
      <FAB 
        icon="plus" 
        label="Add New Member"
        style={[styles.fab, { backgroundColor: '#D4AF37' }]} 
        color="white"
        onPress={() => navigation.navigate('AddMember')} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 30, paddingTop: 50, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#D4AF37', fontSize: 28, fontWeight: 'bold', fontFamily: 'serif' },
  countBadge: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#D4AF37', justifyContent: 'center', alignItems: 'center' },
  countText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  listContent: { padding: 16, paddingBottom: 100, paddingTop: 24 },
  listItem: { marginBottom: 16, borderRadius: 24, padding: 20, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { padding: 4, borderRadius: 16, marginRight: 16 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginLeft: -8 },
  divider: { height: 1, marginVertical: 16, opacity: 0.5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', marginTop: 4, letterSpacing: 0.5 },
  fab: { position: 'absolute', margin: 20, right: 0, bottom: 20, borderRadius: 28 },
  emptyContainer: { alignItems: 'center', padding: 60, marginTop: 40 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 16 },
});
