
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

export function CustomSplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <IconSymbol 
          ios_icon_name="building.2.fill" 
          android_material_icon_name="account-balance"
          size={80} 
          color="#FFFFFF" 
        />
        <IconSymbol 
          ios_icon_name="music.note" 
          android_material_icon_name="music-note"
          size={60} 
          color="#60A5FA" 
          style={styles.musicNote}
        />
      </View>
      <Text style={styles.title}>Church Scheduler</Text>
      <Text style={styles.subtitle}>Worship Ministry Management</Text>
      <ActivityIndicator 
        size="large" 
        color="#FFFFFF" 
        style={styles.loader}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  musicNote: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#BFDBFE',
    marginBottom: 40,
    textAlign: 'center',
  },
  loader: {
    marginTop: 20,
  },
});
