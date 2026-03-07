
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = "https://cvgdxmmtrukahyvkgazj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs";

// ANDROID FIX: Enhanced storage adapter with fallback to AsyncStorage if SecureStore fails
// This prevents session loss after force close on Android
class SupabaseStorage {
  private useSecureStore: boolean = Platform.OS !== 'web';
  private storageFailureCount: number = 0;
  private readonly MAX_FAILURES = 3;

  async getItem(key: string): Promise<string | null> {
    try {
      console.log('SupabaseStorage: Getting item for key:', key);
      
      // On web, always use AsyncStorage
      if (Platform.OS === 'web') {
        const value = await AsyncStorage.getItem(key);
        console.log('SupabaseStorage: Retrieved from AsyncStorage (web):', value ? 'session found' : 'no session');
        return value;
      }

      // On Android/iOS, try SecureStore first, fallback to AsyncStorage if it fails
      if (this.useSecureStore && this.storageFailureCount < this.MAX_FAILURES) {
        try {
          const value = await SecureStore.getItemAsync(key);
          console.log('SupabaseStorage: Retrieved from SecureStore (native):', value ? 'session found' : 'no session');
          
          // Reset failure count on success
          if (this.storageFailureCount > 0) {
            console.log('SupabaseStorage: SecureStore recovered, resetting failure count');
            this.storageFailureCount = 0;
          }
          
          return value;
        } catch (secureStoreError) {
          console.error('SupabaseStorage: SecureStore failed, attempting AsyncStorage fallback:', secureStoreError);
          this.storageFailureCount++;
          
          // If SecureStore fails too many times, switch to AsyncStorage permanently for this session
          if (this.storageFailureCount >= this.MAX_FAILURES) {
            console.warn('SupabaseStorage: SecureStore failed multiple times, switching to AsyncStorage permanently');
            this.useSecureStore = false;
          }
          
          // Try AsyncStorage as fallback
          const value = await AsyncStorage.getItem(key);
          console.log('SupabaseStorage: Retrieved from AsyncStorage (fallback):', value ? 'session found' : 'no session');
          return value;
        }
      } else {
        // Use AsyncStorage if SecureStore is disabled
        const value = await AsyncStorage.getItem(key);
        console.log('SupabaseStorage: Retrieved from AsyncStorage (native fallback):', value ? 'session found' : 'no session');
        return value;
      }
    } catch (error) {
      console.error('SupabaseStorage: Critical error getting item:', error);
      // Return null instead of throwing to prevent app crashes
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log('SupabaseStorage: Setting item for key:', key);
      
      // On web, always use AsyncStorage
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        console.log('SupabaseStorage: Saved to AsyncStorage (web)');
        return;
      }

      // On Android/iOS, try SecureStore first, fallback to AsyncStorage if it fails
      if (this.useSecureStore && this.storageFailureCount < this.MAX_FAILURES) {
        try {
          await SecureStore.setItemAsync(key, value);
          console.log('SupabaseStorage: Saved to SecureStore (native)');
          
          // Also save to AsyncStorage as backup for Android
          if (Platform.OS === 'android') {
            await AsyncStorage.setItem(key, value);
            console.log('SupabaseStorage: Backup saved to AsyncStorage (Android)');
          }
          
          return;
        } catch (secureStoreError) {
          console.error('SupabaseStorage: SecureStore save failed, using AsyncStorage fallback:', secureStoreError);
          this.storageFailureCount++;
          
          if (this.storageFailureCount >= this.MAX_FAILURES) {
            console.warn('SupabaseStorage: SecureStore failed multiple times, switching to AsyncStorage permanently');
            this.useSecureStore = false;
          }
          
          // Fallback to AsyncStorage
          await AsyncStorage.setItem(key, value);
          console.log('SupabaseStorage: Saved to AsyncStorage (fallback)');
        }
      } else {
        // Use AsyncStorage if SecureStore is disabled
        await AsyncStorage.setItem(key, value);
        console.log('SupabaseStorage: Saved to AsyncStorage (native fallback)');
      }
    } catch (error) {
      console.error('SupabaseStorage: Critical error setting item:', error);
      // Don't throw to prevent app crashes during save
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      console.log('SupabaseStorage: Removing item for key:', key);
      
      // On web, always use AsyncStorage
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
        console.log('SupabaseStorage: Removed from AsyncStorage (web)');
        return;
      }

      // On Android/iOS, remove from both SecureStore and AsyncStorage to ensure cleanup
      try {
        if (this.useSecureStore) {
          await SecureStore.deleteItemAsync(key);
          console.log('SupabaseStorage: Removed from SecureStore (native)');
        }
      } catch (secureStoreError) {
        console.error('SupabaseStorage: SecureStore removal failed:', secureStoreError);
      }
      
      // Always try to remove from AsyncStorage as well (for Android backup)
      await AsyncStorage.removeItem(key);
      console.log('SupabaseStorage: Removed from AsyncStorage (native)');
    } catch (error) {
      console.error('SupabaseStorage: Critical error removing item:', error);
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
    storageKey: 'supabase.auth.token',
    // ANDROID FIX: Add flow type for better session handling
    flowType: 'pkce',
  },
});
