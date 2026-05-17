import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { addMonths } from 'date-fns';

export const useStore = create((set, get) => ({
  committees: [],
  members: [],
  themePreference: 'system', // 'light' | 'dark' | 'system'
  
  setThemePreference: (pref) => set({ themePreference: pref }),
  loading: false,

  // --- Fetch everything from Supabase ---
  fetchData: async () => {
    set({ loading: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [membersRes, committeesRes, contributionsRes, payoutsRes] = await Promise.all([
      supabase.from('members').select('*').order('name'),
      supabase.from('committees').select('*').order('created_at', { ascending: false }),
      supabase.from('contributions').select('*'),
      supabase.from('payouts').select('*'),
    ]);

    const processedCommittees = (committeesRes.data || []).map(c => ({
      ...c,
      members: c.members_order || [],
      contributions: (contributionsRes.data || []).filter(con => con.committee_id === c.id).map(con => ({
        memberId: con.member_id,
        cycleNumber: con.cycle_number,
        paymentNumber: con.payment_number,
        status: con.status,
        updated_at: con.updated_at || con.created_at
      })),
      payouts: (payoutsRes.data || []).filter(p => p.committee_id === c.id).map(p => ({
        memberId: p.member_id,
        amount: parseFloat(p.amount),
        cycleNumber: p.cycle_number,
        date: p.date
      })),
      schedule: generateSchedule(c.start_date, c.cycles),
      totalAmount: parseFloat(c.total_amount),
      contributionAmount: parseFloat(c.contribution_amount),
      weeklyContribution: parseFloat(c.weekly_contribution || 0),
      payoutsPerCycle: c.payouts_per_cycle || 1,
      paymentsPerCycle: c.payments_per_cycle || 1,
    }));

    set({ 
      members: membersRes.data || [], 
      committees: processedCommittees,
      loading: false 
    });
  },

  // --- Members ---
  addMember: async (name, phone) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('members').insert([
      { name, phone, admin_id: user.id }
    ]).select();

    if (error) throw error;
    set((state) => ({ members: [...state.members, data[0]] }));
  },

  deleteMember: async (id) => {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) throw error;
    set((state) => ({ members: state.members.filter(m => m.id !== id) }));
  },

  // --- Committees ---
  addCommittee: async (committeeData, onboarding) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { 
      name, frequency, payoutMethod, totalAmount, contributionAmount, 
      weeklyContribution, cycles, payoutsPerCycle, paymentsPerCycle, 
      startDate, members: memberIds 
    } = committeeData;

    const { data: committee, error } = await supabase.from('committees').insert([{
      name,
      frequency,
      payout_method: payoutMethod,
      total_amount: totalAmount,
      contribution_amount: contributionAmount,
      weekly_contribution: weeklyContribution,
      cycles,
      payouts_per_cycle: payoutsPerCycle,
      payments_per_cycle: paymentsPerCycle,
      start_date: (onboarding && onboarding.startCycle > 1)
        ? addMonths(new Date(startDate), -(Number(onboarding.startCycle) - 1)).toISOString()
        : startDate,
      members_order: memberIds,
      admin_id: user.id
    }]).select().single();

    if (error) throw error;

    const committeeId = committee.id;
    
    // Generate Contributions
    const contributions = [];
    for (let cycle = 1; cycle <= cycles; cycle++) {
      for (let paymentNum = 1; paymentNum <= paymentsPerCycle; paymentNum++) {
        for (const memberId of memberIds) {
          const isPast = onboarding && cycle < onboarding.startCycle;
          contributions.push({
            committee_id: committeeId,
            member_id: memberId,
            cycle_number: cycle,
            payment_number: paymentNum,
            status: isPast ? 'paid' : 'pending'
          });
        }
      }
    }
    
    const { error: cError } = await supabase.from('contributions').insert(contributions);
    if (cError) throw cError;

    // Generate Initial Payout Records (Existing Committee Migration)
    if (onboarding && onboarding.alreadyPaidMemberIds?.length > 0) {
      const payouts = [];
      const { alreadyPaidMemberIds, startCycle } = onboarding;
      
      alreadyPaidMemberIds.forEach((memberId, index) => {
        // Distribute these members into historical cycles
        const cycleNum = Math.floor(index / payoutsPerCycle) + 1;
        // Only record if the cycle is actually a past cycle (or current if specified)
        if (cycleNum < startCycle || (cycleNum === startCycle && alreadyPaidMemberIds.length > 0)) {
           payouts.push({
            committee_id: committeeId,
            member_id: memberId,
            amount: totalAmount,
            cycle_number: cycleNum
          });
        }
      });
      
      if (payouts.length > 0) {
        const { error: pError } = await supabase.from('payouts').insert(payouts);
        if (pError) throw pError;
      }
    }

    await get().fetchData();
    return committee;
  },

  deleteCommittee: async (id) => {
    const { error } = await supabase.from('committees').delete().eq('id', id);
    if (error) throw error;
    set((state) => ({ committees: state.committees.filter(c => c.id !== id) }));
  },

  // --- Payments & Payouts ---
  markContributionPaid: async (committeeId, memberId, cycleNumber, paymentNumber) => {
    const { error } = await supabase.from('contributions')
      .upsert({ 
        committee_id: committeeId, 
        member_id: memberId, 
        cycle_number: cycleNumber, 
        payment_number: paymentNumber,
        status: 'paid'
      }, { onConflict: 'committee_id,member_id,cycle_number,payment_number' });

    if (error) throw error;
    
    // Optimistic update
    set((state) => ({
      committees: state.committees.map(c => {
        if (c.id === committeeId) {
          const existing = (c.contributions || []).find(con => 
            con.memberId === memberId && con.cycleNumber === cycleNumber && con.paymentNumber === paymentNumber
          );
          
          let updatedContributions;
          if (existing) {
            updatedContributions = c.contributions.map(con => 
              (con.memberId === memberId && con.cycleNumber === cycleNumber && con.paymentNumber === paymentNumber)
                ? { ...con, status: 'paid', updated_at: new Date().toISOString() }
                : con
            );
          } else {
            updatedContributions = [...(c.contributions || []), {
              memberId, cycleNumber, paymentNumber, status: 'paid', updated_at: new Date().toISOString()
            }];
          }
          return { ...c, contributions: updatedContributions };
        }
        return c;
      })
    }));
  },

  recordPayout: async (committeeId, memberId, amount, cycleNumber) => {
    const { error } = await supabase.from('payouts').insert([{
      committee_id: committeeId,
      member_id: memberId,
      amount,
      cycle_number: cycleNumber
    }]);

    if (error) throw error;

    // Optimistic update (matches UI camelCase)
    set((state) => ({
      committees: state.committees.map(c => {
        if (c.id === committeeId) {
          return {
            ...c,
            payouts: [...(c.payouts || []), { 
              memberId, 
              amount, 
              cycleNumber, 
              date: new Date().toISOString() 
            }]
          };
        }
        return c;
      })
    }));
  },

  importState: (data) => {
    if (!data || !data.committees || !data.members) return;
    
    const processedCommittees = data.committees.map(c => ({
      ...c,
      schedule: generateSchedule(c.start_date || c.startDate, c.cycles),
      totalAmount: parseFloat(c.total_amount || c.totalAmount),
      contributionAmount: parseFloat(c.contribution_amount || c.contributionAmount),
      weeklyContribution: parseFloat(c.weekly_contribution || c.weeklyContribution || 0),
      payoutsPerCycle: c.payouts_per_cycle || c.payoutsPerCycle || 1,
      paymentsPerCycle: c.payments_per_cycle || c.paymentsPerCycle || 1,
    }));

    set({ committees: processedCommittees, members: data.members });
  },
}));

// Helper to generate schedule (kept consistent with original logic)
function generateSchedule(startDate, cycles) {
  const schedule = [];
  let current = new Date(startDate);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  for (let i = 1; i <= cycles; i++) {
    schedule.push({
      cycleNumber: i,
      label: `${months[current.getMonth()]} ${current.getFullYear()}`,
      dueDate: current.toISOString(),
    });
    current.setMonth(current.getMonth() + 1);
  }
  return schedule;
}
