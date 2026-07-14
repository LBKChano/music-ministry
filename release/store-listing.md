# Music Ministry Store Listing Draft

Use this as the first version of the App Store Connect and Google Play listing.

## App Identity

- App name: Music Ministry
- iOS bundle ID: com.lbkchano.musicministry
- Android package name: com.lbkchano.musicministry
- Category recommendation: Productivity, with Lifestyle as a secondary option where available
- Age rating recommendation: 4+ / Everyone, assuming the app contains no public social feed, objectionable content, purchases, gambling, or unrestricted web browsing

## App Store Connect

### Name

Music Ministry

### Subtitle

Schedule worship teams

### Promotional Text

Plan services, assign team members, track song selections, and send ministry reminders from one simple place.

### Keywords

church,worship,schedule,ministry,music,team,service,reminders,songs,volunteers,planning

### Description

Music Ministry helps church worship teams stay organized from service planning to Sunday morning.

Create services, assign members to roles, manage unavailable dates, prepare future schedules, and keep everyone informed with reminders and fill-in requests. Admins can manage church members, roles, recurring services, song types, reminder settings, and scheduling permissions. Members can view their assignments, mark unavailable dates, request a fill-in, and add song selections for each service.

Key features:

- Service schedules for worship and music teams
- Role-based member assignments
- Admin tools for recurring services and quarterly planning
- Auto-assignment with availability checks and load distribution
- Push reminders before scheduled services
- Fill-in requests for members with matching roles
- Song selection notes by service
- In-app notification history
- Member unavailability calendar
- Account deletion and password reset support

Music Ministry is built for churches that need a clear, practical way to coordinate the people, songs, and details behind each service.

### What's New

Improved account flows, password reset support, schedule tools, song selection management, notification history, and launch-ready polish for iOS and Android.

### App Review Notes

Music Ministry requires an account because schedules and assignments are private to each church. Please use the demo account below to review the app:

- Email: [ADD DEMO EMAIL]
- Password: [ADD DEMO PASSWORD]

Suggested review path:

1. Sign in with the demo account.
2. Open Schedules to view service assignments, song entries, notifications, and fill-in request actions.
3. Open Profile to review unavailable date selection, sign out, and account deletion access.
4. If the demo account is an admin, open Church to review member, role, recurring service, notification, and song type management.

Notes for review:

- Push notifications are used for service reminders, fill-in requests, fill-in accepted alerts, and song/comment notifications.
- Location permission is not used by the app directly. A location purpose string is present because a notification dependency may reference location APIs.
- The app does not use non-exempt encryption beyond standard HTTPS/TLS.

### URLs To Provide

- Privacy Policy URL: [ADD URL]
- Support URL: [ADD URL]
- Marketing URL: [OPTIONAL URL]

## Google Play

### App Name

Music Ministry

### Short Description

Schedule worship teams, songs, reminders, and fill-in requests

### Full Description

Music Ministry helps church worship and music teams plan services, assign members, manage song selections, and stay informed.

Admins can create church schedules, manage roles, assign members, prepare upcoming services, configure reminder times, and customize song types. Members can see where they are assigned, mark unavailable dates, add songs for a service, receive reminders, and request a fill-in when they cannot serve.

Features:

- Build and manage church service schedules
- Assign worship team members by role
- Track member availability
- Prepare future service blocks
- Send service reminder notifications
- Request fill-ins from matching roles
- Notify admins when fill-in requests happen
- Add, edit, and delete song selections by service
- View received notifications from the schedule bell
- Reset passwords and delete accounts

Music Ministry gives churches a focused scheduling workspace for the weekly details that keep worship teams coordinated.

### Data Safety Draft

Use this as a starting point in Play Console. Verify it against your exact Supabase, OneSignal, and account policies before final submission.

- Data collected: name, email address, user IDs, church/team membership, role assignments, service schedules, unavailable dates, notification subscriptions, song selections, app interaction records needed for notifications.
- Purpose: account management, app functionality, notifications, scheduling, security, and support.
- Shared with service providers: Supabase for authentication/database/functions and OneSignal for push notification delivery.
- Data encrypted in transit: yes, via HTTPS/TLS.
- Users can request account deletion: yes, in Profile.
- Ads: no.
- In-app purchases: no.

## Privacy Policy Points To Include

Your privacy policy should explain:

- What account data you collect, including name and email.
- What church scheduling data is stored, including roles, services, assignments, unavailable dates, notification preferences, and song selections.
- That Supabase stores authentication and app data.
- That OneSignal is used to deliver push notifications.
- How users can delete their account from the Profile tab.
- How users can contact you for support or data questions.
- That the app does not sell user data.
- That location is not used by the app.
