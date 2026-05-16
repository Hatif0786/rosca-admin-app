import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, useColorScheme } from 'react-native';
import { TextInput, Button, useTheme, Surface, Title, Text, IconButton } from 'react-native-paper';
import { useStore } from '../store/useStore';
import { LinearGradient } from 'expo-linear-gradient';

export default function AddMemberScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const addMember = useStore((state) => state.addMember);
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Name is required");
      return;
    }
    setLoading(true);
    try {
      await addMember(name, phone);
      navigation.goBack();
    } catch (e) {
      alert("Error adding member: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <LinearGradient
          colors={['#064E3B', '#022C22']}
          style={styles.header}
          start={{x:0, y:0}} end={{x:1, y:1}}
        >
          <IconButton icon="arrow-left" iconColor="#D4AF37" onPress={() => navigation.goBack()} />
          <Title style={styles.headerTitle}>Member Registration</Title>
          <Text style={styles.headerSubtitle}>Add a trusted member to your Wasla network</Text>
        </LinearGradient>

        <View style={styles.content}>
          <Surface style={[styles.surface, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.iconCircle}>
              <IconButton icon="account-plus-outline" iconColor="#D4AF37" size={32} />
            </View>
            
            <Text style={styles.inputLabel}>Full Legal Name</Text>
            <TextInput
              placeholder="e.g. Abdullah Ahmed"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              outlineColor={isDark ? '#333' : '#eee'}
              activeOutlineColor="#D4AF37"
            />
            
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <TextInput
              placeholder="+91 98XXX XXXXX"
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor={isDark ? '#333' : '#eee'}
              activeOutlineColor="#D4AF37"
            />

            <Button 
              mode="contained" 
              onPress={handleSave} 
              loading={loading}
              disabled={loading}
              style={styles.button}
              buttonColor="#D4AF37"
              textColor="white"
              contentStyle={{ paddingVertical: 10 }}
              labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
            >
              Confirm & Save Member
            </Button>
            
            <Text style={styles.footerHint}>
              This member will be available to join any new or existing committees.
            </Text>
          </Surface>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 50, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTitle: { color: '#D4AF37', fontSize: 26, fontWeight: 'bold', fontFamily: 'serif', marginTop: 10 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  content: { flex: 1, padding: 20, marginTop: -30 },
  surface: {
    padding: 24,
    borderRadius: 32,
    alignItems: 'center',
    elevation: 4,
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  inputLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  input: { marginBottom: 24, width: '100%', backgroundColor: 'transparent' },
  button: { marginTop: 8, borderRadius: 16, width: '100%' },
  footerHint: { color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
