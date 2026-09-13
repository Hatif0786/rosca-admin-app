import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, useColorScheme, Linking, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import { TextInput, Button, IconButton, useTheme, Surface, Title, Text, Avatar, Searchbar, Snackbar, Portal, Dialog, Paragraph } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { sendWelcomeWhatsApp } from '../lib/whatsapp';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MembersScreen() {
  const members = useStore((state) => state.members);
  const committees = useStore((state) => state.committees);
  const addMember = useStore((state) => state.addMember);
  const deleteMember = useStore((state) => state.deleteMember);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [selectedMemberForDetails, setSelectedMemberForDetails] = useState(null);
  const theme = useTheme();
  const isDark = theme.dark;

  const showSnack = (msg) => {
    setSnackMsg(msg);
    setSnackVisible(true);
  };

  const handleAdd = async () => {
    if (name && phone) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await addMember(name, phone);
      // Send WhatsApp welcome notification via Evolution API
      sendWelcomeWhatsApp(name, phone).catch(err => console.warn('WhatsApp welcome fail:', err));
      setName('');
      setPhone('');
      setShowAdd(false);
    }
  };

  const copyToClipboard = async (text) => {
    await Clipboard.setStringAsync(text);
    showSnack('📋 Number copied to clipboard!');
  };

  const handleDeleteMember = (member) => {
    // Get all active committees
    const activeCommittees = (committees || []).filter(
      c => (c.payouts?.length || 0) < (c.members?.length || 0)
    );
    
    // Find active committees this member belongs to
    const memberActiveCommittees = activeCommittees.filter(c => c.members.includes(member.id));
    
    if (memberActiveCommittees.length > 0) {
      const committeeNames = memberActiveCommittees.map(c => `"${c.name}"`).join(', ');
      Alert.alert(
        "Cannot Delete Member",
        `This member is currently active in the following savings group(s):\n\n${committeeNames}\n\nTo delete this member, please complete or remove these committees first.`,
        [{ text: "OK" }]
      );
      return;
    }
    
    // Confirm deletion
    Alert.alert(
      "Delete Member",
      `Are you sure you want to delete "${member.name}"? This will permanently remove them from the database.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteMember(member.id);
              showSnack("✅ Member deleted successfully");
            } catch (e) {
              Alert.alert("Error", "Failed to delete member: " + e.message);
            }
          } 
        }
      ]
    );
  };

  // Logic to count committees per member
  const getCommitteeCount = (memberId) => {
    return committees.filter(c => c.members.includes(memberId)).length;
  };

  const filteredMembers = members
    .filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderMember = ({ item }) => {
    const committeeCount = getCommitteeCount(item.id);
    return (
      <Surface style={[styles.memberCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <TouchableOpacity 
          style={styles.cardMain} 
          activeOpacity={0.7}
          onPress={() => setSelectedMemberForDetails(item)}
          onLongPress={() => copyToClipboard(item.phone)}
        >
          <Avatar.Text 
            size={50} 
            label={item.name.substring(0, 1).toUpperCase()} 
            style={{ backgroundColor: committeeCount > 0 ? '#064E3B' : '#333' }} 
            color="#D4AF37" 
          />
          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.memberName, { color: theme.colors.onSurface }]}>{item.name}</Text>
              {committeeCount > 0 && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeText}>{committeeCount} ACTIVE</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone.replace(/\D/g, '')}`)}>
              <Text style={[styles.memberPhone, { color: theme.colors.primary }]}>{item.phone}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actions}>
            <IconButton 
              icon="whatsapp" 
              iconColor="#10b981" 
              size={22} 
              onPress={() => Linking.openURL(`whatsapp://send?phone=${item.phone.replace(/\D/g, '')}`)} 
            />
            <IconButton 
              icon="trash-can-outline" 
              iconColor="#f43f5e" 
              size={20} 
              onPress={() => handleDeleteMember(item)} 
            />
          </View>
        </TouchableOpacity>
      </Surface>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#064E3B', '#022C22']} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Icon name="rhombus-split" size={32} color="#D4AF37" style={{ marginRight: 12 }} />
            <View>
              <Text style={styles.arabicHeading}>سجل الأعضاء</Text>
              <Title style={styles.headerTitle}>Member Directory</Title>
              <Text style={styles.headerSubtitle}>Manage registered participants</Text>
            </View>
          </View>
          <IconButton 
            icon={showAdd ? "close-circle" : "account-plus"} 
            iconColor="#D4AF37" 
            size={32} 
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowAdd(!showAdd);
            }} 
          />
        </View>

        {showAdd && (
          <Surface style={styles.addForm} elevation={0}>
            <TextInput
              label="Full Name"
              value={name}
              onChangeText={setName}
              mode="flat"
              style={styles.input}
              textColor="#fff"
              activeUnderlineColor="#D4AF37"
              underlineColor="rgba(255,255,255,0.3)"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
            <TextInput
              label="WhatsApp Phone"
              value={phone}
              onChangeText={setPhone}
              mode="flat"
              keyboardType="phone-pad"
              style={styles.input}
              textColor="#fff"
              activeUnderlineColor="#D4AF37"
              underlineColor="rgba(255,255,255,0.3)"
            />
            <Button 
              mode="contained" 
              onPress={handleAdd} 
              buttonColor="#D4AF37" 
              textColor="#064E3B"
              style={styles.addBtn}
              labelStyle={{ fontWeight: 'bold' }}
            >
              Add Member to Sijill
            </Button>
          </Surface>
        )}
      </LinearGradient>

      <View style={styles.contentOverlay}>
        <Surface style={[styles.statsBar, { backgroundColor: theme.colors.surface }]} elevation={4}>
          <View style={styles.statItem}>
            <Icon name="account-group" size={20} color="#D4AF37" />
            <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{members.length}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="check-decagram" size={20} color="#10b981" />
            <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{members.filter(m => getCommitteeCount(m.id) > 0).length}</Text>
            <Text style={styles.statLabel}>ACTIVE</Text>
          </View>
        </Surface>

        <Searchbar
          placeholder="Search Sijill..."
          onChangeText={setSearch}
          value={search}
          style={[styles.searchBar, { backgroundColor: theme.colors.surface }]}
          iconColor="#D4AF37"
          inputStyle={{ fontSize: 14 }}
        />
      </View>

      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="account-search-outline" size={60} color="#D4AF3722" />
            <Text style={{ color: '#888', marginTop: 10 }}>Empty Sijill</Text>
          </View>
        }
      />
      <Snackbar 
        visible={snackVisible} 
        onDismiss={() => setSnackVisible(false)} 
        style={{ backgroundColor: isDark ? '#D4AF37' : '#333' }}
      >
        <Text style={{ color: isDark ? '#064E3B' : '#fff', fontWeight: 'bold' }}>{snackMsg}</Text>
      </Snackbar>

      <Portal>
        <Dialog 
          visible={selectedMemberForDetails !== null} 
          onDismiss={() => setSelectedMemberForDetails(null)} 
          style={{ backgroundColor: theme.colors.surface, borderRadius: 28 }}
        >
          <Dialog.Title style={{ color: theme.colors.primary, fontFamily: 'serif', fontSize: 20, fontWeight: 'bold' }}>Member Association</Dialog.Title>
          <Dialog.Content>
            <Title style={{ color: theme.colors.onSurface, fontSize: 18, fontWeight: 'bold' }}>{selectedMemberForDetails?.name}</Title>
            <Text style={{ color: '#888', marginBottom: 18, fontSize: 14 }}>{selectedMemberForDetails?.phone}</Text>
            
            <Text style={{ fontWeight: 'bold', color: theme.colors.primary, marginBottom: 10, fontSize: 12, letterSpacing: 1.5 }}>ACTIVE ENROLLMENTS</Text>
            {selectedMemberForDetails && (() => {
              const activeComms = committees.filter(c => 
                c.members.includes(selectedMemberForDetails.id) && 
                (c.payouts?.length || 0) < (c.members?.length || 0)
              );
              if (activeComms.length === 0) {
                return <Text style={{ color: '#888', fontStyle: 'italic', marginTop: 5 }}>Not enrolled in any active committees.</Text>;
              }
              return activeComms.map((c, idx) => (
                <View key={c.id || idx} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                  <Icon name="checkbox-marked-circle-outline" size={18} color="#10b981" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.onSurface, fontWeight: 'bold', fontSize: 14 }}>{c.name}</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>Pot: Rs {c.totalAmount.toLocaleString()} • Cycle {(c.payouts?.length || 0) + 1}</Text>
                  </View>
                </View>
              ));
            })()}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelectedMemberForDetails(null)} textColor={theme.colors.primary}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 55, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  addForm: { backgroundColor: 'transparent', marginTop: 20, marginBottom: 25 },
  input: { backgroundColor: 'transparent', marginBottom: 12, height: 50 },
  addBtn: { marginTop: 10, borderRadius: 12, paddingVertical: 4 },
  contentOverlay: { paddingHorizontal: 20, marginTop: -20 },
  statsBar: { flexDirection: 'row', padding: 16, borderRadius: 24, marginBottom: 16, justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  statLabel: { fontSize: 9, color: '#888', fontWeight: 'bold', letterSpacing: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(0,0,0,0.05)' },
  searchBar: { borderRadius: 16, height: 50, elevation: 4 },
  listContent: { padding: 20, paddingTop: 10, paddingBottom: 100 },
  memberCard: { borderRadius: 24, marginBottom: 12, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  memberInfo: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { fontSize: 16, fontWeight: 'bold', fontFamily: 'serif' },
  memberPhone: { fontSize: 13, color: '#888', marginTop: 4, textDecorationLine: 'underline' },
  activeBadge: { backgroundColor: '#064E3B11', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  activeText: { fontSize: 8, color: '#064E3B', fontWeight: 'bold' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
});
