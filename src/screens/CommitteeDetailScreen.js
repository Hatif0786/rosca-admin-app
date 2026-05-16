import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Share, LayoutAnimation, UIManager, Platform, useColorScheme, Alert, Animated, Linking } from 'react-native';
import { Title, Paragraph, List, Button, Text, Surface, useTheme, Avatar, ProgressBar, IconButton, Snackbar } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import { format, addDays } from 'date-fns';

export default function CommitteeDetailScreen({ route, navigation }) {
  const { committeeId } = route.params;
  const { committees, members, markContributionPaid, recordPayout } = useStore();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const committee = committees.find(c => c.id === committeeId);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Smart Jump: Start at the first active cycle & week
  useEffect(() => {
    if (committee) {
      const payouts = committee.payouts || [];
      const contributions = committee.contributions || [];
      const payoutsPerCycle = (committee.frequency === 'Weekly') ? (committee.payoutsPerCycle || 2) : 1;
      const lastPayoutIdx = payouts.length;
      
      // Calculate active month (cycle)
      const activeCycle = Math.min(committee.cycles, Math.floor(lastPayoutIdx / payoutsPerCycle) + 1);
      setCurrentCycle(activeCycle);

      // If weekly, find first pending week in that month
      if (committee.frequency === 'Weekly') {
        let firstPendingWeek = 1;
        for (let w = 1; w <= 4; w++) {
          const weekPaidCount = contributions.filter(c => c.cycleNumber === activeCycle && c.paymentNumber === w && c.status === 'paid').length;
          if (weekPaidCount < committee.members.length) {
            firstPendingWeek = w;
            break;
          }
        }
        setCurrentWeek(firstPendingWeek);
      }

      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [committeeId]);

  if (!committee) return <Text style={{color: theme.colors.onBackground, padding: 20}}>Committee not found</Text>;

  const showSnack = (msg) => { setSnackMsg(msg); setSnackVisible(true); };
  
  const sendViaWhatsApp = (msg, phone = null) => {
    let url = '';
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    } else {
      url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    }
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
        setSnackMsg("📲 Opening WhatsApp Chat...");
        setSnackVisible(true);
      } else {
        alert("WhatsApp is not installed on this device");
      }
    });
  };

  const isWeekly = committee?.frequency === 'Weekly';
  const paymentsPerCycle = committee?.paymentsPerCycle || 1;
  const payoutsPerCycle = isWeekly ? (committee?.payoutsPerCycle || 2) : 1;
  const committeeMembers = members.filter(m => committee?.members?.includes(m.id));
  const currentSchedule = (committee?.schedule || []).find(s => s.cycleNumber === currentCycle);
  const cycleLabel = currentSchedule?.label || `Month ${currentCycle}`;

  const getPaymentStatus = (memberId, paymentNum) => {
    return (committee?.contributions || []).find(
      c => c.memberId === memberId && c.cycleNumber === currentCycle && c.paymentNumber === paymentNum
    )?.status === 'paid';
  };

  const handlePayment = async (memberId, paymentNum = 1) => {
    try {
      await markContributionPaid(committeeId, memberId, currentCycle, paymentNum);
      const m = members.find(m => m.id === memberId);
      showSnack(`✓ Payment received from ${m?.name}`);
    } catch (e) {
      alert("Cloud Sync Error: " + e.message);
    }
  };

  const markAllPaid = async (paymentNum = 1) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    showSnack(`⏳ Marking all as paid...`);
    try {
      // Use sequential processing to ensure DB integrity
      for (const m of committeeMembers) {
        if (!getPaymentStatus(m.id, paymentNum)) {
          await markContributionPaid(committeeId, m.id, currentCycle, paymentNum);
        }
      }
      showSnack(`✓ All members marked as paid`);
    } catch (e) {
      alert("Error marking all paid: " + e.message);
    }
  };

  const cyclePayouts = (committee?.payouts || []).filter(p => p.cycleNumber === currentCycle);
  const totalCommitteePayouts = committee?.payouts?.length || 0;
  const totalMembersInCommittee = committee?.members?.length || 0;

  const totalPaymentsNeeded = totalMembersInCommittee * paymentsPerCycle;
  const totalPaymentsMade = (committee?.contributions || []).filter(
    c => c.cycleNumber === currentCycle && c.status === 'paid'
  ).length;
  
  const amountNeededForCycle = Math.min(
    (payoutsPerCycle * committee.totalAmount), 
    (totalMembersInCommittee - (totalCommitteePayouts - cyclePayouts.length)) * committee.totalAmount
  );

  const amountCollectedThisCycle = totalPaymentsMade * (isWeekly ? committee.weeklyContribution : committee.contributionAmount);
  
  const allPaymentsComplete = amountCollectedThisCycle >= amountNeededForCycle;

  const currentPaymentNum = isWeekly ? currentWeek : 1;
  const currentWeekPaid = committeeMembers.filter(m => getPaymentStatus(m.id, currentPaymentNum)).length;
  const currentWeekComplete = currentWeekPaid === committeeMembers.length;

  const currentCyclePayoutsDone = cyclePayouts.length >= payoutsPerCycle;
  const entireCommitteeDone = totalCommitteePayouts >= totalMembersInCommittee;
  const allPayoutsDone = entireCommitteeDone; // Alias for backward compatibility if used in other UI parts

  const getScheduledMembersForCycle = (cycle) => {
    const startIdx = (cycle - 1) * payoutsPerCycle;
    return committee.members.slice(startIdx, startIdx + payoutsPerCycle);
  };

  const handlePayout = async () => {
    if (cyclePayouts.length >= payoutsPerCycle) {
      setSnackMsg("✓ All payouts for this cycle are done!");
      setSnackVisible(true);
      return;
    }

    const paidMemberIdsInCycle = committee.contributions
      .filter(c => c.cycleNumber === currentCycle && c.status === 'paid')
      .map(c => c.memberId);

    let winners = [];
    
    if (committee.payoutMethod === 'Random') {
      const alreadyPaidIds = committee.payouts.map(p => p.memberId);
      const eligibleIds = committee.members.filter(id => 
        !alreadyPaidIds.includes(id) && paidMemberIdsInCycle.includes(id)
      );

      if (eligibleIds.length === 0) {
        setSnackMsg("🚫 No eligible winners! Members must pay for this cycle first.");
        setSnackVisible(true);
        return;
      }

      const remainingPayouts = payoutsPerCycle - cyclePayouts.length;
      const pool = [...eligibleIds];
      for (let i = 0; i < Math.min(remainingPayouts, eligibleIds.length); i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(randomIndex, 1)[0]);
      }
    } else {
      const scheduledIds = getScheduledMembersForCycle(currentCycle);
      const toPay = scheduledIds.filter(id => !cyclePayouts.find(p => p.memberId === id));
      const unpaidScheduled = toPay.filter(id => !paidMemberIdsInCycle.includes(id));
      if (unpaidScheduled.length > 0) {
        const names = unpaidScheduled.map(id => members.find(m => m.id === id)?.name).join(', ');
        setSnackMsg(`🚫 ${names} must pay their contribution first!`);
        setSnackVisible(true);
        return;
      }
      winners = toPay;
    }

    if (winners.length === 0) return;

    for (const winnerId of winners) {
      await recordPayout(committeeId, winnerId, committee.totalAmount, currentCycle);
    }

    const winnerData = winners.map(id => members.find(m => m.id === id));
    const namesList = winnerData.map(m => m?.name).join(', ');
    const payoutMsg = `🎉 PAYOUT ALERT 🎉\n\nAssalam alaikum everyone!\n\n${winnerData.map(m => `• Rs ${committee.totalAmount.toLocaleString()} → ${m?.name}`).join('\n')}\n\nfrom "${committee.name}" (${cycleLabel}).\n\nJazakAllah khair!\n_Sent via وصلة_`;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💸 Payout — ${committee.name}`,
          body: `Rs ${committee.totalAmount.toLocaleString()} each released to ${namesList}`,
        },
        trigger: null,
      });
    } catch (e) {}

    setSnackMsg(`💸 Payout released to ${namesList}`);
    setSnackVisible(true);
    sendViaWhatsApp(payoutMsg, winnerData.length === 1 ? winnerData[0]?.phone : null);
  };

  const sendGroupReminder = async () => {
    const rawDate = currentSchedule?.dueDate;
    let dueDate = new Date();
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) dueDate = parsed;
    }
    
    let message = '';
    if (isWeekly) {
      // Calculate the last day of the respective week
      // Week 1 = day 1-7, Week 2 = day 8-14, Week 3 = day 15-21, Week 4 = day 22-end of month
      const monthStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
      let weekEndDay;
      if (currentWeek === 4) {
        // Last day of the month
        weekEndDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);
      } else {
        weekEndDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), currentWeek * 7);
      }
      const weekEndStr = format(weekEndDay, 'EEEE, do MMMM yyyy');
      message = `🛑 REMINDER 🛑\n\nAssalam alaikum everyone\n\nKindly send your Week ${currentWeek} instalment of Rs ${committee.weeklyContribution.toLocaleString()} for "${committee.name}" by ${weekEndStr}.\n\nJazakAllah khair!`;
    } else {
      const deadlineDate = addDays(new Date(dueDate.getFullYear(), dueDate.getMonth(), 1), 6);
      const deadlineStr = format(deadlineDate, 'do MMMM');
      message = `🛑 REMINDER 🛑\n\nAssalam alaikum everyone\n\nKindly send your instalments of Rs ${Math.round(committee.contributionAmount).toLocaleString()} for "${committee.name}" by ${deadlineStr}.\n\nJazakAllah khair!`;
    }

    sendViaWhatsApp(message);
  };

  const latestReachedCycle = Math.min(committee.cycles, Math.floor((committee.payouts?.length || 0) / payoutsPerCycle) + 1);
  const canGoNext = currentCycle < committee.cycles && (currentCycle < latestReachedCycle || currentCyclePayoutsDone);
  const canGoPrev = currentCycle > 1;

  const goNext = () => {
    if (canGoNext || currentCycle < latestReachedCycle) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentCycle(c => c + 1);
      setCurrentWeek(1);
    }
  };
  const goPrev = () => {
    if (canGoPrev) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentCycle(c => c - 1);
      setCurrentWeek(1);
    }
  };

  const progressFraction = amountNeededForCycle > 0 ? Math.min(1, amountCollectedThisCycle / amountNeededForCycle) : 1;
  const isCommitteeComplete = currentCycle === committee.cycles && allPayoutsDone;

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView style={[styles.container, { backgroundColor: theme.colors.background, opacity: fadeAnim }]} contentContainerStyle={{paddingBottom: 40}}>
        {/* Header */}
        <LinearGradient
          colors={['#064E3B', '#022C22']}
          start={{x:0, y:0}} end={{x:1, y:1}}
          style={styles.headerGradient}
        >
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Title style={[styles.headerTitle, { color: '#D4AF37' }]}>{committee.name}</Title>
              <Paragraph style={[styles.headerSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                {isWeekly 
                  ? `Rs ${committee.weeklyContribution}/week • ${committee.members.length} members`
                  : `Rs ${committee.totalAmount.toLocaleString()} pot • ${committee.members.length} members`}
              </Paragraph>
              <Text style={[styles.headerBadge, { backgroundColor: 'rgba(212, 175, 55, 0.2)', color: '#D4AF37', borderColor: '#D4AF37' }]}>
                {committee.frequency} • {committee.payoutMethod} • {committee.cycles} month{committee.cycles > 1 ? 's' : ''}
              </Text>
            </View>
            <IconButton icon="pencil" iconColor="#D4AF37" size={22} style={styles.editBtn}
              onPress={() => navigation.navigate('CreateCommittee', { committeeId })} />
          </View>
        </LinearGradient>

        {/* Early Completion Banner */}
        {entireCommitteeDone && (
          <Surface style={[styles.completeBanner, { backgroundColor: isDark ? '#1b5e20' : '#E8F5E9' }]} elevation={2}>
            <Title style={{ color: isDark ? '#81c784' : '#2e7d32', textAlign: 'center', fontWeight: 'bold' }}>🎉 Committee Completed!</Title>
            <Text style={{ color: isDark ? '#a5d6a7' : '#4caf50', textAlign: 'center', marginTop: 8 }}>
              All {committee.members.length} payouts have been disbursed successfully. No further collections required.
            </Text>
          </Surface>
        )}

        {/* Cycle / Month Selector & Collections (Hidden when completed) */}
        {!entireCommitteeDone && (
          <>
          <Surface style={[styles.cycleCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={[styles.cycleNav, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderRadius: 12, marginHorizontal: 8 }]}>
            <IconButton icon="chevron-left" disabled={!canGoPrev} onPress={goPrev} iconColor={theme.colors.onSurface} size={28} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Title style={[styles.cycleLabel, { color: theme.colors.onSurface, fontSize: 18 }]}>{cycleLabel}</Title>
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: 'bold' }}>
                Month {currentCycle} of {committee.cycles}
              </Text>
              <Text style={{ color: isDark ? '#aaa' : '#888', fontSize: 12 }}>
                {isWeekly ? `Rs ${committee.weeklyContribution}/week per member` : `Rs ${Math.round(committee.contributionAmount).toLocaleString()}/month per member`}
              </Text>
            </View>
            <IconButton icon="chevron-right" disabled={!canGoNext} onPress={goNext} iconColor={theme.colors.primary} size={28} />
          </View>
          <View style={styles.progressRow}>
            <Text style={{ color: isDark ? '#aaa' : '#888', fontSize: 12 }}>Rs {amountCollectedThisCycle.toLocaleString()} / {amountNeededForCycle.toLocaleString()} collected</Text>
            <Text style={{ color: allPaymentsComplete ? '#4caf50' : '#ff9800', fontSize: 12, fontWeight: 'bold' }}>
              {allPaymentsComplete ? '✓ Ready' : 'In Progress'}
            </Text>
          </View>
          <ProgressBar progress={progressFraction} color={allPaymentsComplete ? '#4caf50' : theme.colors.primary} style={styles.progressBar} />
          {!entireCommitteeDone && !allPaymentsComplete && (
            <Text style={[styles.lockHint, { color: '#ff9800' }]}>⚠ Collect remaining Rs {(amountNeededForCycle - amountCollectedThisCycle).toLocaleString()} to enable payout</Text>
          )}
          {allPaymentsComplete && !currentCyclePayoutsDone && (
            <Text style={[styles.lockHint, { color: '#4caf50' }]}>✓ All collected! Scroll down to disburse</Text>
          )}
          {currentCyclePayoutsDone && currentCycle < committee.cycles && (
            <Text style={[styles.lockHint, { color: '#2196f3', fontWeight: 'bold' }]}>⭐ Cycle complete! Tap the arrow (→) for Month {currentCycle + 1}</Text>
          )}
        </Surface>

        {/* Week selector */}
        {isWeekly && (
          <View style={styles.weekSelector}>
            {[1, 2, 3, 4].map(w => {
              const weekPaid = committeeMembers.filter(m => getPaymentStatus(m.id, w)).length;
              const isComplete = weekPaid === committeeMembers.length;
              const isActive = w === currentWeek;
              return (
                <Surface key={w} style={[styles.weekChip, { 
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                  borderColor: isComplete ? '#4caf50' : 'transparent', borderWidth: isComplete ? 2 : 0,
                }]} elevation={isActive ? 3 : 1}>
                  <Text onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentWeek(w); }}
                    style={{ color: isActive ? '#fff' : theme.colors.onSurface, fontWeight: 'bold', fontSize: 13, textAlign: 'center' }}>
                    Week {w}{'\n'}<Text style={{ fontWeight: 'normal', fontSize: 11 }}>{weekPaid}/{committeeMembers.length}</Text>
                  </Text>
                </Surface>
              );
            })}
          </View>
        )}

        {/* Payments Section */}
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>{isWeekly ? `Week ${currentWeek} Payments` : 'Payments'}</Title>
          {!currentWeekComplete && (
            <Button mode="text" compact onPress={() => markAllPaid(currentPaymentNum)} textColor={theme.colors.primary}>Mark All</Button>
          )}
        </View>

        {/* Reminder Bar */}
        {!currentWeekComplete && (
          <Surface style={[styles.reminderBar, { backgroundColor: isDark ? '#3a2a1a' : '#FFF3E0' }]} elevation={1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDark ? '#ffb74d' : '#E65100', fontWeight: 'bold' }}>
                {committeeMembers.length - currentWeekPaid} member(s) pending
              </Text>
            </View>
            <Button mode="contained" compact icon="whatsapp" buttonColor="#25D366" textColor="#fff"
              onPress={sendGroupReminder} labelStyle={{ fontSize: 12 }}>
              Send Reminder
            </Button>
          </Surface>
        )}

        {committeeMembers.map(member => {
          const isPaid = getPaymentStatus(member.id, currentPaymentNum);
          return (
            <Surface key={member.id} style={[styles.memberItem, { backgroundColor: isPaid ? (isDark ? '#1a3a1a' : '#E8F5E9') : theme.colors.surface }]} elevation={1}>
              <View style={styles.memberInfo}>
                <Avatar.Text size={40} label={member.name.substring(0, 2).toUpperCase()} 
                  style={{ backgroundColor: isPaid ? '#4caf50' : (isDark ? '#444' : '#e0e0e0') }} color="#fff" />
                <View style={styles.memberTextWrapper}>
                  <Text style={[styles.memberName, { color: theme.colors.onSurface }]}>{member.name}</Text>
                  <Text style={{ color: isPaid ? '#4caf50' : '#f44336', fontSize: 13, fontWeight: '600' }}>
                    {isPaid ? '✓ Paid' : '✗ Pending'} — Rs {(isWeekly ? committee.weeklyContribution : Math.round(committee.contributionAmount)).toLocaleString()}
                  </Text>
                </View>
              </View>
              {isPaid ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconButton 
                    icon="whatsapp" 
                    iconColor="#4caf50" 
                    size={20} 
                    onPress={() => {
                      const m = members.find(m => m.id === member.id);
                      const msg = `✅ *PAYMENT RECEIVED* ✅\n\nAssalam alaikum *${m?.name}*,\n\nYour payment of *Rs ${committee.weeklyContribution || committee.contributionAmount}* for *${committee.name}* (${isWeekly ? `Week ${currentPaymentNum}` : cycleLabel}) has been received and recorded.\n\nThank you!\n_Sent via وصلة_`;
                      sendViaWhatsApp(msg, m?.phone);
                    }}
                  />
                  <List.Icon icon="check-circle" color="#4caf50" />
                </View>
              ) : (
                <Button mode="contained" compact onPress={() => handlePayment(member.id, currentPaymentNum)} style={styles.payButton} labelStyle={{ fontSize: 12 }}>Receive</Button>
              )}
            </Surface>
          );
        })}
        </>
        )}
        
        {/* Payout Section */}
        <Title style={[styles.sectionTitle, { marginTop: 24, color: theme.colors.onBackground }]}>
          {committee.payoutMethod === 'Random' ? '🎲 Payout Ballot' : '📋 Scheduled Payout'}
          {isWeekly ? ` (${payoutsPerCycle}/month)` : ''}
        </Title>
        
        <LinearGradient
          colors={allPaymentsComplete ? (isDark ? ['#00c6ff', '#0072ff'] : ['#667eea', '#764ba2']) : (isDark ? ['#333', '#444'] : ['#e0e0e0', '#bdbdbd'])}
          style={styles.payoutCard} start={{x:0, y:0}} end={{x:1, y:0}}>
          {!allPaymentsComplete ? (
            <View>
              <Text style={[styles.payoutCardText, { color: isDark ? '#aaa' : '#666' }]}>
                🔒 Collect required payments for {cycleLabel} before disbursing payouts.
              </Text>
              <Text style={{ color: isDark ? '#888' : '#999', fontSize: 12, marginTop: 4 }}>Rs {amountCollectedThisCycle.toLocaleString()} of {amountNeededForCycle.toLocaleString()} received</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.payoutCardText, { color: '#fff' }]}>
                {committee.payoutMethod === 'Random' 
                  ? (() => {
                      const allPaidIds = (committee?.payouts || []).map(p => p.memberId);
                      const eligibleCount = (committee?.members || []).filter(id => !allPaidIds.includes(id)).length;
                      return `Run ballot for ${payoutsPerCycle - cyclePayouts.length} payout(s) of Rs ${committee.totalAmount.toLocaleString()}\n(${eligibleCount} members eligible)`;
                    })()
                  : (() => {
                      const scheduledIds = getScheduledMembersForCycle(currentCycle);
                      const names = scheduledIds.map(id => {
                        const m = members.find(m => m.id === id);
                        const done = cyclePayouts.find(p => p.memberId === id);
                        return m ? (done ? `${m.name} ✓` : m.name) : 'Unknown';
                      }).join(', ');
                      return `Payout to: ${names}\nRs ${committee.totalAmount.toLocaleString()} each`;
                    })()
                }
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 12 }}>{cyclePayouts.length}/{payoutsPerCycle} disbursed</Text>
              {currentCyclePayoutsDone && currentCycle < committee.cycles ? (
                <Button mode="contained" onPress={goNext} icon="arrow-right-bold-circle"
                  style={styles.payoutButton} buttonColor="#fff" textColor={theme.colors.primary}>
                  Move to Month {currentCycle + 1}
                </Button>
              ) : (
                <Button mode="contained" onPress={handlePayout} icon={committee.payoutMethod === 'Random' ? 'ticket' : 'cash-multiple'}
                  style={styles.payoutButton} buttonColor="#fff" textColor="#6200EE" disabled={currentCyclePayoutsDone}>
                  {currentCyclePayoutsDone 
                    ? '✓ All Disbursed' 
                    : (committee.payoutMethod === 'Random' 
                      ? `Run Ballot (${payoutsPerCycle} payouts)` 
                      : (payoutsPerCycle > 1 ? `Release All ${payoutsPerCycle} Payouts` : 'Disburse Payout'))}
                </Button>
              )}
            </>
          )}
        </LinearGradient>

        {/* History */}
        {committee.payouts.length > 0 && (
          <View style={styles.payoutHistory}>
            <Title style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>💰 Payout History</Title>
            {committee.payouts.map((p, idx) => {
              const m = members.find(m => m.id === p.memberId);
              return (
                <Surface key={idx} style={[styles.historyItem, { backgroundColor: theme.colors.surface }]} elevation={1}>
                  <View>
                    <Text style={{ color: isDark ? '#aaa' : '#666', fontSize: 12 }}>
                      {committee.schedule.find(s => s.cycleNumber === p.cycleNumber)?.label || `Month ${p.cycleNumber}`}
                    </Text>
                    <Text style={{ color: theme.colors.onSurface, fontWeight: 'bold', fontSize: 15 }}>{m?.name}</Text>
                  </View>
                  <Text style={{ color: '#4caf50', fontWeight: 'bold', fontSize: 16 }}>Rs {p.amount.toLocaleString()}</Text>
                </Surface>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>
      <Snackbar visible={snackVisible} onDismiss={() => setSnackVisible(false)} duration={3000}
        style={{ backgroundColor: isDark ? '#333' : '#323232' }}>
        {snackMsg}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { padding: 24, paddingTop: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 4 },
  headerBadge: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  editBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  completeBanner: { margin: 16, padding: 20, borderRadius: 16 },
  cycleCard: { margin: 16, padding: 16, borderRadius: 16 },
  cycleNav: { flexDirection: 'row', alignItems: 'center' },
  cycleLabel: { fontSize: 20, fontWeight: 'bold' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  progressBar: { borderRadius: 4, height: 6 },
  lockHint: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  weekSelector: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  weekChip: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontWeight: 'bold', fontSize: 18, marginLeft: 16 },
  reminderBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12 },
  memberItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberTextWrapper: { marginLeft: 12, flex: 1 },
  memberName: { fontSize: 15, fontWeight: 'bold' },
  payButton: { borderRadius: 8 },
  payoutCard: { margin: 16, padding: 20, borderRadius: 16 },
  payoutCardText: { fontSize: 14, marginBottom: 8 },
  payoutButton: { borderRadius: 10 },
  payoutHistory: { marginTop: 8 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
});
