import type { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

const activeChannels = new Map<string, RealtimeChannel>();
const trackedChannelNames = new WeakMap<RealtimeChannel, string>();

export const realtimeChannelNames = {
  church: (accountId: string, churchId: string) =>
    `church:${accountId}:${churchId}`,
  memberNotifications: (accountId: string, memberId: string) =>
    `member-notifications:${accountId}:${memberId}`,
  schedulingPreferences: (accountId: string, memberId: string) =>
    `scheduling-preferences:${accountId}:${memberId}`,
};

export function createRealtimeChannel(
  name: string,
  label: string
): RealtimeChannel {
  const existing = activeChannels.get(name);
  if (existing) {
    console.warn(`[Realtime] replacing duplicate local owner for ${label}`);
    void removeRealtimeChannel(existing, `${label} duplicate`).catch(error => {
      console.warn(`[Realtime] duplicate ${label} cleanup failed`, error);
    });
  }

  const channel = supabase.channel(name);
  activeChannels.set(name, channel);
  trackedChannelNames.set(channel, name);
  console.log(
    `[Realtime] ${label} registered (${activeChannels.size} local channel(s))`
  );
  return channel;
}

export function logRealtimeStatus(label: string) {
  return (status: string, error?: Error) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[Realtime] ${label} subscribed`);
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`[Realtime] ${label} ${status}`, error);
      return;
    }

    console.log(`[Realtime] ${label} ${status}`);
  };
}

export async function removeRealtimeChannel(
  channel: RealtimeChannel,
  label: string
): Promise<RealtimeChannelSendResponse> {
  const name = trackedChannelNames.get(channel);
  if (name && activeChannels.get(name) === channel) {
    activeChannels.delete(name);
    console.log(
      `[Realtime] ${label} released (${activeChannels.size} local channel(s))`
    );
  }
  trackedChannelNames.delete(channel);

  const response = await supabase.removeChannel(channel);
  if (response !== 'ok') {
    console.warn(`[Realtime] ${label} cleanup returned ${response}`);
  }
  return response;
}

export async function removeAllTrackedRealtimeChannels(
  label = 'account session cleanup',
): Promise<void> {
  const channels = Array.from(new Set(activeChannels.values()));
  activeChannels.clear();
  channels.forEach(channel => trackedChannelNames.delete(channel));

  const results = await Promise.allSettled(
    channels.map(channel => supabase.removeChannel(channel)),
  );
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`[Realtime] ${label} failed for channel ${index + 1}`, result.reason);
      return;
    }
    if (result.value !== 'ok') {
      console.warn(`[Realtime] ${label} returned ${result.value} for channel ${index + 1}`);
    }
  });

  if (channels.length > 0) {
    console.log(`[Realtime] ${label} released ${channels.length} channel(s)`);
  }
}

export function getTrackedRealtimeChannelCount(): number {
  return activeChannels.size;
}
