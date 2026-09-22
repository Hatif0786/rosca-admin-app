import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { Text, Title, Surface, Button, ActivityIndicator, useTheme, TextInput } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import {
  fetchWhatsAppSession,
  connectWhatsAppSession,
  checkWhatsAppStatus,
  getWhatsAppPairingCode,
  disconnectWhatsAppSession,
  sendWhatsAppMessage,
} from '../lib/whatsapp';

export default function WhatsAppSettingsScreen({ navigation }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [connectMethod, setConnectMethod] = useState(null); // 'pairing' | 'qr' | null
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [generatingPairing, setGeneratingPairing] = useState(false);
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

  const handleConnectQR = async () => {
    setConnectMethod('qr');
    setConnecting(true);
    const data = await connectWhatsAppSession();
    setSession(data);
    setConnecting(false);
    if (data?.error) {
      Alert.alert('Connection Error', data.error);
    }
  };

  const handleGeneratePairingCode = async () => {
    if (!pairingPhone.trim()) {
      Alert.alert('Phone Required', 'Please enter your WhatsApp phone number with country code (e.g. 919876543210)');
      return;
    }
    setGeneratingPairing(true);
    const result = await getWhatsAppPairingCode(pairingPhone);
    setGeneratingPairing(false);

    if (result.success && result.pairingCode) {
      setPairingCode(result.pairingCode);
      // Fetch session to set status to connecting
      const data = await fetchWhatsAppSession();
      setSession(data);
    } else {
      Alert.alert('Pairing Code Error', result.error || 'Failed to generate pairing code');
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    const data = await checkWhatsAppStatus();
    setSession(data);
    setCheckingStatus(false);
    if (data?.error) {
      Alert.alert('Status Check Error', data.error);
    }
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
            setPairingCode(null);
            setConnectMethod(null);
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
              name={status === 'connected' ? 'whatsapp' : 'cellphone-link'}
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
              <Button mode="outlined" onPress={handleCheckStatus} loading={checkingStatus} style={{ flex: 1 }}>
                Refresh Status
              </Button>
              <Button mode="outlined" onPress={handleDisconnect} textColor="#EF4444" style={{ flex: 1 }}>
                Disconnect
              </Button>
            </View>
          </View>
        )}

        {/* CONNECTING / PAIRING CODE OR QR STATE */}
        {status === 'connecting' && (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            {connectMethod === 'pairing' && pairingCode ? (
              <View style={{ width: '100%', alignItems: 'center', marginVertical: 12 }}>
                <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>Your Pairing Code:</Text>
                <View style={styles.pairingCodeBox}>
                  <Text style={styles.pairingCodeText}>{pairingCode}</Text>
                </View>
                <View style={styles.instructionsBox}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 6, color: '#064E3B' }}>
                    How to link with code:
                  </Text>
                  <Text style={styles.instructionStep}>1. Open WhatsApp on your phone</Text>
                  <Text style={styles.instructionStep}>2. Tap Settings → Linked Devices → Link a Device</Text>
                  <Text style={styles.instructionStep}>3. Select "Link with phone number instead"</Text>
                  <Text style={styles.instructionStep}>4. Enter the code shown above: {pairingCode}</Text>
                </View>
              </View>
            ) : connectMethod === 'qr' && qrCode ? (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={styles.qrContainer}>
                  <Image source={{ uri: qrCode }} style={{ width: 220, height: 220 }} />
                </View>
                <View style={styles.instructionsBox}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 6, color: '#064E3B' }}>
                    How to connect via QR:
                  </Text>
                  <Text style={styles.instructionStep}>1. Open WhatsApp on your phone</Text>
                  <Text style={styles.instructionStep}>2. Tap Menu (3 dots) or Settings → Linked Devices</Text>
                  <Text style={styles.instructionStep}>3. Tap "Link a Device"</Text>
                  <Text style={styles.instructionStep}>4. Point your camera at this QR code</Text>
                </View>
              </View>
            ) : (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="medium" color={theme.colors.primary} />
                <Text style={{ marginTop: 12, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
                  Waiting for WhatsApp connection...
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
              <Button mode="contained" onPress={handleCheckStatus} loading={checkingStatus} disabled={checkingStatus} style={{ flex: 1 }} buttonColor={theme.colors.primary}>
                Check Status
              </Button>
              <Button mode="outlined" onPress={handleDisconnect} textColor="#EF4444" style={{ flex: 1 }}>
                Cancel
              </Button>
            </View>
          </View>
        )}

        {/* DISCONNECTED STATE — SELECTION METHOD */}
        {status === 'disconnected' && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
              Link your WhatsApp account to enable direct receipts, payment due reminders, and payout alerts to your committee members.
            </Text>

            {connectMethod === null && (
              <View>
                <Title style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>How do you want to connect?</Title>

                <TouchableOpacity
                  style={[styles.methodCard, { borderColor: theme.colors.outline }]}
                  onPress={() => setConnectMethod('pairing')}
                >
                  <Icon name="cellphone-key" size={28} color={theme.colors.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: theme.colors.onSurface }}>Pair with phone number</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>Best if Rizqly & WhatsApp are on the same phone</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodCard, { borderColor: theme.colors.outline, marginTop: 10 }]}
                  onPress={handleConnectQR}
                >
                  <Icon name="qrcode-scan" size={28} color={theme.colors.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: theme.colors.onSurface }}>Scan QR Code</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>Best if you can scan from another device</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            )}

            {connectMethod === 'pairing' && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginBottom: 10 }}>
                  Enter your WhatsApp phone number including country code (no + or spaces):
                </Text>
                <TextInput
                  label="WhatsApp Phone Number"
                  value={pairingPhone}
                  onChangeText={setPairingPhone}
                  keyboardType="phone-pad"
                  mode="outlined"
                  placeholder="e.g. 919876543210"
                  style={{ marginBottom: 14 }}
                />
                <Button
                  mode="contained"
                  onPress={handleGeneratePairingCode}
                  loading={generatingPairing}
                  disabled={generatingPairing}
                  buttonColor={theme.colors.primary}
                  contentStyle={{ paddingVertical: 6 }}
                  icon="numeric"
                  style={{ marginBottom: 10 }}
                >
                  Generate Pairing Code
                </Button>
                <Button mode="text" onPress={() => setConnectMethod(null)}>
                  Choose Another Method
                </Button>
              </View>
            )}

            {connectMethod === 'qr' && connecting && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="medium" color={theme.colors.primary} />
                <Text style={{ marginTop: 12, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
                  Generating QR Code...
                </Text>
              </View>
            )}
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
  methodCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.02)' },
  pairingCodeBox: { backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginBottom: 14 },
  pairingCodeText: { color: '#FFF', fontSize: 26, fontWeight: 'bold', letterSpacing: 6 },
});
