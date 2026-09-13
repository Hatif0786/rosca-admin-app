import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Share, LayoutAnimation, UIManager, Platform, useColorScheme, Alert, Animated, Linking, TouchableOpacity, Dimensions, KeyboardAvoidingView } from 'react-native';
import { Title, Paragraph, List, Button, Text, Surface, useTheme, Avatar, ProgressBar, IconButton, Snackbar, Portal, Dialog, TextInput } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { format, addDays } from 'date-fns';
import { 
  sendPaymentReceiptWhatsApp, 
  sendPayoutDisbursementWhatsApp, 
  sendContributionReminderWhatsApp 
} from '../lib/whatsapp';

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
  // Count occurrences of each member ID to support multiple contributions
  const memberCounts = {};
  committee?.members?.forEach(id => {
    memberCounts[id] = (memberCounts[id] || 0) + 1;
  });
  const currentSchedule = (committee?.schedule || []).find(s => s.cycleNumber === currentCycle);
  const cycleLabel = currentSchedule?.label || `Month ${currentCycle}`;

  const getPaymentStatus = (memberId, paymentNum) => (committee?.contributions || []).find(
    c => c.memberId === memberId && c.cycleNumber === currentCycle && c.paymentNumber === paymentNum
  )?.status === 'paid';

  // Helper to determine if a member has fully paid all required contributions for the current cycle
  const isMemberFullyPaid = (memberId) => {
    if (isWeekly) {
      // Weekly: payment_number is the WEEK (1..paymentsPerCycle). Every week must be paid.
      for (let w = 1; w <= paymentsPerCycle; w++) {
        if (!getPaymentStatus(memberId, w)) return false;
      }
      return true;
    }
    const memberContribs = (committee?.contributions || []).filter(
      c => c.memberId === memberId && c.cycleNumber === currentCycle
    );
    if (memberContribs.length === 0) return false;
    // All contributions (shares) for this member in the cycle must have status 'paid'
    return memberContribs.every(c => c.status === 'paid');
  };

  const handlePayment = async (memberId, paymentNum = 1) => {
    try {
      await markContributionPaid(committeeId, memberId, currentCycle, paymentNum);
      const m = members.find(m => m.id === memberId);
      showSnack(`✓ Payment received from ${m?.name}`);
      if (m?.phone) {
        // Weekly instalments are week-scoped, so one entry covers all of that member's shares.
        const shares = memberCounts[memberId] || 1;
        const receiptAmount = isWeekly
          ? committee.weeklyContribution * shares
          : committee.contributionAmount;
        sendPaymentReceiptWhatsApp(
          m.name,
          m.phone,
          committee.name,
          currentCycle,
          receiptAmount
        ).catch(err => console.log('WhatsApp receipt error:', err));
      }
    } catch (e) { alert("Sync Error: " + e.message); }
  };

  const markAllPaid = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    showSnack(`⏳ Updating all payments...`);
    try {
      for (const m of committeeMembers) {
        if (isWeekly) {
          // Weekly: mark the currently selected week for every member.
          if (!getPaymentStatus(m.id, currentWeek)) {
            await markContributionPaid(committeeId, m.id, currentCycle, currentWeek);
          }
        } else {
          // Monthly: mark every outstanding share for this member (supports multi-share).
          const contribs = (committee.contributions || []).filter(
            c => c.memberId === m.id && c.cycleNumber === currentCycle
          );
          const targets = contribs.length > 0 ? contribs : [{ paymentNumber: 1, status: 'pending' }];
          for (const c of targets) {
            if (c.status !== 'paid') {
              await markContributionPaid(committeeId, m.id, currentCycle, c.paymentNumber || 1);
            }
          }
        }
      }
      showSnack(`✓ All payments recorded`);
    } catch (e) { alert("Error: " + e.message); }
  };

  const cyclePayouts = (committee?.payouts || []).filter(p => p.cycleNumber === currentCycle);
  const totalCommitteePayouts = committee?.payouts?.length || 0;
  const totalMembersInCommittee = committee?.members?.length || 0;
  
  const amountNeededForCycle = isWeekly
    // Weekly: the whole month's pool = weekly rate × every share × 4 weeks.
    ? committee.weeklyContribution * totalMembersInCommittee * paymentsPerCycle
    : Math.min((payoutsPerCycle * committee.totalAmount), (totalMembersInCommittee - (totalCommitteePayouts - cyclePayouts.length)) * committee.totalAmount);
  const totalPaymentsMade = (committee?.contributions || []).filter(c => c.cycleNumber === currentCycle && c.status === 'paid').length;
  const amountCollectedThisCycle = isWeekly
    // Weekly is week-scoped, so one paid week covers all of that member's shares.
    ? (committee?.contributions || [])
        .filter(c => c.cycleNumber === currentCycle && c.status === 'paid' && c.paymentNumber <= paymentsPerCycle)
        .reduce((sum, c) => sum + committee.weeklyContribution * (memberCounts[c.memberId] || 1), 0)
    : totalPaymentsMade * committee.contributionAmount;
  // Weekly unlocks only when EVERY member has paid ALL weeks; monthly uses the collected/needed amount.
  const allPaymentsComplete = isWeekly
    ? (committeeMembers.length > 0 && committeeMembers.every(m => isMemberFullyPaid(m.id)))
    : amountCollectedThisCycle >= amountNeededForCycle;
  const currentWeekPaid = isWeekly
    ? committeeMembers.filter(m => getPaymentStatus(m.id, currentWeek)).length
    : committeeMembers.filter(m => isMemberFullyPaid(m.id)).length;
  const currentWeekComplete = committeeMembers.length > 0 && currentWeekPaid === committeeMembers.length;
  const currentCyclePayoutsDone = cyclePayouts.length >= payoutsPerCycle;
  const entireCommitteeDone = totalCommitteePayouts >= totalMembersInCommittee;

  const handlePayout = async () => {
    if (currentCyclePayoutsDone || loading) return;
    
    setLoading(true);
    // Celebration Effect
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 5000);

    // Only members who have fully paid all their contributions for the current cycle are eligible
    const paidMemberIdsInCycle = committeeMembers
      .filter(m => isMemberFullyPaid(m.id))
      .map(m => String(m.id).trim());

    // Count how many payouts each member has already received (across all cycles).
    const payoutCounts = {};
    (committee.payouts || []).forEach(p => {
      const k = String(p.memberId).trim();
      payoutCounts[k] = (payoutCounts[k] || 0) + 1;
    });

    let winnerId = null;
    if (committee.payoutMethod === 'Random') {
      // Random Ballot: any member who cleared this cycle and still has an unclaimed share slot.
      const eligibleIds = [...new Set(committee.members.map(id => String(id).trim()))]
        .filter(k => paidMemberIdsInCycle.includes(k) && (payoutCounts[k] || 0) < (memberCounts[k] || 1));

      if (eligibleIds.length === 0) {
        setLoading(false);
        setShowCelebration(false);
        showSnack("🚫 No eligible winners! Either all have been paid or members haven't paid this month.");
        return;
      }
      winnerId = eligibleIds[Math.floor(Math.random() * eligibleIds.length)];
    } else {
      // Fixed Order: award the earliest slot in members_order whose payout hasn't been
      // claimed yet. members_order repeats a member once per share, and we "consume" prior
      // payouts so shares and any onboarded history are respected in strict order.
      const consumed = { ...payoutCounts };
      const order = (committee.members || []).map(id => String(id).trim());
      for (const k of order) {
        if ((consumed[k] || 0) > 0) { consumed[k] -= 1; continue; }
        winnerId = k;
        break;
      }
    }

    try {
      if (!winnerId) {
        setLoading(false);
        setShowCelebration(false);
        showSnack("🚫 No eligible winners!");
        return;
      }
      // Full pot amount for the committee (this is the per-payout amount for weekly)
      const payoutAmount = committee.totalAmount;
      await recordPayout(committeeId, winnerId, payoutAmount, currentCycle);
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
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: nextDate,
          },
        });
      } catch (e) { console.log("Notif error:", e); }

      // Prepare winner data for the Evolution payout alert
      const winnerData = members.filter(m => String(m.id).trim() === String(winnerId).trim());

      setTimeout(() => {
        // Automated payout alert to the winner — sent server-side via Evolution API.
        if (winnerData[0]?.phone) {
          sendPayoutDisbursementWhatsApp(
            winnerData[0].name,
            winnerData[0].phone,
            committee.name,
            currentCycle,
            payoutAmount
          ).catch(err => console.log('WhatsApp payout alert error:', err));
        }
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
    // Native WhatsApp deep link (group broadcast)
    sendViaWhatsApp(message);

    // Individual Evolution API reminders to each unpaid member
    const unpaidMembers = isWeekly
      ? committeeMembers.filter(m => !getPaymentStatus(m.id, currentWeek))
      : committeeMembers.filter(m => !isMemberFullyPaid(m.id));
    unpaidMembers.forEach(m => {
      if (m.phone) {
        const shares = memberCounts[m.id] || 1;
        const dueAmount = isWeekly
          ? committee.weeklyContribution * shares
          : (committee.contributions || []).filter(
              c => c.memberId === m.id && c.cycleNumber === currentCycle && c.status !== 'paid'
            ).length * committee.contributionAmount || committee.contributionAmount;
        sendContributionReminderWhatsApp(
          m.name,
          m.phone,
          committee.name,
          currentCycle,
          dueAmount
        ).catch(err => console.log('WhatsApp reminder error for', m.name, ':', err));
      }
    });
    showSnack(`📲 Reminders sent to ${unpaidMembers.length} members`);
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
              {!currentWeekComplete && <Button mode="text" compact onPress={markAllPaid} textColor={theme.colors.primary}>Mark All</Button>}
            </View>

            {!currentWeekComplete && (
              <Surface style={[styles.reminderBar, { backgroundColor: isDark ? '#D4AF3711' : '#FFFBEB' }]} elevation={0}>
                <Icon name="alert-circle-outline" size={20} color="#D4AF37" />
                <Text style={styles.reminderText}>{committeeMembers.length - currentWeekPaid} pending payments</Text>
                <Button mode="contained" compact buttonColor="#25D366" onPress={sendGroupReminder} style={{ borderRadius: 8 }}>Remind</Button>
              </Surface>
            )}

            {/* Render member register: week-scoped for weekly, share-scoped for monthly */}
            {committeeMembers.map(member => {
              const memberId = member.id;
              const memberInfo = members.find(m => m.id === memberId);
              const count = memberCounts[memberId] || 1;

              // Determine paid state + which payment the "Receive" button should clear.
              let cardPaid;
              let receivePaymentNum = null; // null => nothing pending in this view
              const monthlyContribs = isWeekly
                ? []
                : (committee.contributions || []).filter(c => c.memberId === memberId && c.cycleNumber === currentCycle);

              if (isWeekly) {
                // payment_number is the WEEK; the register is scoped to the selected week.
                cardPaid = getPaymentStatus(memberId, currentWeek);
                if (!cardPaid) receivePaymentNum = currentWeek;
              } else {
                cardPaid = monthlyContribs.length > 0 && monthlyContribs.every(c => c.status === 'paid');
                const pending = monthlyContribs.find(c => c.status !== 'paid');
                if (pending) receivePaymentNum = pending.paymentNumber || 1;
                else if (monthlyContribs.length === 0) receivePaymentNum = 1;
              }
              const allPaid = cardPaid;

              return (
                <Surface
                  key={memberId}
                  style={[styles.mCard, {
                    backgroundColor: theme.colors.surface,
                    borderLeftColor: allPaid ? '#10b981' : '#D4AF37',
                  }]}
                  elevation={1}
                >
                  <View style={styles.mCardRow}>
                    {/* Avatar with status ring */}
                    <View style={styles.mAvatarWrap}>
                      <Avatar.Text
                        size={46}
                        label={memberInfo?.name?.charAt(0).toUpperCase() || '?'}
                        style={{ backgroundColor: allPaid ? '#064E3B' : '#1a1a2e' }}
                        color="#D4AF37"
                      />
                      {allPaid && (
                        <View style={styles.mCheckBadge}>
                          <Icon name="check-bold" size={10} color="#fff" />
                        </View>
                      )}
                    </View>

                    {/* Name + contribution pills */}
                    <View style={styles.mInfo}>
                      <View style={styles.mNameRow}>
                        <Text style={[styles.mName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                          {memberInfo?.name || 'Unknown'}
                        </Text>
                        {count > 1 && (
                          <View style={styles.mCountBadge}>
                            <Text style={styles.mCountText}>{count}×</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.mPills}>
                        {isWeekly
                          ? [1, 2, 3, 4].map(w => {
                              const isPaid = getPaymentStatus(memberId, w);
                              const isCurrent = w === currentWeek;
                              return (
                                <View
                                  key={`wk-${w}`}
                                  style={[styles.mPill, {
                                    backgroundColor: isPaid ? '#10b98118' : '#f43f5e18',
                                    borderColor: isCurrent ? '#D4AF37' : (isPaid ? '#10b98144' : '#f43f5e44'),
                                    borderWidth: isCurrent ? 1.5 : 1,
                                  }]}
                                >
                                  <View style={[styles.mPillDot, { backgroundColor: isPaid ? '#10b981' : '#f43f5e' }]} />
                                  <Text style={[styles.mPillText, { color: isPaid ? '#10b981' : '#f43f5e' }]}>
                                    {isPaid ? `W${w} ✓` : `W${w}`}
                                  </Text>
                                </View>
                              );
                            })
                          : monthlyContribs.map((c, idx) => {
                              const isPaid = c.status === 'paid';
                              return (
                                <View
                                  key={c.id || idx}
                                  style={[styles.mPill, {
                                    backgroundColor: isPaid ? '#10b98118' : '#f43f5e18',
                                    borderColor: isPaid ? '#10b98144' : '#f43f5e44',
                                  }]}
                                >
                                  <View style={[styles.mPillDot, { backgroundColor: isPaid ? '#10b981' : '#f43f5e' }]} />
                                  <Text style={[styles.mPillText, { color: isPaid ? '#10b981' : '#f43f5e' }]}>
                                    {isPaid ? `✓` : `#${c.paymentNumber || idx + 1}`}
                                  </Text>
                                </View>
                              );
                            })}
                      </View>
                    </View>

                    {/* Action */}
                    {receivePaymentNum !== null ? (
                      <Button
                        mode="contained"
                        compact
                        buttonColor="#064E3B"
                        textColor="#D4AF37"
                        onPress={() => handlePayment(memberId, receivePaymentNum)}
                        style={styles.mPayBtn}
                        labelStyle={styles.mPayLabel}
                      >
                        Receive
                      </Button>
                    ) : (
                      // Fully settled for this view. The receipt already went out automatically
                      // over Evolution when the payment was recorded, so no manual send here —
                      // just a settled marker.
                      <View style={styles.mPaidChip}>
                        <Icon name="check-decagram" size={14} color="#10b981" />
                        <Text style={styles.mPaidChipText}>{isWeekly ? 'SETTLED' : 'PAID'}</Text>
                      </View>
                    )}
                  </View>
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
        {committee.payouts?.length > 0 && (
  <View style={{ marginTop: 40 }}>
    <View style={styles.sectionHead}>
      <Title style={[styles.secTitle, { color: theme.colors.onSurface }]}>{`السجل (Payout Ledger)`}</Title>
      <Icon name="book-open-variant" size={20} color="#D4AF37" />
    </View>
    {
      Object.values(
        committee.payouts.reduce((acc, p) => {
          const member = members.find(m => m.id === p.memberId);
          if (!acc[p.memberId]) acc[p.memberId] = { member, payouts: [] };
          acc[p.memberId].payouts.push(p);
          return acc;
        }, {})
      ).sort((a,b)=> (a.member?.name||'').localeCompare(b.member?.name||'')).map(({ member, payouts }) => {
        const total = payouts.reduce((sum, pt) => sum + pt.amount, 0);
        const cycles = payouts.map(pt => pt.cycleNumber).join(', ');
        return (
          <Surface key={member?.id} style={[styles.historyCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyName}>{member?.name}</Text>
              <Text style={styles.historyCycle}>Cycles: {cycles}</Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={styles.historyAmount}>Rs {total.toLocaleString()}</Text>
              <Text style={styles.historyStatus}>✓ DISBURSED</Text>
            </View>
          </Surface>
        );
      })
    }
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

  // --- Premium Member Card Styles ---
  mCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  mCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingLeft: 12,
  },
  mAvatarWrap: {
    position: 'relative',
  },
  mCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  mName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'serif',
    flexShrink: 1,
  },
  mCountBadge: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 8,
  },
  mCountText: {
    color: '#064E3B',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  mPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  mPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mPayBtn: {
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
  },
  mPayLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mWhatsApp: {
    margin: 0,
    backgroundColor: '#25D36612',
    borderRadius: 12,
  },
  mPaidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#10b98114',
    borderWidth: 1,
    borderColor: '#10b98133',
  },
  mPaidChipText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    color: '#10b981',
  },

  // --- Payout, History, Notes, Celebration ---
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
