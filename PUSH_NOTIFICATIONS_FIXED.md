
# Push Notifications - Bug Fixes Applied ✅

## Issues Fixed

### 1. **iOS Permission Handling** ✅
- **Problem**: iOS requires explicit permission request and proper configuration
- **Fix**: Added comprehensive iOS permission handling with user-friendly alerts
- **Changes**:
  - Added detailed logging for permission flow
  - Added user alerts when permissions are denied
  - Improved error handling for iOS-specific issues

### 2. **Push Token Registration Bug** ✅
- **Problem**: The `registerPushToken` function was using the wrong member ID
- **Fix**: Updated to use `church_members.id` (not `auth.users.id`)
- **Impact**: Push tokens are now correctly linked to church members

### 3. **Edge Function Query Bugs** ✅
- **Problem**: Both Edge Functions were querying wrong member IDs
- **Fix**: Updated both `send-fill-in-notifications` and `send-service-reminders` to use correct IDs
- **Details**:
  - `member_roles.member_id` → `church_members.id`
  - `push_tokens.member_id` → `church_members.id`
  - `assignments.member_id` → `church_members.id`

### 4. **Missing Error Handling** ✅
- **Problem**: No user feedback when registration fails
- **Fix**: Added comprehensive error handling with user alerts
- **Features**:
  - Detailed console logging for debugging
  - User-friendly error messages
  - Graceful degradation when permissions denied

### 5. **iOS Background Notifications** ✅
- **Problem**: Missing iOS background notification configuration
- **Fix**: Already configured in `app.json`:
  ```json
  "UIBackgroundModes": ["remote-notification"]
  ```

## Database Schema

The push notification system uses the following tables:

### `push_tokens` Table
```sql
- id: uuid (primary key)
- member_id: uuid (foreign key to church_members.id) ← CRITICAL
- token: text (Expo push token)
- device_type: text (ios/android)
- created_at: timestamptz
- updated_at: timestamptz
```

**Key Point**: `member_id` links to `church_members.id`, NOT `auth.users.id`

## How It Works

### 1. Token Registration Flow (iOS)
```
1. User opens app → currentMember is loaded
2. Check if physical device (not simulator)
3. Request iOS notification permissions
4. Get EAS project ID from app.json
5. Get Expo push token from Expo servers
6. Save token to Supabase push_tokens table
   - member_id = church_members.id
   - token = ExponentPushToken[...]
   - device_type = "ios"
```

### 2. Fill-In Request Notifications
```
1. User creates fill-in request
2. Frontend calls send-fill-in-notifications Edge Function
3. Edge Function:
   - Finds all members with same role
   - Gets their church_members.id
   - Queries push_tokens using those IDs
   - Sends notifications via Expo Push API
```

### 3. Service Reminder Notifications
```
1. Cron job triggers send-service-reminders Edge Function
2. Edge Function:
   - Finds services in notification window
   - Gets assignments for those services
   - Uses assignments.member_id (church_members.id)
   - Queries push_tokens using those IDs
   - Sends reminders via Expo Push API
```

## Testing Checklist

### On Physical iOS Device:
- [ ] Install app on physical iPhone (not simulator)
- [ ] Sign in as a church member
- [ ] Check console logs for "✅ Push token registered successfully"
- [ ] Verify token appears in Supabase `push_tokens` table
- [ ] Create a fill-in request
- [ ] Check that other members with same role receive notification
- [ ] Verify notification appears in iOS notification center
- [ ] Tap notification and verify app opens correctly

### Debugging:
- [ ] Check frontend logs: `read_frontend_logs`
- [ ] Check Edge Function logs in Supabase dashboard
- [ ] Verify EAS project ID in app.json: `a500e23e-d75d-44a5-bf0c-6baaf4d67839`
- [ ] Verify push tokens in database have correct format: `ExponentPushToken[...]`

## Configuration Required

### app.json (Already Configured) ✅
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "plugins": [
      ["expo-notifications", { "mode": "production" }]
    ],
    "extra": {
      "eas": {
        "projectId": "a500e23e-d75d-44a5-bf0c-6baaf4d67839"
      }
    }
  }
}
```

### Service Reminders Cron Job (External Setup Required)
You need to set up a cron job to call the `send-service-reminders` Edge Function regularly.

**Option 1: Supabase pg_cron** (Recommended)
```sql
SELECT cron.schedule(
  'send-service-reminders',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Option 2: External Cron Service**
- Use cron-job.org, EasyCron, or similar
- Schedule hourly POST request to:
  `https://cvgdxmmtrukahyvkgazj.supabase.co/functions/v1/send-service-reminders`

## Verified Changes

### Frontend Files Updated:
- ✅ `app/(tabs)/(home)/index.tsx` - Enhanced iOS permission handling
- ✅ `app/(tabs)/(home)/index.ios.tsx` - Enhanced iOS permission handling

### Backend Files Updated:
- ✅ `send-fill-in-notifications` Edge Function - Fixed member ID queries
- ✅ `send-service-reminders` Edge Function - Fixed member ID queries

### Key Improvements:
1. **Detailed Logging**: Every step of registration is logged for debugging
2. **User Feedback**: Alerts inform users when permissions are denied
3. **Error Handling**: Graceful degradation when things go wrong
4. **Correct IDs**: All queries use `church_members.id` consistently
5. **iOS Optimized**: Proper iOS permission flow and background modes

## Next Steps

1. **Test on Physical Device**: Push notifications only work on real devices
2. **Set Up Cron Job**: Configure service reminders to run hourly
3. **Monitor Logs**: Check Edge Function logs in Supabase dashboard
4. **Verify Tokens**: Ensure tokens are being saved to database

## Support

If notifications still don't work:
1. Check device notification settings (Settings → Music Ministry → Notifications)
2. Verify EAS project ID matches in app.json
3. Check Supabase Edge Function logs for errors
4. Verify push tokens exist in database for test users
5. Test with Expo's push notification tool: https://expo.dev/notifications
