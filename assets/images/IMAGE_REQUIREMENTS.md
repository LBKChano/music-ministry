
# Image Requirements for Music Ministry App

## 🚨 CRITICAL: Splash Screen Issue

**Current Problem:** The app is looking for "iOS Splash.png" but the file doesn't exist, causing build errors.

**Quick Fix:** 
1. Create a splash screen image (see specifications below)
2. Save it as: `assets/images/splash.png` (lowercase, no spaces!)
3. Update app.json to reference `./assets/images/splash.png`

---

## Splash Screen (splash.png)

### Technical Requirements (MUST FOLLOW):
- **Format:** PNG
- **Size:** 2048x2732 pixels (recommended) or minimum 1242x2436 pixels
- **Background:** SOLID COLOR - NO TRANSPARENCY (iOS requirement)
- **File Size:** Under 1MB
- **Filename:** `splash.png` (lowercase, no spaces)
- **Location:** `assets/images/splash.png`

### Design Specifications:
- **Background Color:** Navy Blue (#1E3A8A) or your brand color
- **Logo/Icon:** Centered, approximately 400x400px
- **Safe Area:** Keep important content 200px from edges
- **Text:** Optional app name below logo (white or light color)

### Why These Specs Matter:
- **2048x2732px:** Covers all iPhone sizes from SE to Pro Max
- **No Transparency:** iOS splash screens require solid backgrounds
- **resizeMode: "contain":** Automatically scales for all devices
- **backgroundColor:** Fills empty space on different screen ratios

### How It Adjusts for All iPhones:
The `resizeMode: "contain"` setting in app.json ensures your splash screen automatically adjusts:
- **iPhone SE (1334x750):** Scales down proportionally
- **iPhone 13 (2532x1170):** Optimal display
- **iPhone 14 Pro Max (2796x1290):** Scales to fit
- **All sizes:** Maintains aspect ratio, no distortion

---

## App Icon (icon.png)

### Current Status: ✅ EXISTS
- Location: `assets/icon.png`
- Size: 1024x1024 pixels
- Format: PNG

### If You Need to Replace:
- **Size:** 1024x1024 pixels (required)
- **Format:** PNG with transparency OK
- **Design:** Simple, recognizable at small sizes
- **Background:** Can be transparent or solid

---

## Design Resources

### Free Tools:
- **Canva:** Easiest, has splash screen templates
- **Figma:** Professional, free tier available
- **Photopea:** Free Photoshop alternative (online)

### Quick Start Template:
1. Create 2048x2732px canvas
2. Fill with solid color (#1E3A8A navy blue)
3. Add your logo/icon in center (400x400px)
4. Add app name text below (optional)
5. Export as PNG
6. Save as `assets/images/splash.png`

### Icon Resources:
- **Icons:** Font Awesome, Material Icons, Flaticon
- **Colors:** Navy (#1E3A8A), Light Blue (#60A5FA), White (#FFFFFF)
- **Fonts:** Bold, clean sans-serif (Montserrat, Poppins, Inter)

---

## Common Errors & Solutions

### Error: "ENOENT: no such file or directory, open './assets/splash.png'"
**Solution:** The splash.png file doesn't exist. Create it following specs above.

### Error: "Splash screen image has transparency"
**Solution:** Remove alpha channel. Use solid background color.

### Error: "Image too large"
**Solution:** Compress to under 1MB using TinyPNG or similar tool.

### Error: "Splash screen looks stretched/distorted"
**Solution:** Use `resizeMode: "contain"` in app.json (already configured).

---

## Current Configuration

The app.json is currently using the app icon as a temporary splash screen to prevent build errors:

```json
"splash": {
  "image": "./assets/icon.png",
  "resizeMode": "contain",
  "backgroundColor": "#1E3A8A"
}
```

Once you add `assets/images/splash.png`, update app.json to:

```json
"splash": {
  "image": "./assets/images/splash.png",
  "resizeMode": "contain",
  "backgroundColor": "#1E3A8A"
}
```

---

## Testing Checklist

After adding your splash screen:
- [ ] File exists at `assets/images/splash.png`
- [ ] File is 2048x2732px (or minimum 1242x2436px)
- [ ] File has solid background (no transparency)
- [ ] File size is under 1MB
- [ ] app.json references correct path
- [ ] Restart Expo dev server
- [ ] Test on iOS simulator (multiple device sizes)
- [ ] Test on Android emulator
- [ ] Verify it looks good in both light and dark mode

---

## Need Help?

If you're stuck:
1. Use your existing app icon as a starting point
2. Place it on a 2048x2732px navy blue background
3. Export as PNG with no transparency
4. Save as `assets/images/splash.png`
5. Update app.json path
6. Restart the dev server

The splash screen will automatically scale and adjust for all iPhone sizes thanks to the `resizeMode: "contain"` configuration.
