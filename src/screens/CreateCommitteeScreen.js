import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme, LayoutAnimation } from 'react-native';
import { TextInput, Button, useTheme, Surface, Title, List, Checkbox, Text, SegmentedButtons, IconButton } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [selectedMembers, setSelectedMembers] = useState(() => {
    if (existingCommittee && existingCommittee.members) {
      const map = {};
      existingCommittee.members.forEach(id => {
        if (map[id]) map[id] += 1;
        else map[id] = 1;
      });
      return Object.entries(map).map(([id, count]) => ({ id, count }));
    }
    return [];
  });
  const [payoutOrder, setPayoutOrder] = useState(() => {
    if (existingCommittee && existingCommittee.members) {
      return [...existingCommittee.members];
    }
    return [];
  });
  const [selectedSwapIndex, setSelectedSwapIndex] = useState(null);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [startCycle, setStartCycle] = useState('1');
  const [alreadyPaidSlotIndexes, setAlreadyPaidSlotIndexes] = useState([]);
  const [loading, setLoading] = useState(false);

  const members = useStore((state) => state.members);
  const addCommittee = useStore((state) => state.addCommittee);
  const updateCommittee = useStore((state) => state.updateCommittee);
  const theme = useTheme();
  const isDark = theme.dark;
  const localPaperTheme = {
    ...theme,
    colors: {
      ...theme.colors,
      primary: '#064E3B',
      primaryContainer: isDark ? 'rgba(6, 78, 59, 0.25)' : 'rgba(6, 78, 59, 0.08)',
      onPrimaryContainer: isDark ? '#A7F3D0' : '#064E3B',
      secondaryContainer: isDark ? 'rgba(6, 78, 59, 0.25)' : 'rgba(6, 78, 59, 0.08)',
      onSecondaryContainer: isDark ? '#A7F3D0' : '#064E3B',
      outline: '#064E3B',
    }
  };

  // Monthly committees always disburse exactly one pot per cycle; the payoutsPerCycle
  // input only applies to Weekly. Using the raw field for Monthly made the onboarding
  // "already paid out" list show twice as many historical slots as it should.
  const effectivePayoutsPerCycle = frequency === 'Weekly' ? (parseInt(payoutsPerCycle) || 2) : 1;

  // Auto-sync onboarding slots when cycle, frequency or order changes
  React.useEffect(() => {
    if (isOnboarding) {
      const cycleVal = parseInt(startCycle) || 1;
      const count = Math.min((cycleVal - 1) * effectivePayoutsPerCycle, payoutOrder.length);
      const indices = [];
      for (let i = 0; i < count; i++) {
        indices.push(i);
      }
      setAlreadyPaidSlotIndexes(indices);
    } else {
      setAlreadyPaidSlotIndexes([]);
    }
  }, [payoutOrder, startCycle, effectivePayoutsPerCycle, isOnboarding]);

  const toggleMember = (id) => {
    const existing = selectedMembers.find(m => m.id === id);
    if (existing) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== id));
      setPayoutOrder(payoutOrder.filter(memberId => memberId !== id));
    } else {
      setSelectedMembers([...selectedMembers, { id, count: 1 }]);
      setPayoutOrder([...payoutOrder, id]);
    }
  };

  const incrementMember = (id) => {
    setSelectedMembers(selectedMembers.map(m => m.id === id ? { ...m, count: m.count + 1 } : m));
    setPayoutOrder([...payoutOrder, id]);
  };

  const decrementMember = (id) => {
    const existing = selectedMembers.find(m => m.id === id);
    if (!existing) return;
    if (existing.count > 1) {
      setSelectedMembers(selectedMembers.map(m => m.id === id ? { ...m, count: m.count - 1 } : m));
      const idx = payoutOrder.lastIndexOf(id);
      if (idx > -1) {
        const newOrder = [...payoutOrder];
        newOrder.splice(idx, 1);
        setPayoutOrder(newOrder);
      }
    } else {
      setSelectedMembers(selectedMembers.filter(m => m.id !== id));
      setPayoutOrder(payoutOrder.filter(memberId => memberId !== id));
    }
  };

  // Auto‑calculated values
  const numMembers = selectedMembers.reduce((sum, m) => sum + m.count, 0);
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
    
    const generatePayoutOrder = (selected) => {
      const counts = selected.map(m => ({ id: m.id, remaining: m.count }));
      const order = [];
      while (counts.some(c => c.remaining > 0)) {
        for (const c of counts) {
          if (c.remaining > 0) {
            order.push(c.id);
            c.remaining--;
          }
        }
      }
      return order;
    };

    const finalOrder = payoutMethod === 'Scheduled' ? payoutOrder : generatePayoutOrder(selectedMembers);

    const committeeData = {
      name,
      frequency,
      payoutMethod,
      members: finalOrder,
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
          alreadyPaidMemberIds: alreadyPaidSlotIndexes.map(idx => finalOrder[idx])
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#064E3B', '#022C22']}
        style={styles.header}
        start={{x:0, y:0}} end={{x:1, y:1}}
      >
        {/* <IconButton icon="arrow-left" iconColor="#D4AF37" onPress={() => navigation.goBack()} style={{ marginLeft: -12, marginBottom: 8 }} /> */}
        <Text style={styles.arabicHeading}>{editCommitteeId ? 'تعديل الجمعية' : 'إنشاء مجموعة جديدة'}</Text>
        <Title style={styles.headerTitle}>{editCommitteeId ? 'Edit Committee' : 'Create Committee'}</Title>
        <Text style={styles.headerSubtitle}>Set up your committee rules and members</Text>
      </LinearGradient>
      
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ height: 20 }} />

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
          outlineColor="#064E3B"
          activeOutlineColor="#064E3B"
          theme={localPaperTheme}
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
          theme={localPaperTheme}
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
            outlineColor="#064E3B"
            activeOutlineColor="#064E3B"
            theme={localPaperTheme}
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
              outlineColor="#064E3B"
              activeOutlineColor="#064E3B"
              theme={localPaperTheme}
            />
            <TextInput
              label="Payouts/Mo"
              value={payoutsPerCycle}
              onChangeText={setPayoutsPerCycle}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
              outlineColor="#064E3B"
              activeOutlineColor="#064E3B"
              theme={localPaperTheme}
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
          theme={localPaperTheme}
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
          👥 Select Members & Contributions ({numMembers})
        </Title>
        <Text style={styles.subLabel}>
          Select members and set the number of shares (contributions) they have in this committee.
        </Text>
        
        {members.map((member) => {
          const entry = selectedMembers.find(m => m.id === member.id);
          const isSelected = !!entry;
          const count = entry ? entry.count : 0;
          return (
            <Surface key={member.id} style={[styles.memberCard, { backgroundColor: isSelected ? (isDark ? '#064E3B22' : '#F0FDF4') : 'transparent' }]} elevation={0}>
              <List.Item
                title={member.name}
                titleStyle={{ color: theme.colors.onSurface, fontWeight: isSelected ? 'bold' : 'normal', fontFamily: 'serif' }}
                left={() => (
                  <View style={{ justifyContent: 'center', alignSelf: 'center', marginLeft: 2, marginRight: -7 }}>
                    <Checkbox
                      status={isSelected ? 'checked' : 'unchecked'}
                      onPress={() => toggleMember(member.id)}
                      color="#064E3B"
                      theme={localPaperTheme}
                    />
                  </View>
                )}
                right={() => (
                  <View style={styles.memberControls}>
                    {isSelected && count > 1 && (
                      <Surface style={[styles.posBadge, { backgroundColor: theme.colors.primaryContainer, marginLeft: 8, marginRight: 4 }]} elevation={1}>
                        <Text style={[styles.posText, { color: theme.colors.onPrimaryContainer }]}>{count}×</Text>
                      </Surface>
                    )}
                    {isSelected && (
                      <View style={styles.controlGroup}>
                        <IconButton
                          icon="minus"
                          size={18}
                          onPress={() => decrementMember(member.id)}
                        />
                        <Text style={{ marginHorizontal: 6, fontWeight: 'bold' }}>{count}</Text>
                        <IconButton
                          icon="plus"
                          size={18}
                          onPress={() => incrementMember(member.id)}
                        />
                      </View>
                    )}
                  </View>
                )}
                onPress={() => toggleMember(member.id)}
              />
            </Surface>
          );
        })}
      </Surface>

      {payoutMethod === 'Scheduled' && payoutOrder.length > 0 && (
        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            🤝 Payout Order Sequence ({payoutOrder.length})
          </Title>
          <Text style={styles.subLabel}>
            Tap a slot to select it, then tap another slot to swap their payout order, or use the up/down arrows.
          </Text>

          {payoutOrder.map((memberId, index) => {
            const member = members.find(m => m.id === memberId);
            if (!member) return null;
            
            const isSwapSelected = selectedSwapIndex === index;

            // Compute contribution label (e.g. Share 1 of 2)
            const count = selectedMembers.find(m => m.id === memberId)?.count || 1;
            let shareLabel = '';
            if (count > 1) {
              let occurrence = 0;
              for (let k = 0; k <= index; k++) {
                if (payoutOrder[k] === memberId) occurrence++;
              }
              shareLabel = ` (Share ${occurrence}/${count})`;
            }

            return (
              <Surface
                key={`slot-${index}-${memberId}`}
                style={[
                  styles.slotCard,
                  {
                    borderColor: isSwapSelected ? theme.colors.primary : theme.colors.outlineVariant,
                    borderWidth: 1,
                    backgroundColor: isSwapSelected 
                      ? theme.colors.primaryContainer 
                      : theme.colors.elevation.level1,
                  }
                ]}
                elevation={isSwapSelected ? 2 : 1}
              >
                <List.Item
                  title={member.name}
                  titleStyle={{ 
                    fontSize: 15, 
                    fontWeight: 'bold',
                    color: isSwapSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurface 
                  }}
                  description={`Payout Cycle ${index + 1}${shareLabel}`}
                  descriptionStyle={{
                    fontSize: 12,
                    color: isSwapSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
                    opacity: 0.8
                  }}
                  left={() => (
                    <View style={[
                      styles.slotBadge, 
                      { 
                        backgroundColor: isSwapSelected ? theme.colors.primary : theme.colors.secondaryContainer 
                      }
                    ]}>
                      <Text style={[
                        styles.slotBadgeText, 
                        { 
                          color: isSwapSelected ? '#FFF' : theme.colors.onSecondaryContainer 
                        }
                      ]}>
                        {index + 1}
                      </Text>
                    </View>
                  )}
                  right={() => (
                    <View style={styles.slotControls}>
                      <IconButton
                        icon="chevron-up"
                        size={20}
                        iconColor={isSwapSelected ? theme.colors.onPrimaryContainer : theme.colors.primary}
                        disabled={index === 0}
                        onPress={() => {
                          const newOrder = [...payoutOrder];
                          const temp = newOrder[index];
                          newOrder[index] = newOrder[index - 1];
                          newOrder[index - 1] = temp;
                          setPayoutOrder(newOrder);
                        }}
                      />
                      <IconButton
                        icon="chevron-down"
                        size={20}
                        iconColor={isSwapSelected ? theme.colors.onPrimaryContainer : theme.colors.primary}
                        disabled={index === payoutOrder.length - 1}
                        onPress={() => {
                          const newOrder = [...payoutOrder];
                          const temp = newOrder[index];
                          newOrder[index] = newOrder[index + 1];
                          newOrder[index + 1] = temp;
                          setPayoutOrder(newOrder);
                        }}
                      />
                    </View>
                  )}
                  onPress={() => {
                    if (selectedSwapIndex === null) {
                      setSelectedSwapIndex(index);
                    } else if (selectedSwapIndex === index) {
                      setSelectedSwapIndex(null);
                    } else {
                      const newOrder = [...payoutOrder];
                      const temp = newOrder[selectedSwapIndex];
                      newOrder[selectedSwapIndex] = newOrder[index];
                      newOrder[index] = temp;
                      setPayoutOrder(newOrder);
                      setSelectedSwapIndex(null);
                    }
                  }}
                />
              </Surface>
            );
          })}
        </Surface>
      )}

      {!existingCommittee && (
        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title style={[styles.sectionTitle, { color: '#B8860B' }]}>🔄 Migration / Onboarding</Title>
            <Checkbox
              status={isOnboarding ? 'checked' : 'unchecked'}
              onPress={() => {
                const next = !isOnboarding;
                setIsOnboarding(next);
                if (next) setStartCycle('2'); // Smart default for existing committees
              }}
              color="#064E3B"
              theme={localPaperTheme}
            />
          </View>
          <Text style={styles.subLabel}>Import an existing committee that is already in progress. (Default starts at Month 2)</Text>

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
                outlineColor="#064E3B"
                activeOutlineColor="#064E3B"
                theme={localPaperTheme}
              />
              
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Already Paid Out?</Text>
              <Text style={styles.subLabel}>Select slots/shares that have already been paid out in historical cycles.</Text>
              
              {(() => {
                const cycleVal = parseInt(startCycle) || 1;
                const numPastPayouts = (cycleVal - 1) * effectivePayoutsPerCycle;

                if (numPastPayouts <= 0) {
                  return <Text style={{ fontStyle: 'italic', color: '#888', marginVertical: 8 }}>Starting at Cycle 1; no past payouts to record.</Text>;
                }

                return payoutOrder.slice(0, numPastPayouts).map((memberId, idx) => {
                  const m = members.find(mem => mem.id === memberId);
                  const isPaid = alreadyPaidSlotIndexes.includes(idx);
                  
                  // Get share label if member has multiple contributions
                  const count = selectedMembers.find(sm => sm.id === memberId)?.count || 1;
                  let shareLabel = '';
                  if (count > 1) {
                    let occurrence = 0;
                    for (let k = 0; k <= idx; k++) {
                      if (payoutOrder[k] === memberId) occurrence++;
                    }
                    shareLabel = ` (Share ${occurrence}/${count})`;
                  }

                  return (
                    <List.Item
                      key={`paid-slot-${idx}`}
                      title={m?.name || 'Unknown'}
                      titleStyle={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
                      description={`Payout Cycle ${idx + 1}${shareLabel}`}
                      descriptionStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                      left={() => (
                        <View style={{ justifyContent: 'center', alignSelf: 'center', marginLeft: -4, marginRight: 4 }}>
                          <Checkbox
                            status={isPaid ? 'checked' : 'unchecked'}
                            onPress={() => {
                              if (isPaid) setAlreadyPaidSlotIndexes(alreadyPaidSlotIndexes.filter(i => i !== idx));
                              else setAlreadyPaidSlotIndexes([...alreadyPaidSlotIndexes, idx].sort((a,b)=>a-b));
                            }}
                            color="#064E3B"
                            theme={localPaperTheme}
                          />
                        </View>
                      )}
                      onPress={() => {
                        if (isPaid) setAlreadyPaidSlotIndexes(alreadyPaidSlotIndexes.filter(i => i !== idx));
                        else setAlreadyPaidSlotIndexes([...alreadyPaidSlotIndexes, idx].sort((a,b)=>a-b));
                      }}
                      style={styles.onboardingItem}
                    />
                  );
                });
              })()}
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
        theme={localPaperTheme}
      >
        {existingCommittee ? 'Update Committee' : 'Confirm & Create Committee'}
      </Button>
      <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 35, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
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
  memberCard: {
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  memberControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 20,
    paddingHorizontal: 1,
  },
  posBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  posText: { fontSize: 11, fontWeight: 'bold' },
  slotCard: {
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    paddingLeft: 16,
    overflow: 'hidden',
  },
  slotBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'center',
  },
  slotBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  slotControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onboardingItem: { paddingVertical: 0 },
  saveButton: { margin: 16, borderRadius: 16, elevation: 4, backgroundColor: '#064E3B' },
  calcTitle: { fontSize: 16, marginBottom: 8 },
});
