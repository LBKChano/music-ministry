
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = "https://cvgdxmmtrukahyvkgazj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs";

// Custom storage adapter that uses SecureStore for native and AsyncStorage for web
// Includes error handling to prevent crashes
class SupabaseStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      console.log('SupabaseStorage: Getting item for key:', key);
      if (Platform.OS === 'web') {
        const value = await AsyncStorage.getItem(key);
        console.log('SupabaseStorage: Retrieved from AsyncStorage (web):', value ? 'session found' : 'no session');
        return value;
      }
      const value = await SecureStore.getItemAsync(key);
      console.log('SupabaseStorage: Retrieved from SecureStore (native):', value ? 'session found' : 'no session');
      return value;
    } catch (error) {
      console.error('SupabaseStorage: Error getting item:', error);
      // Return null instead of throwing to prevent app crashes
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log('SupabaseStorage: Setting item for key:', key);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        console.log('SupabaseStorage: Saved to AsyncStorage (web)');
        return;
      }
      await SecureStore.setItemAsync(key, value);
      console.log('SupabaseStorage: Saved to SecureStore (native)');
    } catch (error) {
      console.error('SupabaseStorage: Error setting item:', error);
      // Don't throw to prevent app crashes during save
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      console.log('SupabaseStorage: Removing item for key:', key);
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
        console.log('SupabaseStorage: Removed from AsyncStorage (web)');
        return;
      }
      await SecureStore.deleteItemAsync(key);
      console.log('SupabaseStorage: Removed from SecureStore (native)');
    } catch (error) {
      console.error('SupabaseStorage: Error removing item:', error);
      // Don't throw to prevent app crashes during removal
    }
  }
}

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: new SupabaseStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Add storage key for better debugging
    storageKey: 'supabase.auth.token',
  },
});
