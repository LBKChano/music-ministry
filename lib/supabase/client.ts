
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = "https://cvgdxmmtrukahyvkgazj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs";

// ANDROID FIX: Platform-split storage adapter.
// Android: AsyncStorage only — SecureStore is unreliable after force-close because
//   the in-process failure counter resets each launch, so a "successful" SecureStore
//   read that returns null is indistinguishable from a missing session.
// iOS: SecureStore (secure enclave) with AsyncStorage fallback.
// Web: AsyncStorage only.
class SupabaseStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      console.log('SupabaseStorage.getItem:', key, '| platform:', Platform.OS);

      if (Platform.OS === 'android' || Platform.OS === 'web') {
        const value = await AsyncStorage.getItem(key);
        console.log('SupabaseStorage.getItem result (AsyncStorage):', value ? 'session found' : 'no session');
        return value;
      }

      // iOS: try SecureStore, fall back to AsyncStorage
      try {
        const value = await SecureStore.getItemAsync(key);
        console.log('SupabaseStorage.getItem result (SecureStore/iOS):', value ? 'session found' : 'no session');
        if (value !== null) return value;
        // SecureStore returned null — check AsyncStorage fallback (e.g. migrated data)
        const fallback = await AsyncStorage.getItem(key);
        console.log('SupabaseStorage.getItem iOS AsyncStorage fallback:', fallback ? 'session found' : 'no session');
        return fallback;
      } catch (secureStoreError) {
        console.error('SupabaseStorage.getItem SecureStore error, falling back to AsyncStorage:', secureStoreError);
        const value = await AsyncStorage.getItem(key);
        console.log('SupabaseStorage.getItem result (AsyncStorage fallback):', value ? 'session found' : 'no session');
        return value;
      }
    } catch (error) {
      console.error('SupabaseStorage.getItem critical error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log('SupabaseStorage.setItem:', key, '| platform:', Platform.OS);

      if (Platform.OS === 'android' || Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        console.log('SupabaseStorage.setItem saved to AsyncStorage');
        return;
      }

      // iOS: write to both SecureStore (primary) and AsyncStorage (fallback)
      try {
        await SecureStore.setItemAsync(key, value);
        console.log('SupabaseStorage.setItem saved to SecureStore (iOS)');
      } catch (secureStoreError) {
        console.error('SupabaseStorage.setItem SecureStore error, using AsyncStorage only:', secureStoreError);
      }
      // Always write AsyncStorage on iOS too so the fallback path above always works
      await AsyncStorage.setItem(key, value);
      console.log('SupabaseStorage.setItem saved to AsyncStorage (iOS backup)');
    } catch (error) {
      console.error('SupabaseStorage.setItem critical error:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      console.log('SupabaseStorage.removeItem:', key, '| platform:', Platform.OS);

      if (Platform.OS === 'android' || Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
        console.log('SupabaseStorage.removeItem removed from AsyncStorage');
        return;
      }

      // iOS: remove from both stores
      try {
        await SecureStore.deleteItemAsync(key);
        console.log('SupabaseStorage.removeItem removed from SecureStore (iOS)');
      } catch (secureStoreError) {
        console.error('SupabaseStorage.removeItem SecureStore error:', secureStoreError);
      }
      await AsyncStorage.removeItem(key);
      console.log('SupabaseStorage.removeItem removed from AsyncStorage (iOS)');
    } catch (error) {
      console.error('SupabaseStorage.removeItem critical error:', error);
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
    storageKey: 'supabase.auth.token',
    // Use implicit flow for React Native — PKCE requires URL callback handling
    // which is unreliable after Android force-close and causes session loss/crashes
    flowType: 'implicit',
  },
});
