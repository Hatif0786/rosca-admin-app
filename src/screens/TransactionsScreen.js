import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme, Animated } from 'react-native';
import { Title, Text, Surface, useTheme, Avatar, Portal, Dialog, Button, IconButton } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function TransactionsScreen() {
  const committees = useStore((state) => state.committees);
  const members = useStore((state) => state.members);
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  const [downloadDialogVisible, setDownloadDialogVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Build a global list of all "Paid" contributions and "Payouts"
  let allTransactions = [];
  let memberStats = {}; // { memberId: { paid: 0, received: 0, name: '' } }

  committees.forEach(c => {
    // Contributions
    c.contributions.filter(con => con.status === 'paid').forEach((con, idx) => {
      const m = members.find(m => String(m.id) === String(con.memberId));
      const amount = (c.frequency === 'Weekly' ? c.weeklyContribution : c.contributionAmount);
      if (m) {
        if (!memberStats[m.id]) memberStats[m.id] = { paid: 0, received: 0, name: m.name };
        memberStats[m.id].paid += amount;
      }
      
      allTransactions.push({
        id: `con-${con.id || idx}-${c.id}`,
        type: 'Contribution',
        amount: amount,
        date: con.updated_at || c.start_date || c.startDate,
        memberName: m?.name || 'Unknown',
        committeeName: c.name,
        label: c.frequency === 'Weekly' ? `Week ${con.paymentNumber}` : 'Monthly',
      });
    });

    // Payouts
    c.payouts.forEach((p, idx) => {
      const m = members.find(m => String(m.id) === String(p.memberId));
      if (m) {
        if (!memberStats[m.id]) memberStats[m.id] = { paid: 0, received: 0, name: m.name };
        memberStats[m.id].received += p.amount;
      }

      allTransactions.push({
        id: `pay-${p.id || idx}-${c.id}`,
        type: 'Payout',
        amount: p.amount,
        date: p.date || p.created_at || c.start_date || c.startDate,
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

  const handleExportStatement = async (filterType) => {
    setIsGenerating(true);
    setDownloadDialogVisible(false);
    
    let filteredList = [...allTransactions];
    let filterLabel = "All Time";
    const now = new Date();
    
    if (filterType === 'last_10') {
      filteredList = filteredList.slice(0, 10);
      filterLabel = "Last 10 Transactions";
    } else if (filterType === '1_week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredList = filteredList.filter(t => new Date(t.date) >= oneWeekAgo);
      filterLabel = "Last 1 Week";
    } else if (filterType === '1_month') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredList = filteredList.filter(t => new Date(t.date) >= oneMonthAgo);
      filterLabel = "Last 1 Month";
    } else if (filterType === '1_year') {
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      filteredList = filteredList.filter(t => new Date(t.date) >= oneYearAgo);
      filterLabel = "Last 1 Year";
    }
    
    const totalColl = filteredList.filter(t => t.type === 'Contribution').reduce((acc, t) => acc + t.amount, 0);
    const totalDisb = filteredList.filter(t => t.type === 'Payout').reduce((acc, t) => acc + t.amount, 0);
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>RIZQLY Statement</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; padding: 30px; background-color: #f8fafc; }
        .receipt-card { max-width: 850px; margin: auto; background-color: #ffffff; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #064E3B 0%, #022C22 100%); color: #fff; padding: 40px; border-radius: 20px; margin-bottom: 35px; position: relative; border-bottom: 5px solid #D4AF37; }
        .header h1 { margin: 0; font-size: 28px; letter-spacing: 1.5px; color: #D4AF37; font-family: Georgia, serif; font-weight: 700; text-transform: uppercase; }
        .header p { margin: 8px 0 0 0; font-size: 13px; color: #a7f3d0; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 600; }
        .badge { position: absolute; top: 40px; right: 40px; background: rgba(212, 175, 55, 0.15); border: 1px solid #D4AF37; padding: 8px 18px; border-radius: 30px; font-size: 11px; color: #D4AF37; letter-spacing: 1.5px; font-weight: bold; text-transform: uppercase; }
        .summary { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 40px; }
        .sum-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 22px 18px; text-align: center; }
        .sum-label { font-size: 10px; color: #64748b; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }
        .sum-val { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 8px; font-family: Georgia, serif; }
        .val-in { color: #059669; }
        .val-out { color: #D4AF37; }
        .section-title { font-size: 18px; font-family: Georgia, serif; font-weight: 700; color: #0f172a; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background-color: #f1f5f9; color: #475569; text-align: left; padding: 14px 18px; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
        td { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #334155; }
        tr:hover { background-color: #f8fafc; }
        .bold-text { font-weight: bold; color: #0f172a; }
        .type-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 10.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .type-in { background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .type-out { background-color: #fefbeb; color: #b45309; border: 1px solid #fde68a; }
        .footer { text-align: center; margin-top: 70px; padding-top: 30px; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #94a3b8; letter-spacing: 2px; font-weight: bold; }
        .dev-tag { color: #D4AF37; }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <div class="header">
          <h1>RIZQLY FINANCIAL PLATFORM</h1>
          <p>Official Global Ledger Account Statement</p>
          <div class="badge">${filterLabel.toUpperCase()}</div>
          <p style="margin-top: 20px; font-size: 10.5px; color: #a7f3d0; opacity: 0.8; font-weight: 400; letter-spacing: 0.8px;">RUN DATE: ${now.toLocaleString()}</p>
        </div>
        
        <div class="summary">
          <div class="sum-box">
            <div class="sum-label">SCOPE TRANSACTIONS</div>
            <div class="sum-val">${filteredList.length}</div>
          </div>
          <div class="sum-box">
            <div class="sum-label">TOTAL COLLECTED</div>
            <div class="sum-val val-in">Rs ${totalColl.toLocaleString()}</div>
          </div>
          <div class="sum-box">
            <div class="sum-label">TOTAL DISBURSED</div>
            <div class="sum-val val-out">Rs ${totalDisb.toLocaleString()}</div>
          </div>
        </div>
        
        <div class="section-title">Itemized Audit Ledger</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Member</th>
              <th>Description</th>
              <th>Type</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredList.map(t => {
              const tDate = t.date ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
              return `
                <tr>
                  <td class="bold-text">${tDate}</td>
                  <td>${t.memberName}</td>
                  <td>${t.committeeName} &bull; ${t.label}</td>
                  <td>
                    <span class="type-badge ${t.type === 'Payout' ? 'type-out' : 'type-in'}">
                      ${t.type === 'Payout' ? 'Payout' : 'Contribution'}
                    </span>
                  </td>
                  <td style="text-align: right; font-weight: bold; color: ${t.type === 'Payout' ? '#b45309' : '#047857'}">
                    ${t.type === 'Payout' ? '-' : '+'} Rs ${t.amount.toLocaleString()}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          © 2026 RIZQLY • <span class="dev-tag">DEVELOPED BY HATIF</span> • ALL RIGHTS RESERVED
        </div>
      </div>
    </body>
    </html>
    `;
    
    try {
      // 1. Convert the styled HTML corporate statement into a high-quality native PDF file
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // 2. Share the native PDF document directly!
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Rizqly PDF Statement' });
      }
    } catch (e) {
      console.log("Error generating ledger statement:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#064E3B', '#022C22']} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Icon name="rhombus-split" size={32} color="#D4AF37" style={{ marginRight: 12 }} />
            <View>
              <Text style={styles.arabicHeading}>السجل العام</Text>
              <Title style={styles.headerTitle}>Global Ledger</Title>
              <Text style={styles.headerSubtitle}>Master Audit Trail</Text>
            </View>
          </View>
          <IconButton 
            icon="file-document-multiple-outline" 
            iconColor="#D4AF37" 
            size={28} 
            style={{ margin: 0 }}
            onPress={() => setDownloadDialogVisible(true)} 
          />
        </View>
        
        <Surface style={styles.summaryBox} elevation={0}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>TOTAL COLLECTED</Text>
            <Text style={styles.statValue}>Rs {totalCollected.toLocaleString()}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>TOTAL DISBURSED</Text>
            <Text style={[styles.statValue, { color: '#D4AF37' }]}>Rs {totalDisbursed.toLocaleString()}</Text>
          </View>
        </Surface>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Member Balances Section */}
        <View style={styles.section}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Member Participation Balance</Title>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
            {Object.values(memberStats).map((stat, idx) => (
              <Surface key={idx} style={[styles.balanceCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
                <Avatar.Text size={36} label={stat.name.substring(0, 1).toUpperCase()} style={{ backgroundColor: '#064E3B' }} color="#D4AF37" />
                <Text style={[styles.balanceName, { color: theme.colors.onSurface }]} numberOfLines={1}>{stat.name}</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>PAID</Text>
                  <Text style={styles.balanceIn}>Rs {stat.paid.toLocaleString()}</Text>
                </View>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>OUT</Text>
                  <Text style={styles.balanceOut}>Rs {stat.received.toLocaleString()}</Text>
                </View>
              </Surface>
            ))}
          </ScrollView>
        </View>

        {/* Global Audit List */}
        <View style={[styles.section, { marginTop: 10 }]}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Chronological Audit Trail</Title>
          {allTransactions.length === 0 ? (
            <Surface style={styles.emptyCard} elevation={1}>
              <Icon name="history" size={40} color="#D4AF3722" />
              <Text style={{ color: '#888', marginTop: 10 }}>No transactions recorded yet</Text>
            </Surface>
          ) : (
            allTransactions.map((t, idx) => (
              <Surface key={idx} style={[styles.transactionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={styles.cardLeft}>
                  <View style={[styles.typeBadge, { backgroundColor: t.type === 'Payout' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                    <Icon name={t.type === 'Payout' ? 'arrow-up-right' : 'arrow-down-left'} size={18} color={t.type === 'Payout' ? '#D4AF37' : '#10b981'} />
                  </View>
                  <View style={{ marginLeft: 14 }}>
                    <Text style={[styles.transMemberName, { color: theme.colors.onSurface }]}>{t.memberName}</Text>
                    <Text style={styles.transSub}>{t.committeeName} • {t.label}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.transAmount, { color: t.type === 'Payout' ? '#D4AF37' : '#10b981' }]}>
                    {t.type === 'Payout' ? '-' : '+'} Rs {t.amount.toLocaleString()}
                  </Text>
                  <Text style={styles.transDate}>
                    {(() => {
                      try { return t.date ? format(new Date(t.date), 'MMM d, yyyy') : 'Recent'; }
                      catch (e) { return 'Audit pending'; }
                    })()}
                  </Text>
                </View>
              </Surface>
            ))
          )}
        </View>
      </ScrollView>

      <Portal>
        <Dialog 
          visible={downloadDialogVisible} 
          onDismiss={() => setDownloadDialogVisible(null)} 
          style={{ backgroundColor: theme.colors.surface, borderRadius: 28 }}
        >
          <Dialog.Title style={{ color: theme.colors.primary, fontFamily: 'serif', fontSize: 20, fontWeight: 'bold' }}>Export Ledger Statement</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface, fontSize: 14, marginBottom: 15 }}>
              Choose a transactional date scope. Your statement will generate as a highly detailed, printable PDF statement ready to be printed or shared.
            </Text>
            <View style={{ gap: 8 }}>
              <Button mode="outlined" style={{ borderRadius: 14 }} textColor={theme.colors.onSurface} icon="list-status" onPress={() => handleExportStatement('last_10')}>Last 10 Transactions</Button>
              <Button mode="outlined" style={{ borderRadius: 14 }} textColor={theme.colors.onSurface} icon="calendar-today" onPress={() => handleExportStatement('1_week')}>Last 1 Week</Button>
              <Button mode="outlined" style={{ borderRadius: 14 }} textColor={theme.colors.onSurface} icon="calendar-month" onPress={() => handleExportStatement('1_month')}>Last 1 Month</Button>
              <Button mode="outlined" style={{ borderRadius: 14 }} textColor={theme.colors.onSurface} icon="calendar-multiselect" onPress={() => handleExportStatement('1_year')}>Last 1 Year</Button>
              <Button mode="contained" style={{ borderRadius: 14, marginTop: 5 }} buttonColor="#D4AF37" textColor="#064E3B" icon="file-cabinet" onPress={() => handleExportStatement('all')}>All Time Ledger Record</Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDownloadDialogVisible(false)} textColor={theme.colors.primary}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 55, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
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
  summaryBox: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', fontFamily: 'serif', marginBottom: 16 },
  membersScroll: { marginLeft: -5 },
  balanceCard: { width: 140, padding: 16, borderRadius: 24, marginRight: 12, alignItems: 'center' },
  balanceName: { fontWeight: 'bold', fontSize: 14, marginTop: 10, marginBottom: 8 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 2 },
  balanceLabel: { fontSize: 8, color: '#888', fontWeight: 'bold' },
  balanceIn: { fontSize: 10, color: '#10b981', fontWeight: 'bold' },
  balanceOut: { fontSize: 10, color: '#D4AF37', fontWeight: 'bold' },
  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 10 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  typeBadge: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  transMemberName: { fontWeight: 'bold', fontSize: 15 },
  transSub: { fontSize: 11, color: '#888', marginTop: 2 },
  transAmount: { fontWeight: 'bold', fontSize: 15 },
  transDate: { fontSize: 9, color: '#aaa', marginTop: 2 },
  emptyCard: { padding: 40, borderRadius: 24, alignItems: 'center', opacity: 0.5 },
});
