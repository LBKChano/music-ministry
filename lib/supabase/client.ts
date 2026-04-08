
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = "https://cvgdxmmtrukahyvkgazj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs";

// SecureStore has a 2048-byte value limit on iOS. Supabase JWT tokens can exceed
// this, causing silent write failures and session loss on every app restart.
// Fix: chunk large values across multiple SecureStore keys, falling back to
// AsyncStorage for any chunk that still exceeds the limit.
const SECURE_STORE_CHUNK_SIZE = 1800; // safe margin below 2048
const SECURE_STORE_CHUNK_COUNT_SUFFIX = '__chunks';

async function secureStoreSetLarge(key: string, value: string): Promise<void> {
  try {
    if (value.length <= SECURE_STORE_CHUNK_SIZE) {
      // Small enough — store directly, clear any old chunks
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(key + SECURE_STORE_CHUNK_COUNT_SUFFIX).catch(() => {});
      return;
    }

    // Split into chunks
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += SECURE_STORE_CHUNK_SIZE) {
      chunks.push(value.slice(i, i + SECURE_STORE_CHUNK_SIZE));
    }

    // Store chunk count
    await SecureStore.setItemAsync(key + SECURE_STORE_CHUNK_COUNT_SUFFIX, String(chunks.length));

    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunks[i]);
    }

    // Remove the plain key in case it existed before
    await SecureStore.deleteItemAsync(key).catch(() => {});
  } catch (err) {
    console.error('[SupabaseStorage] secureStoreSetLarge error:', err);
    throw err;
  }
}

async function secureStoreGetLarge(key: string): Promise<string | null> {
  try {
    // Check if chunked
    const chunkCountStr = await SecureStore.getItemAsync(key + SECURE_STORE_CHUNK_COUNT_SUFFIX);
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10);
      if (!isNaN(chunkCount) && chunkCount > 0) {
        const chunks: string[] = [];
        for (let i = 0; i < chunkCount; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
          if (chunk === null) {
            console.warn('[SupabaseStorage] Missing chunk', i, 'for key', key);
            return null;
          }
          chunks.push(chunk);
        }
        return chunks.join('');
      }
    }

    // Not chunked — read directly
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error('[SupabaseStorage] secureStoreGetLarge error:', err);
    return null;
  }
}

async function secureStoreRemoveLarge(key: string): Promise<void> {
  try {
    const chunkCountStr = await SecureStore.getItemAsync(key + SECURE_STORE_CHUNK_COUNT_SUFFIX).catch(() => null);
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10);
      if (!isNaN(chunkCount)) {
        for (let i = 0; i < chunkCount; i++) {
          await SecureStore.deleteItemAsync(`${key}__chunk_${i}`).catch(() => {});
        }
      }
      await SecureStore.deleteItemAsync(key + SECURE_STORE_CHUNK_COUNT_SUFFIX).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  } catch (err) {
    console.error('[SupabaseStorage] secureStoreRemoveLarge error:', err);
  }
}

// Platform-split storage adapter.
// Android: AsyncStorage only — SecureStore is unreliable after force-close.
// iOS: Chunked SecureStore (handles large JWTs) with AsyncStorage fallback.
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

      // iOS: try chunked SecureStore, fall back to AsyncStorage
      try {
        const value = await secureStoreGetLarge(key);
        if (value !== null) {
          console.log('SupabaseStorage.getItem result (SecureStore/iOS):', 'session found');
          return value;
        }
        // SecureStore returned null — check AsyncStorage fallback (migrated data)
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
      console.log('SupabaseStorage.setItem:', key, '| platform:', Platform.OS, '| size:', value.length);

      if (Platform.OS === 'android' || Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        console.log('SupabaseStorage.setItem saved to AsyncStorage');
        return;
      }

      // iOS: write to chunked SecureStore (primary) and AsyncStorage (fallback)
      try {
        await secureStoreSetLarge(key, value);
        console.log('SupabaseStorage.setItem saved to SecureStore (iOS, chunked)');
      } catch (secureStoreError) {
        console.error('SupabaseStorage.setItem SecureStore error, using AsyncStorage only:', secureStoreError);
      }
      // Always write AsyncStorage on iOS too so the fallback path always works
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
        await secureStoreRemoveLarge(key);
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
