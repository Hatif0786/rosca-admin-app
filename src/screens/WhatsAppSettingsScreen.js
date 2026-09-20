import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { Text, Title, Surface, Button, ActivityIndicator, useTheme, TextInput } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import {
  fetchWhatsAppSession,
  connectWhatsAppSession,
  disconnectWhatsAppSession,
  sendWhatsAppMessage,
} from '../lib/whatsapp';

export default function WhatsAppSettingsScreen({ navigation }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    setLoading(true);
    const data = await fetchWhatsAppSession();
    setSession(data);
    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    const data = await connectWhatsAppSession();
    setSession(data);
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect WhatsApp',
      'Are you sure you want to disconnect your WhatsApp instance?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await disconnectWhatsAppSession();
            await loadSession();
          },
        },
      ]
    );
  };

  const handleSendTest = async () => {
    if (!testPhone) {
      Alert.alert('Error', 'Please enter a phone number to test');
      return;
    }
    setSendingTest(true);
    const result = await sendWhatsAppMessage(
      testPhone,
      '✨ *Rizqly WhatsApp Integration Test*\n\nYour WhatsApp instance is successfully connected and working!'
    );
    setSendingTest(false);
    if (result.success) {
      Alert.alert('Success', 'Test message sent successfully!');
    } else {
      Alert.alert('Failed', result.error || result.reason || 'Failed to send test message');
    }
  };

  const status = session?.connection_status || 'disconnected';
  const qrCode = session?.qr_code;
  const phoneNumber = session?.phone_number;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.onSurface }}>Loading WhatsApp Session...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ padding: 20 }}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: status === 'connected' ? '#DCFCE7' : '#FEF3C7' }]}>
            <Icon
              name={status === 'connected' ? 'whatsapp' : 'qrcode-scan'}
              size={32}
              color={status === 'connected' ? '#166534' : '#92400E'}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Title style={[styles.title, { color: theme.colors.onSurface }]}>WhatsApp Integration</Title>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
              Multi-tenant WhatsApp messaging per admin
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* STATUS BADGE */}
        <View style={styles.statusBox}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.onSurfaceVariant }}>STATUS:</Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  status === 'connected'
                    ? '#10B981'
                    : status === 'connecting'
                    ? '#F59E0B'
                    : '#EF4444',
              },
            ]}
          >
            <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
          </View>
        </View>

        {/* CONNECTED STATE */}
        {status === 'connected' && (
          <View style={{ marginTop: 16 }}>
            {phoneNumber && (
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 12 }}>
                Connected Number: +{phoneNumber}
              </Text>
            )}
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginBottom: 20 }}>
              Your WhatsApp session is active and ready to send automated cycle receipts, payout alerts, and reminders.
            </Text>

            <Title style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>Send Test Message</Title>
            <TextInput
              label="Recipient Phone Number"
              value={testPhone}
              onChangeText={setTestPhone}
              keyboardType="phone-pad"
              mode="outlined"
              placeholder="e.g. 919876543210"
              style={{ marginBottom: 12 }}
            />
            <Button
              mode="contained"
              onPress={handleSendTest}
              loading={sendingTest}
              disabled={sendingTest}
              buttonColor={theme.colors.primary}
              style={{ marginBottom: 16 }}
            >
              Send Test Message
            </Button>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button mode="outlined" onPress={handleConnect} style={{ flex: 1 }}>
                Refresh Status
              </Button>
              <Button mode="outlined" onPress={handleDisconnect} textColor="#EF4444" style={{ flex: 1 }}>
                Disconnect
              </Button>
            </View>
          </View>
        )}

        {/* CONNECTING / QR STATE */}
        {status === 'connecting' && (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            {qrCode ? (
              <View style={styles.qrContainer}>
                <Image source={{ uri: qrCode }} style={{ width: 220, height: 220 }} />
              </View>
            ) : (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="medium" color={theme.colors.primary} />
                <Text style={{ marginTop: 12, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
                  Generating QR Code...
                </Text>
              </View>
            )}

            <View style={styles.instructionsBox}>
              <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 6, color: '#064E3B' }}>
                How to connect:
              </Text>
              <Text style={styles.instructionStep}>1. Open WhatsApp on your phone</Text>
              <Text style={styles.instructionStep}>2. Tap Menu (3 dots) or Settings → Linked Devices</Text>
              <Text style={styles.instructionStep}>3. Tap "Link a Device"</Text>
              <Text style={styles.instructionStep}>4. Point your camera at this QR code</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
              <Button mode="contained" onPress={handleConnect} loading={connecting} style={{ flex: 1 }} buttonColor={theme.colors.primary}>
                Check Status
              </Button>
              <Button mode="outlined" onPress={handleDisconnect} textColor="#EF4444" style={{ flex: 1 }}>
                Cancel
              </Button>
            </View>
          </View>
        )}

        {/* DISCONNECTED STATE */}
        {status === 'disconnected' && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14, marginBottom: 20, lineHeight: 20 }}>
              Link your WhatsApp account to enable direct receipts, payment due reminders, and payout alerts to your committee members.
            </Text>
            <Button
              mode="contained"
              onPress={handleConnect}
              loading={connecting}
              disabled={connecting}
              buttonColor={theme.colors.primary}
              icon="qrcode-scan"
              contentStyle={{ paddingVertical: 6 }}
            >
              Connect WhatsApp
            </Button>
          </View>
        )}
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { borderRadius: 24, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', fontFamily: 'serif' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 16 },
  statusBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 },
  qrContainer: { padding: 12, backgroundColor: '#FFF', borderRadius: 16, borderHeight: 1, borderColor: '#DDD', marginVertical: 12 },
  instructionsBox: { backgroundColor: '#F0FDF4', padding: 14, borderRadius: 14, width: '100%', marginTop: 8 },
  instructionStep: { fontSize: 12, color: '#166534', marginVertical: 2 },
});
