# 🚀 EXACT COMMANDS - Create React Native Project with Android

## Copy-Paste These Commands ONE BY ONE

### Step 1: Open Regular Command Prompt

Press `Win + R`, type `cmd`, press Enter

### Step 2: Navigate and Create Project

```cmd
cd D:\tiktok

npx react-native@0.72.7 init TikTokViralCoach --version 0.72.7
```

**WAIT 5-10 MINUTES** for this to complete. You'll see:
- "Downloading template"
- "Copying template"
- "Installing dependencies"
- "Success! Created TikTokViralCoach"

**DO NOT INTERRUPT THIS PROCESS**

### Step 3: Verify Android Folder Exists

```cmd
cd TikTokViralCoach
dir
```

You should see:
```
android          <-- This folder MUST exist
ios              <-- This too
node_modules
App.tsx
package.json
```

If you see `android` folder, SUCCESS! ✅

### Step 4: Copy Your Custom Code

Now copy your files FROM your old location TO the new project:

```cmd
# You'll need to manually copy these files:
# FROM: D:\tiktok\tiktok-viral-coach-app\mobile\
# TO:   D:\tiktok\TikTokViralCoach\

# Copy these:
# - App.tsx
# - src\ folder (entire folder)
```

**How to copy:**
1. Open File Explorer
2. Navigate to `D:\tiktok\tiktok-viral-coach-app\mobile\`
3. Copy `App.tsx` → Paste to `D:\tiktok\TikTokViralCoach\`
4. Copy `src\` folder → Paste to `D:\tiktok\TikTokViralCoach\`

### Step 5: Update package.json

Open `D:\tiktok\TikTokViralCoach\package.json` in Notepad

Replace the "dependencies" section with:

```json
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.7",
    "react-native-paper": "5.11.0",
    "@react-navigation/native": "6.1.9",
    "@react-navigation/stack": "6.3.20",
    "react-native-gesture-handler": "2.14.0",
    "react-native-reanimated": "3.6.0",
    "react-native-safe-area-context": "4.8.0",
    "react-native-screens": "3.29.0",
    "axios": "1.6.2",
    "@react-native-async-storage/async-storage": "1.21.0"
  }
```

Save and close.

### Step 6: Install Dependencies

```cmd
npm install --legacy-peer-deps
```

Wait 3-5 minutes.

### Step 7: Start Android Emulator

**Option A: Use Android Studio**
1. Open Android Studio
2. Tools → Device Manager
3. Create device if you don't have one
4. Click ▶️ to start emulator

**Option B: Command line**
```cmd
emulator -list-avds
emulator -avd Pixel_5_API_33
```

Wait for emulator to fully boot (you'll see home screen).

### Step 8: Run Metro Bundler

```cmd
npm start
```

Keep this terminal open. You should see:
```
Welcome to Metro!
Server running on http://localhost:8081
```

### Step 9: Run on Android (NEW Terminal)

Open **NEW** Command Prompt:

```cmd
cd D:\tiktok\TikTokViralCoach

npx react-native run-android
```

Wait 5-10 minutes for first build.

You'll see:
```
Building...
Installing APK...
Starting app...
```

App will open on emulator! 🎉

---

## ✅ What This Does

The `npx react-native init` command creates:
```
TikTokViralCoach/
├── android/          ← Android project (REQUIRED)
├── ios/              ← iOS project (Mac only)
├── node_modules/     ← Dependencies
├── App.tsx           ← Main app
├── index.js          ← Entry point
├── package.json      ← Config
└── metro.config.js   ← Bundler config
```

Without the `android/` folder, you CANNOT build Android apps.

---

## 🆘 If Step 2 Fails

### Error: "npx: command not found"

```cmd
npm install -g npx
```

Try again.

### Error: "Network timeout"

```cmd
npm config set registry https://registry.npmjs.org/
```

Try again.

### Error: "Permission denied"

Run Command Prompt as Administrator:
1. Search "cmd"
2. Right-click → Run as Administrator
3. Try again

---

## 🔍 Verify You're in Right Folder

Before running `npx react-native run-android`, check:

```cmd
cd D:\tiktok\TikTokViralCoach
dir android
```

If you see files in `android/` folder, you're good! ✅

If you get "File Not Found", you're in wrong folder or didn't run `npx react-native init`.

---

## 📋 Full Command Summary

```cmd
# 1. Create project (REQUIRED - DO THIS FIRST)
cd D:\tiktok
npx react-native@0.72.7 init TikTokViralCoach --version 0.72.7

# 2. Wait for completion (5-10 minutes)

# 3. Copy your custom files (App.tsx, src/)

# 4. Install dependencies
cd TikTokViralCoach
npm install --legacy-peer-deps

# 5. Start emulator (Android Studio)

# 6. Start Metro
npm start

# 7. Run Android (NEW terminal)
npx react-native run-android
```

---

## ⚠️ CRITICAL: You MUST Run `npx react-native init`

Without this command, you don't have:
- ❌ android/ folder
- ❌ Build system
- ❌ Project structure

You CANNOT skip this step!

---

## ✅ After Success

Once app runs on emulator:

**Backend (Terminal 1):**
```cmd
cd D:\tiktok\tiktok-viral-coach-app\backend
venv\Scripts\activate
python app.py
```

**Mobile Metro (Terminal 2):**
```cmd
cd D:\tiktok\TikTokViralCoach
npm start
```

**Mobile Android (Terminal 3):**
```cmd
cd D:\tiktok\TikTokViralCoach
npx react-native run-android
```

---

Start with Step 1 and follow exactly! The key is running `npx react-native init` first! 🚀
