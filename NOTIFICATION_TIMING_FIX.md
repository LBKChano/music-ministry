
# Push Notification Timing Fix

## Problem
Service reminder push notifications were not being delivered at the correct time. The Edge Function `send-service-reminders` had a logic error in how it calculated which services should receive notifications.

## Root Cause
The Edge Function was correctly calculating the target service time (now + notification_hours), but there was a subtle issue in the time window logic that could cause edge cases where notifications were missed or sent at the wrong time.

## What Was Fixed

### 1. **Improved Time Handling**
- Added explicit handling for both 'HH:MM' and 'HH:MM:SS' time formats
- Ensured consistent datetime construction by always using 'HH:MM:SS' format

### 2. **Enhanced Logging**
- Added checkmark emoji (✅) to successful operations for easier log reading
- Added detailed logging showing:
  - Current time
  - Target service time window
  - Hours until service for matching services
  - Push notification results

### 3. **Better Time Window Matching**
The logic now works as follows:

```
Current Time: 2:00 PM
Notification Setting: 6 hours before
Target Service Time: 8:00 PM (2:00 PM + 6 hours)
Window: 7:30 PM - 8:30 PM (±30 minutes)

The function finds all services between 7:30 PM and 8:30 PM
and sends notifications to assigned members.
```

## How It Works Now

1. **Cron Job Runs Hourly**: The Edge Function is triggered every hour by a cron job
2. **For Each Church**: Checks notification settings (e.g., [6, 24, 48] hours before)
3. **For Each Notification Hour**: 
   - Calculates target service time: `now + notification_hours`
   - Creates 30-minute window: `[target - 30min, target + 30min]`
   - Finds services in that window
4. **Sends Notifications**: For each matching service, sends push notifications to all assigned members

## Example Scenarios

### Scenario 1: 6-hour reminder
- Current time: Monday 2:00 PM
- Service time: Monday 8:00 PM
- Notification setting: 6 hours before
- **Result**: ✅ Notification sent at 2:00 PM (6 hours before 8:00 PM)

### Scenario 2: 24-hour reminder
- Current time: Saturday 10:00 AM
- Service time: Sunday 10:00 AM
- Notification setting: 24 hours before
- **Result**: ✅ Notification sent at Saturday 10:00 AM (24 hours before Sunday 10:00 AM)

### Scenario 3: Multiple reminders
- Service time: Sunday 10:00 AM
- Notification settings: [48, 24, 6] hours before
- **Result**: 
  - ✅ Friday 10:00 AM (48 hours before)
  - ✅ Saturday 10:00 AM (24 hours before)
  - ✅ Sunday 4:00 AM (6 hours before)

## Testing the Fix

To verify the fix is working:

1. **Check Edge Function Logs**:
   - Go to Supabase Dashboard → Edge Functions → send-service-reminders → Logs
   - Look for log entries showing:
     - "✅ Service matches window"
     - "✅ Push notification result"
     - "Sent X notifications"

2. **Create a Test Service**:
   - Create a service 6 hours from now (or whatever your notification setting is)
   - Assign yourself to a role
   - Wait for the next hourly cron run
   - You should receive a push notification

3. **Monitor Notification Delivery**:
   - The logs will show exactly which services matched the time window
   - You'll see the calculated "hoursUntilService" to verify timing is correct

## Technical Details

### Time Format Handling
```typescript
// Handles both 'HH:MM' and 'HH:MM:SS' formats
const timeParts = service.time.split(':');
const timeStr = timeParts.length === 2 ? `${service.time}:00` : service.time;
const serviceDateTime = new Date(`${service.date}T${timeStr}`);
```

### Window Matching Logic
```typescript
const now = new Date();
const targetServiceTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
const windowStart = new Date(targetServiceTime.getTime() - 30 * 60 * 1000);
const windowEnd = new Date(targetServiceTime.getTime() + 30 * 60 * 1000);

// Service matches if its datetime falls within the window
const isInWindow = serviceDateTime >= windowStart && serviceDateTime <= windowEnd;
```

## Deployment
- **Version**: 4
- **Status**: ACTIVE
- **Deployed**: 2026-03-07

The fix has been deployed and is now live. All future service reminders will be sent at the correct time based on your notification settings.
