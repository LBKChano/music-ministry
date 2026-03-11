
# iOS Push Notifications Setup Guide

## Current Status

✅ **Working:**
- Push token registration on iOS devices
- Notification permissions handling
- Token storage in Supabase database
- Edge Function logic for sending reminders
- Fill-in request notifications (triggered by user actions)

❌ **Not Working:**
- **Service reminder notifications are NOT being sent automatically**

## Root Cause

The `send-service-reminders` Edge Function exists and has correct logic, but **it is never being called automatically**. 

The function needs to be triggered on a schedule (e.g., every hour) to:
1. Check for upcoming services
2. Calculate which services need reminders (based on notification_hours settings)
3. Send push notifications to assigned members

## How to Fix

### Option 1: Set Up Supabase Cron Job (Recommended)

You need to create a cron job in Supabase that calls the Edge Function hourly:

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create a new cron job with this configuration:

```sql
-- Run every hour at minute 0
SELECT cron.schedule(
  'send-service-reminders-hourly',
  '0 * * * *',  -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Important:** Replace `YOUR_SERVICE_ROLE_KEY` with your actual Supabase service role key (found in Project Settings → API).

### Option 2: External Cron Service

Use a service like:
- **Cron-job.org** (free)
- **EasyCron** (free tier available)
- **GitHub Actions** (free for public repos)

Configure it to make an HTTP POST request every hour:

```
URL: https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders
Method: POST
Headers: 
  Content-Type: application/json
  Authorization: Bearer YOUR_ANON_KEY
Body: {}
```

### Option 3: Manual Testing (Temporary)

For testing, you can manually trigger the Edge Function:

```bash
curl -X POST \
  https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{}'
```

## How It Works

Once the cron job is set up:

1. **Every hour**, the Edge Function runs
2. It queries `notification_settings` table for churches with `enabled = true`
3. For each church, it checks the `notification_hours` array (e.g., `[24, 6]` means 24 hours and 6 hours before)
4. It calculates which services are exactly X hours away (within a 30-minute window)
5. For matching services, it:
   - Gets all assignments (members assigned to roles)
   - Fetches push tokens for those members
   - Sends push notifications via Expo's Push API

## Notification Settings

Current settings for your church:
```json
{
  "church_id": "f03b8c46-3e48-4cfc-bc07-b1629353a23f",
  "notification_hours": [24, 6],
  "enabled": true
}
```

This means members will receive notifications:
- **24 hours before** a service
- **6 hours before** a service

## iOS-Specific Improvements Made

The iOS app now includes:

1. **Enhanced Permission Handling:**
   - Explicit iOS permission request with all notification options
   - User-friendly alerts when permissions are denied
   - Simulator detection with helpful message

2. **Better Logging:**
   - All logs prefixed with `[iOS]` for easy filtering
   - Detailed permission status tracking
   - Token registration confirmation

3. **Foreground Notification Handling:**
   - Shows alerts when notifications arrive while app is open
   - Proper handling of notification taps

4. **Setup Confirmation:**
   - Sends a local test notification after successful registration
   - Confirms to user that notifications are enabled

## Testing Checklist

To verify notifications work:

1. ✅ **Device Check:** Use a physical iOS device (not simulator)
2. ✅ **Permissions:** Grant notification permissions when prompted
3. ✅ **Token Registration:** Check console logs for "Push token registered successfully"
4. ✅ **Database:** Verify token appears in `push_tokens` table
5. ❌ **Cron Job:** Set up automatic Edge Function trigger (see above)
6. ⏳ **Wait:** After cron job is set up, wait for the next scheduled run
7. ⏳ **Verify:** Check Edge Function logs to see if notifications were sent

## Troubleshooting

### "No notifications received"
- **Check:** Is the cron job set up and running?
- **Check:** Are there services scheduled 24 or 6 hours from now?
- **Check:** Is the member assigned to a role in those services?
- **Check:** Edge Function logs for errors

### "Permission denied"
- Go to iOS Settings → Music Ministry → Notifications
- Enable "Allow Notifications"
- Restart the app

### "Token not registered"
- Check console logs for errors during registration
- Verify EAS project ID is in app.json
- Ensure device has internet connection

## Next Steps

1. **Set up the cron job** using Option 1 or Option 2 above
2. **Create a test service** scheduled 24 hours from now
3. **Assign yourself** to a role in that service
4. **Wait for the cron job** to run (check Edge Function logs)
5. **Verify notification** arrives on your iOS device

## Support

If notifications still don't work after setting up the cron job:
1. Check Edge Function logs in Supabase Dashboard
2. Verify the cron job is running (check pg_cron logs)
3. Test the Edge Function manually using the curl command above
4. Check that push tokens in the database are valid Expo tokens
