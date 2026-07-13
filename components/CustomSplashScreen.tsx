import React from 'react';
import { ActivityIndicator, ImageBackground, StyleSheet, Text, View } from 'react-native';

const splashArtwork = require('../assets/images/9b11f806-5921-4e61-9383-a3f7e125c18f.png');

export function CustomSplashScreen() {
  return (
    <ImageBackground source={splashArtwork} resizeMode="cover" style={styles.container}>
      <View style={styles.statusPanel}>
        <ActivityIndicator
          size="small"
          color="#FFFFFF"
          style={styles.loader}
        />
        <Text style={styles.statusText}>Preparing your ministry schedule</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    backgroundColor: '#06152F',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 56,
  },
  statusPanel: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(6, 21, 47, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  loader: {
    transform: [{ scale: 0.88 }],
  },
  statusText: {
    color: '#EAF2FF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
