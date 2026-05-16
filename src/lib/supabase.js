import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://xwidrwgtvsfqnqnlwlzs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3aWRyd2d0dnNmcW5xbmx3bHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjE1NTYsImV4cCI6MjA5Mzg5NzU1Nn0.czfx2HbXSOOIkT1aG8YFNxc55g5cme8qWZTqCTiJsZg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
