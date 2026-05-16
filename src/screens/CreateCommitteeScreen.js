import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme, LayoutAnimation } from 'react-native';
import { TextInput, Button, useTheme, Surface, Title, List, Checkbox, Text, SegmentedButtons } from 'react-native-paper';
import { useStore } from '../store/useStore';
import * as Notifications from 'expo-notifications';

export default function CreateCommitteeScreen({ route, navigation }) {
  const editCommitteeId = route.params?.committeeId;
  const committees = useStore((state) => state.committees);
  const existingCommittee = editCommitteeId ? committees.find(c => c.id === editCommitteeId) : null;

  const [name, setName] = useState(existingCommittee ? existingCommittee.name : '');
  const [totalAmount, setTotalAmount] = useState(existingCommittee ? existingCommittee.totalAmount?.toString() : '');
  const [weeklyContribution, setWeeklyContribution] = useState(existingCommittee ? (existingCommittee.weeklyContribution || 0).toString() : '');
  const [payoutsPerCycle, setPayoutsPerCycle] = useState(existingCommittee ? (existingCommittee.payoutsPerCycle || 2).toString() : '2');
  const [frequency, setFrequency] = useState(existingCommittee ? existingCommittee.frequency : 'Monthly');
  const [payoutMethod, setPayoutMethod] = useState(existingCommittee ? existingCommittee.payoutMethod || 'Scheduled' : 'Scheduled');
  const [selectedMembers, setSelectedMembers] = useState(existingCommittee ? existingCommittee.members : []);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [startCycle, setStartCycle] = useState('1');
  const [alreadyPaidMemberIds, setAlreadyPaidMemberIds] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const members = useStore((state) => state.members);
  const addCommittee = useStore((state) => state.addCommittee);
  const updateCommittee = useStore((state) => state.updateCommittee);
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const toggleMember = (id) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter(mId => mId !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  // Auto-calculated values
  const numMembers = selectedMembers.length;
  let calculatedContribution = 0;
  let calculatedPayout = 0;
  let calculatedCycles = 0;

  if (frequency === 'Weekly' && numMembers > 0) {
    const wc = parseFloat(weeklyContribution) || 0;
    const ppc = parseInt(payoutsPerCycle) || 2;
    const monthlyPool = wc * numMembers * 4;
    calculatedPayout = ppc > 0 ? monthlyPool / ppc : 0;
    calculatedCycles = ppc > 0 ? Math.ceil(numMembers / ppc) : 0;
    calculatedContribution = wc;
  } else if (frequency === 'Monthly' && numMembers > 0) {
    const ta = parseFloat(totalAmount) || 0;
    calculatedContribution = ta / numMembers;
    calculatedPayout = ta;
    calculatedCycles = numMembers;
  }

  const handleSave = async () => {
    if (!name) { alert("Please enter a committee name."); return; }
    if (selectedMembers.length < 2) { alert("Please select at least 2 members."); return; }
    
    const startDate = existingCommittee ? existingCommittee.startDate : new Date().toISOString();
    
    const committeeData = {
      name,
      frequency,
      payoutMethod,
      members: selectedMembers,
      startDate,
      totalAmount: frequency === 'Monthly' ? parseFloat(totalAmount) : (parseFloat(weeklyContribution) * numMembers * 4) / (parseInt(payoutsPerCycle) || 2),
      contributionAmount: calculatedContribution,
      weeklyContribution: frequency === 'Weekly' ? parseFloat(weeklyContribution) : 0,
      cycles: calculatedCycles,
      payoutsPerCycle: frequency === 'Weekly' ? (parseInt(payoutsPerCycle) || 2) : 1,
      paymentsPerCycle: frequency === 'Weekly' ? 4 : 1,
    };

    setLoading(true);
    try {
      if (existingCommittee) {
        await updateCommittee(editCommitteeId, committeeData);
      } else {
        const onboardingData = isOnboarding ? {
          startCycle: parseInt(startCycle) || 1,
          alreadyPaidMemberIds
        } : null;
        await addCommittee(committeeData, onboardingData);
      }
      navigation.goBack();
    } catch (e) {
      alert("Error saving committee: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Title style={[styles.headerTitle, { color: theme.colors.primary, fontFamily: 'serif' }]}>Create New Committee</Title>
        <Text style={{ color: isDark ? '#aaa' : '#666' }}>Set up your committee rules and members.</Text>
      </View>

      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>⚙️ Basic Settings</Title>
        </View>
        
        <TextInput
          label="Committee Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          outlineColor={theme.colors.primary}
        />
        
        <Text style={styles.inputLabel}>Contribution Frequency</Text>
        <SegmentedButtons
          value={frequency}
          onValueChange={setFrequency}
          buttons={[
            { value: 'Monthly', label: 'Monthly' },
            { value: 'Weekly', label: 'Weekly' },
          ]}
          style={styles.segmented}
        />

        {frequency === 'Monthly' ? (
          <TextInput
            label="Total Pot Size (Rs)"
            value={totalAmount}
            onChangeText={setTotalAmount}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
            placeholder="e.g. 50000"
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              label="Weekly (Rs)"
              value={weeklyContribution}
              onChangeText={setWeeklyContribution}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              label="Payouts/Mo"
              value={payoutsPerCycle}
              onChangeText={setPayoutsPerCycle}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
        )}

        <Text style={styles.inputLabel}>Payout Distribution</Text>
        <SegmentedButtons
          value={payoutMethod}
          onValueChange={setPayoutMethod}
          buttons={[
            { value: 'Scheduled', label: 'Fixed Order' },
            { value: 'Random', label: 'Random Ballot' },
          ]}
          style={styles.segmented}
        />
      </Surface>

      {numMembers >= 2 && (calculatedContribution > 0 || calculatedPayout > 0) && (
        <Surface style={[styles.summaryCard, { backgroundColor: isDark ? 'rgba(6, 78, 59, 0.1)' : '#F0FDF4' }]} elevation={1}>
          <Title style={[styles.calcTitle, { color: theme.colors.primary, fontFamily: 'serif' }]}>📊 Financial Summary</Title>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{frequency === 'Weekly' ? 'Weekly' : 'Monthly'} Pay</Text>
              <Text style={styles.summaryValue}>Rs {calculatedContribution.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Payout</Text>
              <Text style={styles.summaryValue}>Rs {calculatedPayout.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{calculatedCycles} mo</Text>
            </View>
          </View>
        </Surface>
      )}

      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>
          {payoutMethod === 'Scheduled' ? `🤝 Payout Order (${numMembers})` : `👥 Select Members (${numMembers})`}
        </Title>
        <Text style={styles.subLabel}>
          {payoutMethod === 'Scheduled' 
            ? 'Tap members in the order they will receive payouts.'
            : 'Select members to include in this committee.'}
        </Text>
        
        {members.map((member) => {
          const isSelected = selectedMembers.includes(member.id);
          const pos = selectedMembers.indexOf(member.id) + 1;
          return (
            <Surface key={member.id} style={[styles.memberCard, { backgroundColor: isSelected ? (isDark ? '#064E3B22' : '#F0FDF4') : 'transparent' }]} elevation={0}>
              <List.Item
                title={member.name}
                titleStyle={{ color: theme.colors.onSurface, fontWeight: isSelected ? 'bold' : 'normal' }}
                left={() => (
                  <Checkbox
                    status={isSelected ? 'checked' : 'unchecked'}
                    onPress={() => toggleMember(member.id)}
                  />
                )}
                right={() => isSelected && payoutMethod === 'Scheduled' && (
                  <Surface style={styles.posBadge} elevation={1}>
                    <Text style={styles.posText}>#{pos}</Text>
                  </Surface>
                )}
                onPress={() => toggleMember(member.id)}
              />
            </Surface>
          );
        })}
      </Surface>

      {!existingCommittee && (
        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title style={[styles.sectionTitle, { color: '#B8860B' }]}>🔄 Migration / Onboarding</Title>
            <Checkbox
              status={isOnboarding ? 'checked' : 'unchecked'}
              onPress={() => setIsOnboarding(!isOnboarding)}
            />
          </View>
          <Text style={styles.subLabel}>Import an existing committee that is already in progress.</Text>

          {isOnboarding && (
            <View style={{ marginTop: 12 }}>
              <TextInput
                label="Current Month/Cycle #"
                value={startCycle}
                onChangeText={setStartCycle}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
                placeholder="e.g. 4"
              />
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Already Paid Out?</Text>
              <Text style={styles.subLabel}>Select members who have already taken their payout.</Text>
              
              {selectedMembers.map(mId => {
                const m = members.find(mem => mem.id === mId);
                const isPaid = alreadyPaidMemberIds.includes(mId);
                return (
                  <List.Item
                    key={`paid-${mId}`}
                    title={m?.name}
                    right={() => (
                      <Checkbox
                        status={isPaid ? 'checked' : 'unchecked'}
                        onPress={() => {
                          if (isPaid) setAlreadyPaidMemberIds(alreadyPaidMemberIds.filter(id => id !== mId));
                          else setAlreadyPaidMemberIds([...alreadyPaidMemberIds, mId]);
                        }}
                      />
                    )}
                    onPress={() => {
                      if (isPaid) setAlreadyPaidMemberIds(alreadyPaidMemberIds.filter(id => id !== mId));
                      else setAlreadyPaidMemberIds([...alreadyPaidMemberIds, mId]);
                    }}
                    style={styles.onboardingItem}
                  />
                );
              })}
            </View>
          )}
        </Surface>
      )}

      <Button 
        mode="contained" 
        onPress={handleSave} 
        loading={loading}
        disabled={loading}
        style={styles.saveButton}
        contentStyle={{ paddingVertical: 12 }}
        labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
      >
        {existingCommittee ? 'Update Committee' : 'Confirm & Create Committee'}
      </Button>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingBottom: 16 },
  headerTitle: { fontSize: 26, marginBottom: 4 },
  sectionCard: { margin: 16, marginTop: 0, padding: 20, borderRadius: 24 },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  input: { marginBottom: 16, backgroundColor: 'transparent' },
  inputLabel: { fontSize: 13, color: '#888', marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  subLabel: { fontSize: 13, color: '#888', marginBottom: 12 },
  segmented: { marginBottom: 20 },
  summaryCard: { margin: 16, marginTop: 0, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#4caf50' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#064E3B' },
  memberCard: { borderRadius: 12, marginBottom: 4 },
  posBadge: { backgroundColor: '#D4AF37', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  posText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  onboardingItem: { paddingVertical: 0 },
  saveButton: { margin: 16, borderRadius: 16, elevation: 4 },
  calcTitle: { fontSize: 16, marginBottom: 8 },
});
