import * as React from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { NavigationContainer, DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme, ActivityIndicator } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import * as Notifications from 'expo-notifications';
import { supabase } from './src/lib/supabase';
import { useStore } from './src/store/useStore';

// Screens
import DashboardScreen from './src/screens/DashboardScreen';
import CommitteesScreen from './src/screens/CommitteesScreen';
import CommitteeDetailScreen from './src/screens/CommitteeDetailScreen';
import CreateCommitteeScreen from './src/screens/CreateCommitteeScreen';
import MembersScreen from './src/screens/MembersScreen';
import AddMemberScreen from './src/screens/AddMemberScreen';
import AuthScreen from './src/screens/AuthScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';

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
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.onSurface }}>
      <Stack.Screen name="CommitteesList" component={CommitteesScreen} options={{ title: 'Committees' }} />
      <Stack.Screen name="CommitteeDetail" component={CommitteeDetailScreen} options={{ title: 'Details' }} />
      <Stack.Screen name="CreateCommittee" component={CreateCommitteeScreen} options={{ title: 'New Committee', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

function MemberStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.onSurface }}>
      <Stack.Screen name="MembersList" component={MembersScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="AddMember" component={AddMemberScreen} options={{ title: 'Add Member', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

const WaslaLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#064E3B', // Deep Emerald
    secondary: '#D4AF37', // Gold
    tertiary: '#022C22',
    surface: '#FFFFFF',
    background: '#FAF9F6', // Luxury Cream
    onSurface: '#1A1A1A',
    onBackground: '#1A1A1A',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: '#FFFFFF',
      level2: '#F3F4F6',
    }
  },
};

const WaslaDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D4AF37',
    secondary: '#064E3B',
    surface: '#022C22',
    background: '#011511',
    onSurface: '#FDFCF0',
  },
};

const NavLightTheme = {
  ...NavDefaultTheme,
  colors: {
    ...NavDefaultTheme.colors,
    primary: '#064E3B',
    background: '#FDFCF0',
    card: '#FFFFFF',
    text: '#064E3B',
  },
};

const NavDarkThemeCustom = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: '#D4AF37',
    background: '#011511',
    card: '#022C22',
    text: '#FDFCF0',
  },
};

export default function App() {
  const systemColorScheme = useColorScheme();
  const themePreference = useStore(state => state.themePreference);
  const [session, setSession] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const fetchData = useStore(state => state.fetchData);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchData();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData();
    });
  }, []);

  const isDark = themePreference === 'system' ? systemColorScheme === 'dark' : themePreference === 'dark';
  const theme = isDark ? WaslaDarkTheme : WaslaLightTheme;
  const navTheme = isDark ? NavDarkThemeCustom : NavLightTheme;

  if (loading) {
    return (
      <PaperProvider theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" />
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer theme={navTheme}>
        {!session ? (
          <Stack.Navigator>
            <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        ) : (
          <Tab.Navigator screenOptions={{ 
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.primary,
            tabBarStyle: { backgroundColor: theme.colors.surface },
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: 'rgba(6, 78, 59, 0.4)',
          }}>
            <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="view-dashboard" color={color} size={size} /> }} />
            <Tab.Screen name="Ledger" component={TransactionsScreen} options={{ tabBarIcon: ({ color, size }) => <Icon name="book-open-variant" color={color} size={size} /> }} />
            <Tab.Screen name="Committees" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="account-group" color={color} size={size} /> }}>
              {(props) => <CommitteeStack {...props} theme={theme} />}
            </Tab.Screen>
            <Tab.Screen name="Members" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="account-multiple" color={color} size={size} /> }}>
              {(props) => <MemberStack {...props} theme={theme} />}
            </Tab.Screen>
          </Tab.Navigator>
        )}
      </NavigationContainer>
    </PaperProvider>
  );
}
