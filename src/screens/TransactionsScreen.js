import React from 'react';
import { View, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { Title, Text, Surface, useTheme, List, Divider } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

export default function TransactionsScreen() {
  const committees = useStore((state) => state.committees);
  const members = useStore((state) => state.members);
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Build a global list of all "Paid" contributions and "Payouts"
  let allTransactions = [];
  let memberStats = {}; // { memberId: { paid: 0, received: 0, name: '' } }

  committees.forEach(c => {
    // Contributions
    c.contributions.filter(con => con.status === 'paid').forEach((con, idx) => {
      const m = members.find(m => m.id === con.memberId);
      if (m) {
        if (!memberStats[m.id]) memberStats[m.id] = { paid: 0, received: 0, name: m.name };
        memberStats[m.id].paid += (c.frequency === 'Weekly' ? c.weeklyContribution : c.contributionAmount);
      }
      
      allTransactions.push({
        id: `con-${con.id || idx}-${c.id}`,
        type: 'Contribution',
        amount: c.frequency === 'Weekly' ? c.weeklyContribution : c.contributionAmount,
        date: con.updated_at || c.startDate,
        memberName: m?.name || 'Unknown',
        committeeName: c.name,
        label: c.frequency === 'Weekly' ? `Week ${con.paymentNumber}` : 'Monthly',
      });
    });

    // Payouts
    c.payouts.forEach((p, idx) => {
      const m = members.find(m => m.id === p.memberId);
      if (m) {
        if (!memberStats[m.id]) memberStats[m.id] = { paid: 0, received: 0, name: m.name };
        memberStats[m.id].received += p.amount;
      }

      allTransactions.push({
        id: `pay-${p.id || idx}-${c.id}`,
        type: 'Payout',
        amount: p.amount,
        date: p.created_at || c.startDate,
        memberName: m?.name || 'Unknown',
        committeeName: c.name,
        label: 'Disbursement',
      });
    });
  });

  // Sort by date (newest first)
  allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalCollected = allTransactions.filter(t => t.type === 'Contribution').reduce((acc, t) => acc + t.amount, 0);
  const totalDisbursed = allTransactions.filter(t => t.type === 'Payout').reduce((acc, t) => acc + t.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: '#064E3B' }]}>
        <Title style={{ color: '#D4AF37', fontSize: 24, fontWeight: 'bold', fontFamily: 'serif' }}>Master Ledger</Title>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Global Transaction Audit Trail</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Collections</Text>
            <Text style={styles.statValue}>Rs {totalCollected.toLocaleString()}</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(212, 175, 55, 0.3)' }]}>
            <Text style={styles.statLabel}>Payouts</Text>
            <Text style={styles.statValue}>Rs {totalDisbursed.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Member-wise Summary Section */}
        {Object.keys(memberStats).length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Title style={{ fontSize: 16, color: theme.colors.onBackground, marginBottom: 12, fontFamily: 'serif' }}>Member Balances</Title>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.values(memberStats).map((stat, idx) => (
                <Surface key={`stat-${idx}`} style={[styles.memberSummaryCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                  <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{stat.name}</Text>
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: '#4caf50' }}>In: Rs {stat.paid.toLocaleString()}</Text>
                    <Text style={{ fontSize: 11, color: '#D4AF37' }}>Out: Rs {stat.received.toLocaleString()}</Text>
                  </View>
                </Surface>
              ))}
            </ScrollView>
          </View>
        )}

        <Title style={{ fontSize: 16, color: theme.colors.onBackground, marginBottom: 12, fontFamily: 'serif' }}>Recent Activity</Title>
        {allTransactions.length === 0 ? (
          <Surface style={styles.emptyCard} elevation={1}>
            <Text style={{ color: isDark ? '#aaa' : '#666' }}>No transactions recorded yet.</Text>
          </Surface>
        ) : (
          allTransactions.map((t, idx) => (
            <Surface key={t.id} style={[styles.transactionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={styles.cardLeft}>
                <View style={[styles.typeBadge, { backgroundColor: t.type === 'Payout' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(76, 175, 80, 0.1)' }]}>
                  <Text style={[styles.typeText, { color: t.type === 'Payout' ? '#D4AF37' : '#4caf50' }]}>{t.type === 'Payout' ? '📤' : '📥'}</Text>
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.memberName}>{t.memberName}</Text>
                  <Text style={styles.subText}>{t.committeeName} • {t.label}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.amountText, { color: t.type === 'Payout' ? '#D4AF37' : '#4caf50' }]}>
                  {t.type === 'Payout' ? '-' : '+'} Rs {t.amount.toLocaleString()}
                </Text>
                <Text style={styles.dateText}>
                  {(() => {
                    try {
                      return t.date ? format(new Date(t.date), 'MMM d, yyyy') : 'Processing';
                    } catch (e) {
                      return 'Recent';
                    }
                  })()}
                </Text>
              </View>
            </Surface>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  statsRow: { flexDirection: 'row', marginTop: 24, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 16 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  memberSummaryCard: { padding: 16, borderRadius: 12, marginRight: 12, width: 150 },
  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 15, marginBottom: 12 },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  typeBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  typeText: { fontSize: 18 },
  memberName: { fontWeight: 'bold', fontSize: 15 },
  subText: { fontSize: 12, opacity: 0.6 },
  amountText: { fontWeight: 'bold', fontSize: 16 },
  dateText: { fontSize: 10, opacity: 0.5, marginTop: 2 },
  emptyCard: { padding: 30, borderRadius: 15, alignItems: 'center' },
});
