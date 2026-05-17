import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Share, LayoutAnimation, UIManager, Platform, useColorScheme, Alert, Animated, Linking, TouchableOpacity, Dimensions, KeyboardAvoidingView } from 'react-native';
import { Title, Paragraph, List, Button, Text, Surface, useTheme, Avatar, ProgressBar, IconButton, Snackbar, Portal, Dialog, TextInput } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { format, addDays } from 'date-fns';

const { width, height } = Dimensions.get('window');

// --- Custom Confetti Component ---
function ConfettiParticle({ index }) {
  const anim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500 + Math.random() * 1000,
          delay: Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, height + 50],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.random() * width, (Math.random() - 0.5) * 100 + (Math.random() * width)],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const colors = ['#D4AF37', '#10b981', '#fff', '#064E3B'];
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: colors[index % colors.length],
          transform: [{ translateY }, { translateX }, { rotate }],
          left: 0,
        },
      ]}
    />
  );
}

export default function CommitteeDetailScreen({ route, navigation }) {
  const { committeeId } = route.params;
  const { committees, members, markContributionPaid, recordPayout } = useStore();
  const theme = useTheme();
  const isDark = theme.dark;
  
  const committee = committees.find(c => c.id === committeeId);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: '', msg: '' });
  const [notes, setNotes] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const storedNotes = await AsyncStorage.getItem(`committee_notes_${committeeId}`);
        if (storedNotes !== null) {
          setNotes(storedNotes);
        } else {
          setNotes('');
        }
      } catch (e) {
        console.log("Error loading committee notes:", e);
      }
    };
    loadNotes();
  }, [committeeId]);

  const saveNotes = async (text) => {
    setNotes(text);
    try {
      await AsyncStorage.setItem(`committee_notes_${committeeId}`, text);
    } catch (e) {
      console.log("Error saving committee notes:", e);
    }
  };

  const showDialog = (title, msg) => {
    setDialogContent({ title, msg });
    setDialogVisible(true);
  };

  useEffect(() => {
    if (committee) {
      setLoading(true);
      const payouts = committee.payouts || [];
      const payoutsPerCycle = (committee.frequency === 'Weekly') ? (committee.payoutsPerCycle || 2) : 1;
      const lastPayoutIdx = payouts.length;
      const activeCycle = Math.min(committee.cycles, Math.floor(lastPayoutIdx / payoutsPerCycle) + 1);
      setCurrentCycle(activeCycle);

      if (committee.frequency === 'Weekly') {
        const contributions = committee.contributions || [];
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
      setTimeout(() => {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      }, 600);
    }
  }, [committeeId]);

  if (loading && !committee) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, padding: 20, paddingTop: 60 }]}>
        <Surface style={{ height: 200, borderRadius: 32, marginBottom: 20, opacity: 0.1 }} />
        <Surface style={{ height: 100, borderRadius: 24, marginBottom: 10, opacity: 0.1 }} />
        <Surface style={{ height: 60, borderRadius: 16, marginBottom: 10, opacity: 0.1 }} />
        <Surface style={{ height: 60, borderRadius: 16, marginBottom: 10, opacity: 0.1 }} />
      </View>
    );
  }

  if (!committee) return <View style={styles.container}><Text style={{color: theme.colors.onBackground, padding: 20}}>Committee not found</Text></View>;

  const showSnack = (msg) => { setSnackMsg(msg); setSnackVisible(true); };
  
  const sendViaWhatsApp = (msg, phone = null) => {
    let url = phone 
      ? `whatsapp://send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`
      : `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) { Linking.openURL(url); showSnack("📲 Opening WhatsApp Chat..."); }
      else alert("WhatsApp is not installed");
    });
  };

  const isWeekly = committee?.frequency === 'Weekly';
  const paymentsPerCycle = committee?.paymentsPerCycle || 1;
  const payoutsPerCycle = isWeekly ? (committee?.payoutsPerCycle || 2) : 1;
  const committeeMembers = members.filter(m => committee?.members?.includes(m.id));
  const currentSchedule = (committee?.schedule || []).find(s => s.cycleNumber === currentCycle);
  const cycleLabel = currentSchedule?.label || `Month ${currentCycle}`;

  const getPaymentStatus = (memberId, paymentNum) => (committee?.contributions || []).find(
    c => c.memberId === memberId && c.cycleNumber === currentCycle && c.paymentNumber === paymentNum
  )?.status === 'paid';

  const handlePayment = async (memberId, paymentNum = 1) => {
    try {
      await markContributionPaid(committeeId, memberId, currentCycle, paymentNum);
      const m = members.find(m => m.id === memberId);
      showSnack(`✓ Payment received from ${m?.name}`);
    } catch (e) { alert("Sync Error: " + e.message); }
  };

  const markAllPaid = async (paymentNum = 1) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    showSnack(`⏳ Updating all payments...`);
    try {
      for (const m of committeeMembers) {
        if (!getPaymentStatus(m.id, paymentNum)) await markContributionPaid(committeeId, m.id, currentCycle, paymentNum);
      }
      showSnack(`✓ All payments recorded`);
    } catch (e) { alert("Error: " + e.message); }
  };

  const cyclePayouts = (committee?.payouts || []).filter(p => p.cycleNumber === currentCycle);
  const totalCommitteePayouts = committee?.payouts?.length || 0;
  const totalMembersInCommittee = committee?.members?.length || 0;
  
  const amountNeededForCycle = Math.min((payoutsPerCycle * committee.totalAmount), (totalMembersInCommittee - (totalCommitteePayouts - cyclePayouts.length)) * committee.totalAmount);
  const totalPaymentsMade = (committee?.contributions || []).filter(c => c.cycleNumber === currentCycle && c.status === 'paid').length;
  const amountCollectedThisCycle = totalPaymentsMade * (isWeekly ? committee.weeklyContribution : committee.contributionAmount);
  const allPaymentsComplete = amountCollectedThisCycle >= amountNeededForCycle;
  const currentPaymentNum = isWeekly ? currentWeek : 1;
  const currentWeekPaid = committeeMembers.filter(m => getPaymentStatus(m.id, currentPaymentNum)).length;
  const currentWeekComplete = currentWeekPaid === committeeMembers.length;
  const currentCyclePayoutsDone = cyclePayouts.length >= payoutsPerCycle;
  const entireCommitteeDone = totalCommitteePayouts >= totalMembersInCommittee;

  const handlePayout = async () => {
    if (currentCyclePayoutsDone || loading) return;
    
    setLoading(true);
    // Celebration Effect
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 5000);

    const paidMemberIdsInCycle = (committee.contributions || [])
      .filter(c => c.cycleNumber === currentCycle && c.status === 'paid')
      .map(c => String(c.memberId).trim());

    const allHistoricalPayouts = (committee.payouts || []).map(p => String(p.memberId).trim());
    
    let winners = [];
    if (committee.payoutMethod === 'Random') {
      const eligibleIds = committee.members.filter(id => {
        const sid = String(id).trim();
        return !allHistoricalPayouts.includes(sid) && paidMemberIdsInCycle.includes(sid);
      });

      if (eligibleIds.length === 0) { 
        setLoading(false);
        setShowCelebration(false); 
        showSnack("🚫 No eligible winners! Either all have been paid or members haven't paid this month."); 
        return; 
      }
      
      const remainingSlots = payoutsPerCycle - cyclePayouts.length;
      const pool = [...eligibleIds];
      const numToPick = Math.min(remainingSlots, pool.length);
      for (let i = 0; i < numToPick; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(randomIndex, 1)[0]);
      }
    } else {
      const startIdx = (currentCycle - 1) * payoutsPerCycle;
      const scheduledIds = committee.members.slice(startIdx, startIdx + payoutsPerCycle);
      winners = scheduledIds.filter(id => {
        const sid = String(id).trim();
        return !allHistoricalPayouts.includes(sid) && !cyclePayouts.find(p => String(p.memberId).trim() === sid);
      });

      const unpaid = winners.filter(id => !paidMemberIdsInCycle.includes(String(id).trim()));
      if (unpaid.length > 0) { 
        setLoading(false);
        setShowCelebration(false); 
        showSnack(`🚫 Scheduled members must pay their contribution first!`); 
        return; 
      }
    }

    try {
      for (const winnerId of winners) {
        await recordPayout(committeeId, winnerId, committee.totalAmount, currentCycle);
      }
      
      // Schedule Auto-Reminder for Admin
      try {
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(1); // Set to 1st of next month
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🏛️ Baitul Maal Collection",
            body: `Time to collect Rs ${(isWeekly ? committee.weeklyContribution : committee.contributionAmount).toLocaleString()} for "${committee.name}" (Cycle ${currentCycle + 1})`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            channelId: 'default',
          },
          trigger: { date: nextDate },
        });
      } catch (e) { console.log("Notif error:", e); }

      const winnerData = winners.map(id => members.find(m => String(m.id).trim() === String(id).trim()));
      const msg = "🎉 *CONGRATULATIONS* 🎉\n\n" +
                  "Assalam alaikum everyone!\n\n" +
                  "Today's payout from *\"" + committee.name + "\"* has been disbursed to:\n\n" +
                  winnerData.map(m => "• *Rs " + committee.totalAmount.toLocaleString() + "* → *" + (m?.name || '') + "*").join('\n') +
                  "\n\nJazakAllah khair for your timely contributions!\n_Sent via رزقلي_";
      
      setTimeout(() => {
        sendViaWhatsApp(msg, winnerData.length === 1 ? winnerData[0]?.phone : null);
        showSnack(`💸 Payout released!`);
        setLoading(false);
      }, 1500);
    } catch (e) {
      setLoading(false);
      showDialog("Payout Error", e.message);
    }
  };

  const sendGroupReminder = async () => {
    const rawDate = currentSchedule?.dueDate;
    let dueDate = new Date();
    if (rawDate && !isNaN(new Date(rawDate).getTime())) dueDate = new Date(rawDate);
    
    let message = '';
    if (isWeekly) {
      const weekEndDay = currentWeek === 4 
        ? new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0)
        : new Date(dueDate.getFullYear(), dueDate.getMonth(), currentWeek * 7);
      message = "🛑 *REMINDER* 🛑\n\n" +
                "Assalam alaikum everyone\n\n" +
                "Kindly send your Week " + currentWeek + " instalment of *Rs " + committee.weeklyContribution.toLocaleString() + "* for *\"" + committee.name + "\"* by " + format(weekEndDay, 'EEEE, do MMMM') + ".\n\n" +
                "JazakAllah khair!";
    } else {
      const deadlineDate = addDays(new Date(dueDate.getFullYear(), dueDate.getMonth(), 1), 6);
      message = "🛑 *REMINDER* 🛑\n\n" +
                "Assalam alaikum everyone\n\n" +
                "Kindly send your instalments of *Rs " + Math.round(committee.contributionAmount).toLocaleString() + "* for *\"" + committee.name + "\"* by " + format(deadlineDate, 'do MMMM') + ".\n\n" +
                "JazakAllah khair!";
    }
    sendViaWhatsApp(message);
  };

  const latestReachedCycle = Math.min(committee.cycles, Math.floor((committee.payouts?.length || 0) / payoutsPerCycle) + 1);
  const canGoNext = currentCycle < committee.cycles && (currentCycle < latestReachedCycle || currentCyclePayoutsDone);
  const canGoPrev = currentCycle > 1;

  const goNext = () => { if (canGoNext || currentCycle < latestReachedCycle) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentCycle(c => c + 1); setCurrentWeek(1); } };
  const goPrev = () => { if (canGoPrev) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentCycle(c => c - 1); setCurrentWeek(1); } };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {showCelebration && (
        <View style={styles.celebrationOverlay} pointerEvents="none">
          {[...Array(40)].map((_, i) => <ConfettiParticle key={i} index={i} />)}
        </View>
      )}

      <Animated.ScrollView style={{ flex: 1, opacity: fadeAnim }} contentContainerStyle={{ paddingBottom: 60 }}>
        <LinearGradient colors={['#064E3B', '#022C22']} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.arabicHeading}>تفاصيل الجمعية</Text>
              <Title style={styles.headerTitle}>{committee.name}</Title>
              <Text style={styles.headerSubtitle}>Rs {committee.totalAmount.toLocaleString()} pot • {committee.members.length} members</Text>
              <View style={styles.headerBadges}>
                <View style={[styles.badge, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                  <Text style={styles.badgeText}>{(committee.frequency || 'Monthly').toUpperCase()}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', marginLeft: 8 }]}>
                  <Text style={[styles.badgeText, { color: '#10b981' }]}>{(committee.payoutMethod || 'Fixed').toUpperCase()}</Text>
                </View>
              </View>
            </View>
            {!entireCommitteeDone && (
              <IconButton icon="pencil-outline" iconColor="#D4AF37" size={24} onPress={() => navigation.navigate('CreateCommittee', { committeeId })} />
            )}
          </View>
        </LinearGradient>

        {!entireCommitteeDone && (
          <Surface style={[styles.timelineCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.timelineHeader}>
              <IconButton icon="chevron-left" disabled={!canGoPrev} onPress={goPrev} iconColor={theme.colors.onSurface} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Title style={[styles.cycleLabel, { color: theme.colors.onSurface }]}>{cycleLabel}</Title>
                <Text style={styles.cycleSub}>Month {currentCycle} of {committee.cycles}</Text>
              </View>
              <IconButton icon="chevron-right" disabled={!canGoNext} onPress={goNext} iconColor={theme.colors.primary} />
            </View>
            <View style={styles.progressBox}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>COLLECTION PROGRESS</Text>
                <Text style={[styles.progressVal, { color: theme.colors.primary }]}>{Math.round((amountCollectedThisCycle / (amountNeededForCycle || 1)) * 100)}%</Text>
              </View>
              <ProgressBar progress={amountCollectedThisCycle / (amountNeededForCycle || 1)} color={allPaymentsComplete ? '#10b981' : '#D4AF37'} style={styles.progressBar} />
              <Text style={styles.amountStatus}>Rs {amountCollectedThisCycle.toLocaleString()} / {amountNeededForCycle.toLocaleString()}</Text>
            </View>
          </Surface>
        )}

        {isWeekly && (
          <View style={styles.weekGrid}>
            {[1, 2, 3, 4].map(w => (
              <TouchableOpacity key={w} activeOpacity={0.8} style={styles.weekCol} onPress={() => setCurrentWeek(w)}>
                <Surface style={[styles.weekCard, { backgroundColor: currentWeek === w ? '#064E3B' : theme.colors.surface, borderColor: currentWeek === w ? '#D4AF37' : theme.colors.outline, borderBottomColor: currentWeek === w ? '#D4AF37' : 'transparent' }]} elevation={currentWeek === w ? 4 : 1}>
                  <Text style={[styles.weekTitle, { color: currentWeek === w ? '#fff' : theme.colors.onSurface }]}>W{w}</Text>
                </Surface>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!entireCommitteeDone && (
          <>
            <View style={styles.sectionHead}>
              <Title style={[styles.secTitle, { color: theme.colors.onSurface }]}>{isWeekly ? `Week ${currentWeek} Register` : 'Member Ledger'}</Title>
              {!currentWeekComplete && <Button mode="text" compact onPress={() => markAllPaid(currentPaymentNum)} textColor={theme.colors.primary}>Mark All</Button>}
            </View>

            {!currentWeekComplete && (
              <Surface style={[styles.reminderBar, { backgroundColor: isDark ? '#D4AF3711' : '#FFFBEB' }]} elevation={0}>
                <Icon name="alert-circle-outline" size={20} color="#D4AF37" />
                <Text style={styles.reminderText}>{committeeMembers.length - currentWeekPaid} pending payments</Text>
                <Button mode="contained" compact buttonColor="#25D366" onPress={sendGroupReminder} style={{ borderRadius: 8 }}>Remind</Button>
              </Surface>
            )}

            {committeeMembers.map(member => {
              const isPaid = getPaymentStatus(member.id, currentPaymentNum);
              return (
                <Surface key={member.id} style={[styles.memberCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                  <Avatar.Text size={44} label={member.name.substring(0, 1).toUpperCase()} style={{ backgroundColor: isPaid ? '#064E3B' : '#333' }} color="#D4AF37" />
                  <View style={styles.memberMeta}>
                    <Text style={[styles.memberName, { color: theme.colors.onSurface }]}>{member.name}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: isPaid ? '#10b981' : '#f43f5e' }]} />
                      <Text style={[styles.statusText, { color: isPaid ? '#10b981' : '#f43f5e' }]}>{isPaid ? 'RECEIVED' : 'PENDING'}</Text>
                    </View>
                  </View>
                  {isPaid ? (
                    <IconButton icon="whatsapp" iconColor="#10b981" onPress={() => sendViaWhatsApp(`✅ Payment of Rs ${committee.weeklyContribution || committee.contributionAmount} Received.`, member.phone)} />
                  ) : (
                    <Button mode="contained" compact buttonColor="#064E3B" textColor="#D4AF37" onPress={() => handlePayment(member.id, currentPaymentNum)} style={styles.payBtn}>Receive</Button>
                  )}
                </Surface>
              );
            })}

            <Title style={[styles.secTitle, { marginTop: 32, color: theme.colors.onSurface, marginLeft: 20 }]}>Executive Disbursement</Title>
            <Surface style={[styles.payoutBoard, { backgroundColor: isDark ? '#121212' : '#fff' }]} elevation={4}>
              <LinearGradient colors={allPaymentsComplete ? ['#B8860B', '#8B4513'] : ['#333', '#222']} style={styles.payoutGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
                <Icon name="seal-variant" size={40} color="#D4AF37" style={{ marginBottom: 16 }} />
                <Text style={styles.payoutHeader}>{allPaymentsComplete ? 'TREASURY UNLOCKED' : 'TREASURY LOCKED'}</Text>
                <Text style={styles.payoutDesc}>
                  {allPaymentsComplete ? `Ready to disburse ${payoutsPerCycle} payout(s) for ${cycleLabel}.` : `Complete all payments for ${cycleLabel} to unlock the pot.`}
                </Text>
                {allPaymentsComplete && (
                  <Button mode="contained" buttonColor="#D4AF37" textColor="#064E3B" onPress={currentCyclePayoutsDone && currentCycle < committee.cycles ? goNext : handlePayout} style={styles.actionBtn} labelStyle={{ fontWeight: 'bold' }}>
                    {currentCyclePayoutsDone ? (currentCycle < committee.cycles ? `Proceed to Month ${currentCycle + 1}` : 'Cycle Finished') : 'Authorize Disbursement'}
                  </Button>
                )}
              </LinearGradient>
            </Surface>
          </>
        )}

        {/* --- Payout History Ledger --- */}
        {(committee.payouts?.length || 0) > 0 && (
          <View style={{ marginTop: 40 }}>
            <View style={styles.sectionHead}>
              <Title style={[styles.secTitle, { color: theme.colors.onSurface }]}>السجل (Payout Ledger)</Title>
              <Icon name="book-open-variant" size={20} color="#D4AF37" />
            </View>
            {committee.payouts.map((p, idx) => {
              const m = members.find(mem => mem.id === p.memberId);
              return (
                <Surface key={idx} style={[styles.historyCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyCycle}>{committee.schedule.find(s => s.cycleNumber === p.cycleNumber)?.label || `Month ${p.cycleNumber}`}</Text>
                    <Text style={[styles.historyName, { color: theme.colors.onSurface }]}>{m?.name}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyAmount}>Rs {p.amount.toLocaleString()}</Text>
                    <Text style={styles.historyStatus}>✓ DISBURSED</Text>
                  </View>
                </Surface>
              );
            })}
          </View>
        )}
        {/* --- Administrative Notes Section --- */}
        <Surface style={[styles.notesCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.notesHeader}>
            <Title style={[styles.notesTitle, { color: theme.colors.onSurface }]}>Administrative Memo</Title>
            <Icon name="notebook-edit-outline" size={22} color="#D4AF37" />
          </View>
          <Text style={styles.notesSubtitle}>Private local notes for this committee</Text>
          <TextInput
            placeholder="Type private rules, payment arrangements, or specific cycle agreements here..."
            placeholderTextColor="#888"
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={saveNotes}
            style={[styles.notesInput, { backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9' }]}
            textColor={theme.colors.onSurface}
            activeUnderlineColor="#D4AF37"
          />
        </Surface>
      </Animated.ScrollView>
      <Snackbar 
        visible={snackVisible} 
        onDismiss={() => setSnackVisible(false)} 
        style={{ backgroundColor: isDark ? '#D4AF37' : '#333' }}
      >
        <Text style={{ color: isDark ? '#064E3B' : '#fff', fontWeight: 'bold' }}>{snackMsg}</Text>
      </Snackbar>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ backgroundColor: theme.colors.surface, borderRadius: 28 }}>
          <Dialog.Title style={{ color: '#D4AF37', fontFamily: 'serif' }}>{dialogContent.title}</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: theme.colors.onSurface }}>{dialogContent.msg}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} textColor="#D4AF37">OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 55, paddingBottom: 35, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
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
  headerBadges: { flexDirection: 'row', marginTop: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 9, color: '#D4AF37', fontWeight: 'bold', letterSpacing: 1 },
  timelineCard: { margin: 16, marginTop: -25, borderRadius: 28, padding: 20 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cycleLabel: { fontSize: 22, fontWeight: 'bold', fontFamily: 'serif' },
  cycleSub: { fontSize: 11, color: '#888', marginTop: 1 },
  progressBox: { marginTop: 8 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 9, color: '#888', fontWeight: 'bold', letterSpacing: 1 },
  progressVal: { fontSize: 11, fontWeight: 'bold' },
  progressBar: { height: 6, borderRadius: 3 },
  amountStatus: { fontSize: 10, color: '#888', marginTop: 6, textAlign: 'center' },
  weekGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  weekCol: { flex: 1 },
  weekCard: { height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3 },
  weekTitle: { fontSize: 15, fontWeight: 'bold' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  secTitle: { fontSize: 18, fontWeight: 'bold', fontFamily: 'serif', lineHeight: 26 },
  reminderBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: '#D4AF3744' },
  reminderText: { flex: 1, marginLeft: 8, fontSize: 12, color: '#D4AF37', fontWeight: 'bold' },
  memberCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 20 },
  memberMeta: { flex: 1, marginLeft: 14 },
  memberName: { fontSize: 15, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  statusText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  payBtn: { borderRadius: 12, paddingHorizontal: 12, height: 36, justifyContent: 'center' },
  payoutBoard: { margin: 16, borderRadius: 28, overflow: 'hidden' },
  payoutGrad: { padding: 24, alignItems: 'center' },
  payoutHeader: { color: '#D4AF37', fontSize: 17, fontWeight: 'bold', letterSpacing: 2, marginBottom: 6, fontFamily: 'serif' },
  payoutDesc: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 12, lineHeight: 18, marginBottom: 20 },
  actionBtn: { width: '100%', borderRadius: 14, paddingVertical: 2 },
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 20 },
  historyLeft: { flex: 1 },
  historyCycle: { fontSize: 10, color: '#888', fontWeight: 'bold' },
  historyName: { fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  historyRight: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 17, fontWeight: 'bold', color: '#10b981', fontFamily: 'serif' },
  historyStatus: { fontSize: 8, color: '#D4AF37', fontWeight: 'bold', marginTop: 2 },
  celebrationOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 2 },
  notesCard: { margin: 16, marginTop: 32, borderRadius: 28, padding: 20, marginBottom: 24 },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notesTitle: { fontSize: 18, fontWeight: 'bold', fontFamily: 'serif' },
  notesSubtitle: { fontSize: 9, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  notesInput: { fontSize: 13, minHeight: 90, borderRadius: 16, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
});
