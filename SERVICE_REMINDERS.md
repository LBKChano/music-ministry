
# Service Reminder Notifications Setup

## Overview
The notification system has two components:
1. **Fill-in Request Notifications** - Sent immediately when a member requests a fill-in (✅ Working)
2. **Service Reminder Notifications** - Sent at configured times before services (⚠️ Requires Cron Setup)

## Current Status

### ✅ What's Working
- Push token registration when users open the app
- Fill-in request notifications sent to members with the same role
- Notification settings UI in the Church Management tab
- Edge Function `send-service-reminders` is deployed and ready

### ⚠️ What Needs Setup
The `send-service-reminders` Edge Function needs to be triggered regularly via a cron job.

## Setting Up Service Reminder Cron Job

### Option 1: Supabase Cron (Recommended)
You need to set up a cron job in your Supabase project to call the `send-service-reminders` Edge Function regularly.

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/cvgdxmmtrukahyvkgazj
2. Navigate to **Database** → **Extensions**
3. Enable the `pg_cron` extension if not already enabled
4. Go to **SQL Editor** and run:

```sql
-- Schedule the service reminder function to run every 30 minutes
SELECT cron.schedule(
  'send-service-reminders',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT
    net.http_post(
      url:='https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### Option 2: External Cron Service
If you prefer an external service, you can use:
- **Cron-job.org** (free)
- **EasyCron** (free tier available)
- **GitHub Actions** (if you have a repo)

Configure it to make a POST request to:
```
URL: https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders
Method: POST
Headers:
  Content-Type: application/json
  apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs
Body: {}
Schedule: Every 30 minutes
```

## How It Works

### Service Reminder Flow
1. Cron job triggers the `send-service-reminders` Edge Function every 30 minutes
2. Function checks all churches with notifications enabled
3. For each notification hour configured (e.g., 24 hours, 6 hours before):
   - Finds services in the time window (±30 minutes)
   - Gets all assigned members for those services
   - Fetches their push tokens
   - Sends push notifications via Expo Push Service

### Fill-in Request Flow (Already Working)
1. Member taps "Request Fill-In" button
2. Frontend calls `createFillInRequest` in `useChurch` hook
3. Hook calls `send-fill-in-notifications` Edge Function
4. Function finds all members with the same role
5. Sends push notifications to those members

## Testing Notifications

### Test Fill-in Notifications (Working Now)
1. Assign yourself to a service role
2. Tap "Request Fill-In" on your assignment
3. Other members with the same role should receive a notification

### Test Service Reminders (After Cron Setup)
1. Go to Church Management → Notifications tab
2. Set notification hours (e.g., 1 hour before)
3. Create a service 1 hour in the future
4. Assign yourself to a role
5. Wait for the cron job to run (within 30 minutes)
6. You should receive a reminder notification

## Troubleshooting

### No Push Tokens Registered
- Check that users have granted notification permissions
- Verify the Expo project ID is correctly configured in `app.json`
- Check the `push_tokens` table in Supabase to see if tokens are being saved

### Fill-in Notifications Not Received
- Verify members have the same role assigned
- Check Edge Function logs in Supabase Dashboard → Edge Functions → send-fill-in-notifications
- Ensure push tokens are registered for the target members

### Service Reminders Not Received
- Verify the cron job is set up and running
- Check Edge Function logs in Supabase Dashboard → Edge Functions → send-service-reminders
- Ensure notification settings are enabled for the church
- Verify services exist in the configured time window

## Database Tables

### push_tokens
Stores Expo push notification tokens for each member:
- `member_id`: Links to church_members table
- `token`: Expo push token (ExponentPushToken[...])
- `device_type`: 'ios' or 'android'

### notification_settings
Stores notification preferences per church:
- `church_id`: Links to churches table
- `notification_hours`: Array of hours before service (e.g., [24, 6])
- `enabled`: Boolean to enable/disable notifications

## Next Steps

1. **Set up the cron job** using one of the options above
2. **Test the system** by creating a service and waiting for notifications
3. **Monitor Edge Function logs** to ensure notifications are being sent
4. **Adjust notification hours** in the Church Management tab as needed

## Support

If you encounter issues:
1. Check the Edge Function logs in Supabase Dashboard
2. Verify push tokens are being registered in the `push_tokens` table
3. Ensure notification settings are properly configured
4. Test with a service scheduled 1 hour in the future for quick feedback
