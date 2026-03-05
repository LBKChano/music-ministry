
# Service Reminders System

## Overview
The church scheduling app now includes an automated service reminder system that sends push notifications to members before their scheduled services.

## How It Works

### 1. Notification Settings
Admins can configure notification settings for their church in the Church Management tab:
- Enable/disable notifications
- Set notification hours (e.g., 24 hours before, 2 hours before)
- Multiple notification times can be configured

### 2. Automatic Reminders
The system automatically sends push notifications to members who are assigned to upcoming services based on the configured notification hours.

### 3. Edge Function
A Supabase Edge Function (`send-service-reminders`) runs periodically to:
- Check all churches with notifications enabled
- Find services within the notification time window
- Send push notifications to assigned members

## Setup Instructions

### For Admins
1. Go to the Church Management tab
2. Scroll to "Notification Settings"
3. Enable notifications
4. Add notification hours (e.g., 24, 2 for reminders 24 hours and 2 hours before)
5. Save settings

### For Members
1. Allow push notifications when prompted
2. Your device will automatically register for notifications
3. You'll receive reminders before your scheduled services

## Technical Details

### Edge Functions
- **send-fill-in-notifications**: Sends notifications when a member requests a fill-in
- **send-service-reminders**: Sends scheduled service reminders (needs to be triggered by a cron job)

### Database Tables
- **notification_settings**: Stores church notification preferences
- **push_tokens**: Stores device push notification tokens
- **services**: Contains service schedules
- **assignments**: Links members to service roles

### Realtime Updates
The schedule automatically refreshes when:
- New services are created
- Assignments are added or updated
- Services are deleted
- Fill-in requests are accepted

## Troubleshooting

### Not Receiving Notifications?
1. Check that notifications are enabled in your device settings
2. Verify that the church admin has enabled notifications
3. Ensure you're assigned to upcoming services
4. Check that your push token is registered (visible in console logs)

### Schedule Not Updating?
1. The app uses Supabase Realtime for live updates
2. Check your internet connection
3. Try pulling down to refresh the schedule
4. Check console logs for realtime subscription status

## Future Enhancements
- Configurable notification messages
- Different notification times for different service types
- Notification history
- Opt-out options for individual members
