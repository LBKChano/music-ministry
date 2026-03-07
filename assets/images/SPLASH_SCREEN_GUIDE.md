
# Splash Screen Setup Guide

## Current Issue
The app.json is configured to use a splash screen image, but the file doesn't exist yet. This causes build errors.

## Solution: Add Your Splash Screen Image

### Step 1: Create Your Splash Screen Image

**Required Specifications:**
- **Format:** PNG (with NO transparency - must have solid background)
- **Minimum Size:** 1242x2436 pixels (iPhone 13 Pro Max resolution)
- **Recommended Size:** 2048x2732 pixels (for best quality across all devices)
- **File Size:** Under 1MB
- **Background:** Solid color (no alpha channel/transparency)

**Design Guidelines:**
- Use a solid background color (e.g., #1E3A8A navy blue)
- Center your logo/icon in the middle
- Leave safe margins (at least 200px from edges)
- The image will be scaled to fit all iPhone sizes automatically

### Step 2: Save Your Image

Save your splash screen image as:
```
assets/images/splash.png
```

**Important:** The filename must be exactly `splash.png` (lowercase, no spaces)

### Step 3: Update app.json

Once you have your splash.png file in assets/images/, update app.json:

```json
{
  "expo": {
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1E3A8A"
    },
    "ios": {
      "splash": {
        "image": "./assets/images/splash.png",
        "resizeMode": "contain",
        "backgroundColor": "#1E3A8A"
      }
    },
    "android": {
      "splash": {
        "image": "./assets/images/splash.png",
        "resizeMode": "contain",
        "backgroundColor": "#1E3A8A"
      }
    }
  }
}
```

### Step 4: How It Adjusts for All iPhones

The `resizeMode: "contain"` setting ensures your splash screen works on ALL iPhone sizes:

- **iPhone SE (small):** Image scales down to fit
- **iPhone 13/14 (standard):** Image displays at optimal size
- **iPhone 13/14 Pro Max (large):** Image scales to fit larger screen
- **iPhone 15 Pro Max (extra large):** Image scales to fit

The `backgroundColor` fills any empty space around your image, creating a seamless look.

### Resize Modes Explained:

- **"contain"** (Recommended): Scales image to fit screen while maintaining aspect ratio. Shows entire image.
- **"cover"**: Scales image to fill screen, may crop edges on some devices.
- **"native"**: No scaling, shows image at original size (not recommended).

## Current Temporary Setup

Until you add your custom splash screen:
- The app uses the app icon (./assets/icon.png) as a temporary splash screen
- Background color is set to #1E3A8A (navy blue)
- This prevents build errors

## Design Tools

Create your splash screen using:
- **Canva** (easiest, has templates)
- **Figma** (free, professional)
- **Adobe Photoshop/Illustrator**
- **Online tools:** Remove.bg (for transparent backgrounds), TinyPNG (for compression)

## Common Mistakes to Avoid

❌ **Transparent background** - iOS requires solid background
❌ **Wrong file name** - Must be exactly "splash.png"
❌ **File too large** - Keep under 1MB
❌ **Wrong path** - Must be in assets/images/ folder
❌ **Spaces in filename** - "iOS Splash.png" causes errors, use "splash.png"

## Testing Your Splash Screen

After adding your splash.png:
1. Restart the Expo development server
2. Clear app cache if needed
3. Test on multiple device sizes in simulator/emulator
4. Verify it looks good on both light and dark mode devices

## Need Help?

If you're having trouble creating the image:
1. Start with your app icon
2. Place it on a solid colored background (2048x2732px)
3. Export as PNG with no transparency
4. Save as assets/images/splash.png
