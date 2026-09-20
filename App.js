import * as React from 'react';
import { Platform, useColorScheme, View, Animated, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme, ActivityIndicator, Text } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './src/lib/supabase';
import { useStore } from './src/store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import DashboardScreen from './src/screens/DashboardScreen';
import CommitteesScreen from './src/screens/CommitteesScreen';
import CommitteeDetailScreen from './src/screens/CommitteeDetailScreen';
import CreateCommitteeScreen from './src/screens/CreateCommitteeScreen';
import MembersScreen from './src/screens/MembersScreen';
import AddMemberScreen from './src/screens/AddMemberScreen';
import AuthScreen from './src/screens/AuthScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import WhatsAppSettingsScreen from './src/screens/WhatsAppSettingsScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function CommitteeStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={{ 
      headerStyle: { backgroundColor: theme.colors.surface }, 
      headerTintColor: theme.colors.primary,
      headerTitleStyle: { fontFamily: 'serif', fontWeight: 'bold' }
    }}>
      <Stack.Screen 
        name="CommitteesList" 
        component={CommitteesScreen} 
        options={{ 
          headerShown: false
        }} 
      />
      <Stack.Screen name="CommitteeDetail" component={CommitteeDetailScreen} options={{ title: 'Details' }} />
      <Stack.Screen name="CreateCommittee" component={CreateCommitteeScreen} options={{ title: 'New Committee', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

function MemberStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={{ 
      headerStyle: { backgroundColor: theme.colors.surface }, 
      headerTintColor: theme.colors.primary,
      headerTitleStyle: { fontFamily: 'serif', fontWeight: 'bold' }
    }}>
      <Stack.Screen 
        name="MembersList" 
        component={MembersScreen} 
        options={{ 
          headerShown: false
        }} 
      />
      <Stack.Screen name="AddMember" component={AddMemberScreen} options={{ title: 'Add Member', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

const RizqlyLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#064E3B', 
    secondary: '#D4AF37', 
    tertiary: '#022C22',
    surface: '#FFFFFF',
    background: '#FAF9F6', 
    onSurface: '#1A1A1A',
    onBackground: '#1A1A1A',
    outline: '#E5E7EB',
  },
};

const RizqlyDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D4AF37',
    secondary: '#064E3B',
    surface: '#121212',
    background: '#0A0A0A',
    onSurface: '#FDFCF0',
    onBackground: '#FDFCF0',
    outline: '#333333',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: '#1E1E1E',
      level2: '#2C2C2C',
    }
  },
};

const NavLightTheme = {
  ...NavDefaultTheme,
  colors: {
    ...NavDefaultTheme.colors,
    primary: '#064E3B',
    background: '#FAF9F6',
    card: '#FFFFFF',
    text: '#064E3B',
  },
};

const NavDarkThemeCustom = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: '#D4AF37',
    background: '#0A0A0A',
    card: '#121212',
    text: '#FDFCF0',
  },
};

function SplashScreen() {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.5)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const textOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 1000, useNativeDriver: true })
    ]).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.splashContainer}>
      <LinearGradient colors={['#064E3B', '#022C22']} style={StyleSheet.absoluteFill} />
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }, { rotate: spin }], alignItems: 'center' }}>
        <Icon name="rhombus-split" size={120} color="#D4AF37" />
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center', marginTop: 30 }}>
        <Text style={styles.splashArabic}>أهلاً وسهلاً</Text>
        <Text style={styles.splashTitle}>RIZQLY</Text>
        <Text style={styles.splashSubtitle}>EXECUTIVE PLATFORM</Text>
      </Animated.View>
      <Animated.View style={{ position: 'absolute', bottom: 50, opacity: textOpacity }}>
        <Text style={styles.developerCredit}>Developed by Hatif with &#10084;</Text>
      </Animated.View>
    </View>
  );
}

function AppNavigator({ session, theme, isDark }) {
  const insets = useSafeAreaInsets();

  if (!session) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={({ route }) => ({ 
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.primary,
      headerTitleStyle: { fontFamily: 'serif', fontWeight: 'bold' },
      tabBarStyle: { 
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.outline,
        height: 56 + Math.max(insets.bottom, 12),
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      },
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: isDark ? '#666' : '#999',
      tabBarLabelStyle: { fontWeight: 'bold', fontSize: 11 },
    })}>
      <Tab.Screen name="Dashboard" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" color={color} size={size} /> }}>
        {() => (
          <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary, headerTitleStyle: { fontFamily: 'serif', fontWeight: 'bold' } }}>
            <Stack.Screen name="DashboardMain" component={DashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="WhatsAppSettings" component={WhatsAppSettingsScreen} options={{ title: 'WhatsApp Settings' }} />
          </Stack.Navigator>
        )}
      </Tab.Screen>
      <Tab.Screen name="Members" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="account-multiple-outline" color={color} size={size} /> }}>
        {(props) => <MemberStack {...props} theme={theme} />}
      </Tab.Screen>
      <Tab.Screen name="Committees" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="account-group-outline" color={color} size={size} /> }}>
        {(props) => <CommitteeStack {...props} theme={theme} />}
      </Tab.Screen>
      <Tab.Screen name="Ledger" component={TransactionsScreen} options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="book-open-page-variant" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

