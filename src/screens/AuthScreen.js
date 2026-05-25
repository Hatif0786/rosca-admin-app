import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, Dimensions } from 'react-native';
import { TextInput, Button, Text, Surface, Title, useTheme } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const theme = useTheme();

  async function handleAuth() {
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { display_name: displayName }
          }
        });
        if (error) throw error;
        alert('Welcome to Rizqly! Please check your email to confirm (if enabled).');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#064E3B', '#022C22']} style={StyleSheet.absoluteFill} />
      
      {/* Decorative Geometric Background Pattern (Abstract) */}
      <View style={styles.patternOverlay}>
        <Text style={styles.patternText}>✨ رزقلي ✨</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          
          <View style={styles.logoContainer}>
            <Icon name="rhombus-split" size={100} color="#D4AF37" style={{ marginBottom: 10 }} />
            <Text style={styles.welcomeArabic}>أهلاً وسهلاً</Text>
            <Title style={styles.brandName}>RIZQLY</Title>
            <Text style={styles.tagline}>Islamic Savings Management</Text>
          </View>

          <Surface style={styles.glassCard} elevation={0}>
            <Title style={styles.cardTitle}>{isSignUp ? 'Create Admin Account' : 'Welcome Back'}</Title>
            
            {isSignUp && (
              <TextInput
                label="Full Name"
                value={displayName}
                onChangeText={setDisplayName}
                mode="flat"
                activeUnderlineColor="#D4AF37"
                textColor="#fff"
                style={styles.input}
                theme={{ colors: { onSurfaceVariant: 'rgba(255,255,255,0.6)' } }}
              />
            )}

            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              mode="flat"
              activeUnderlineColor="#D4AF37"
              autoCapitalize="none"
              keyboardType="email-address"
              textColor="#fff"
              style={styles.input}
              theme={{ colors: { onSurfaceVariant: 'rgba(255,255,255,0.6)' } }}
            />
            
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="flat"
              activeUnderlineColor="#D4AF37"
              secureTextEntry
              textColor="#fff"
              style={styles.input}
              theme={{ colors: { onSurfaceVariant: 'rgba(255,255,255,0.6)' } }}
            />

            <Button 
              mode="contained" 
              onPress={handleAuth} 
              loading={loading} 
              disabled={loading}
              style={styles.mainButton}
              buttonColor="#D4AF37"
              textColor="#064E3B"
              contentStyle={{ height: 55 }}
            >
              {isSignUp ? 'REGISTER' : 'LOG IN'}
            </Button>

            <Button 
              onPress={() => setIsSignUp(!isSignUp)} 
              style={styles.switchButton}
              textColor="#D4AF37"
            >
              {isSignUp ? 'ALREADY REGISTERED? LOGIN' : "NEW TO RIZQLY? SIGN UP"}
            </Button>
          </Surface>

          <Text style={styles.footerText}>Secure • Private • Ethical</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#064E3B' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },
  patternOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.05
  },
  patternText: { fontSize: 80, fontWeight: 'bold', color: '#fff' },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  brandName: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold', letterSpacing: 8, fontFamily: 'serif', marginTop: 10, textAlign: 'center' },
  tagline: { color: 'rgba(212, 175, 55, 0.6)', fontSize: 11, letterSpacing: 3, fontFamily: 'serif', marginTop: 8, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' },
  welcomeArabic: { color: '#D4AF37', fontSize: 36, fontFamily: 'serif', fontWeight: 'bold', textAlign: 'center', lineHeight: 46 },
  glassCard: { 
    padding: 24, 
    borderRadius: 30, 
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden'
  },
  cardTitle: { color: '#fff', marginBottom: 24, textAlign: 'center', fontWeight: 'bold', fontSize: 22 },
  input: { backgroundColor: 'transparent', marginBottom: 16, fontSize: 16 },
  mainButton: { marginTop: 16, borderRadius: 15, elevation: 8 },
  switchButton: { marginTop: 12 },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: 30, fontSize: 12, letterSpacing: 2 }
});
