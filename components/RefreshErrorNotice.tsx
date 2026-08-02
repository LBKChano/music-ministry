import React from 'react';
import { StyleSheet, View } from 'react-native';
import { InlineStatus } from '@/components/feedback/inline-status';

interface RefreshErrorNoticeProps {
  message: string | null;
}

export function RefreshErrorNotice({ message }: RefreshErrorNoticeProps) {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <InlineStatus message={message} tone="error" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
