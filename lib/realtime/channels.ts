import type { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

const activeChannels = new Map<string, RealtimeChannel>();
const trackedChannelNames = new WeakMap<RealtimeChannel, string>();

export const realtimeChannelNames = {
  church: (accountId: string, churchId: string) =>
    `church:${accountId}:${churchId}`,
  memberNotifications: (accountId: string, memberId: string) =>
    `member-notifications:${accountId}:${memberId}`,
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

export function getTrackedRealtimeChannelCount(): number {
  return activeChannels.size;
}