async function registerForPushNotificationsAsync() {
  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo) {
    console.log('Skipping push notification registration — not supported in Expo Go');
    return false;
  }
  let status = 'granted';
  if (Platform.OS !== 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    status = existingStatus;
    if (existingStatus !== 'granted') {
      const { status: askStatus } = await Notifications.requestPermissionsAsync();
      status = askStatus;
    }
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
  return status === 'granted';
}

export default function App() {
  const systemColorScheme = useColorScheme();
  const themePreference = useStore(state => state.themePreference);
  const [session, setSession] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showSplash, setShowSplash] = React.useState(true);
  const fetchData = useStore(state => state.fetchData);

  React.useEffect(() => {
    registerForPushNotificationsAsync();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchData().then(() => {
          // BAITUL MAAL AUDITOR: Check for pending payouts
          const state = useStore.getState();
          const pending = state.committees.filter(c => {
            const isWeekly = c.frequency === 'Weekly';
            const payoutsPerCycle = isWeekly ? (c.payoutsPerCycle || 2) : 1;
            const cyclePayouts = (c.payouts || []).filter(p => p.cycleNumber === (Math.floor((c.payouts?.length || 0) / payoutsPerCycle) + 1));
            const totalPaymentsMade = (c.contributions || []).filter(con => con.cycleNumber === (Math.floor((c.payouts?.length || 0) / payoutsPerCycle) + 1) && con.status === 'paid').length;
            const amountNeeded = Math.min((payoutsPerCycle * c.totalAmount), (c.members.length - (c.payouts?.length || 0)) * c.totalAmount);
            const collectedAmount = totalPaymentsMade * (isWeekly ? c.weeklyContribution : c.contributionAmount);
            return collectedAmount >= amountNeeded && cyclePayouts.length < payoutsPerCycle && (c.payouts?.length || 0) < c.members.length;
          });

          if (pending.length > 0) {
            // Clear existing audit notifications to avoid duplicates
            Notifications.cancelAllScheduledNotificationsAsync().then(() => {
              // 1. Instant Alert
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "🏛️ Pending Payout Alert",
                  body: `Treasury ready! ${pending.length} committee(s) have funds ready for disbursement.`,
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  channelId: 'default',
                },
                trigger: null,
              });

              // 2. Recurring Daily Audit at 10:00 AM
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "🌅 Morning Treasury Audit",
                  body: `Assalam alaikum! You have ${pending.length} payouts waiting for disbursement today.`,
                  sound: true,
                  channelId: 'default',
                },
                trigger: {
                  hour: 10,
                  minute: 0,
                  repeats: true,
                },
              });
            });
          }
        });
      }
      setTimeout(() => {
        setLoading(false);
        setTimeout(() => setShowSplash(false), 2000);
      }, 1000);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData();
    });
  }, []);

  const isDark = themePreference === 'system' ? systemColorScheme === 'dark' : themePreference === 'dark';
  const theme = isDark ? RizqlyDarkTheme : RizqlyLightTheme;
  const navTheme = isDark ? NavDarkThemeCustom : NavLightTheme;
  const themeIcon = themePreference === 'light' ? 'weather-sunny' : themePreference === 'dark' ? 'weather-night' : 'brightness-auto';
  const toggleTheme = () => {
    const next = themePreference === 'light' ? 'dark' : themePreference === 'dark' ? 'system' : 'light';
    useStore.getState().setThemePreference(next);
  };

  if (showSplash) return <PaperProvider theme={theme}><SplashScreen /></PaperProvider>;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer theme={navTheme}>
          <AppNavigator 
            session={session}
            theme={theme}
            isDark={isDark}
          />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064E3B' },
  splashArabic: { color: '#D4AF37', fontSize: 48, fontFamily: 'serif', marginBottom: 10, fontWeight: 'bold' },
  splashTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 10, fontFamily: 'serif' },
  splashSubtitle: { color: 'rgba(212, 175, 55, 0.4)', fontSize: 11, letterSpacing: 5, marginTop: 12, fontWeight: 'bold' },
  developerCredit: { color: 'rgba(212, 175, 55, 0.6)', fontSize: 10, letterSpacing: 2, fontWeight: 'bold', fontFamily: 'serif' },
});
