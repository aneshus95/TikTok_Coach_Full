# 🚀 TikTok Viral Coach - EXACT SETUP GUIDE

## ⚡ STEP-BY-STEP INSTRUCTIONS (No Confusion!)

Follow these steps EXACTLY as written.

---

## 📋 Prerequisites

1. **Node.js v20+** (Download: https://nodejs.org/)
2. **Python 3.12** (Download: https://www.python.org/downloads/release/python-3120/)
3. **Android Studio** (Download: https://developer.android.com/studio)
4. **Google Gemini API Key** (Get: https://ai.google.dev/)

---

## 🎯 SETUP (Copy-Paste Each Command)

### STEP 1: Extract This ZIP

1. **Download** `TIKTOK_VIRAL_COACH_FINAL.zip`
2. **Right-click** → Extract All
3. **Extract to:** `D:\tiktok-final\`

You should now have:
```
D:\tiktok-final\
├── TikTokViralCoach\
│   ├── src\
│   ├── App.tsx
│   ├── package.json
│   └── ... (all mobile app files)
└── backend\
    ├── app.py
    ├── requirements.txt
    └── .env.example
```

---

### STEP 2: Create React Native Project

Open **Regular Command Prompt** (Press Win+R, type `cmd`, Enter):

```cmd
cd D:\

npx react-native@0.72.7 init TikTokViralCoach --version 0.72.7
```

⏰ **WAIT 10 MINUTES** - Let it complete fully!

You'll see: `✔ Successfully created TikTokViralCoach`

Now you have:
```
D:\TikTokViralCoach\
├── android\        ← Created by init command
├── node_modules\   ← Created by init command
├── App.tsx         ← Default file (we'll replace)
└── ... (default files)
```

---

### STEP 3: Replace Default Files with Your Code

```cmd
cd D:\

REM Delete default App.tsx
del TikTokViralCoach\App.tsx

REM Copy YOUR App.tsx
copy tiktok-final\TikTokViralCoach\App.tsx TikTokViralCoach\App.tsx

REM Copy src folder
xcopy tiktok-final\TikTokViralCoach\src TikTokViralCoach\src /E /I /Y

REM Copy config files (REPLACE defaults)
copy tiktok-final\TikTokViralCoach\package.json TikTokViralCoach\package.json /Y
copy tiktok-final\TikTokViralCoach\index.js TikTokViralCoach\index.js /Y
copy tiktok-final\TikTokViralCoach\app.json TikTokViralCoach\app.json /Y
copy tiktok-final\TikTokViralCoach\babel.config.js TikTokViralCoach\babel.config.js /Y
copy tiktok-final\TikTokViralCoach\metro.config.js TikTokViralCoach\metro.config.js /Y
```

---

### STEP 4: Configure Android SDK

```cmd
cd D:\TikTokViralCoach

echo sdk.dir=C:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk > android\local.properties
```

This automatically uses your Windows username!

---

### STEP 5: Install Mobile Dependencies

```cmd
cd D:\TikTokViralCoach

npm install --legacy-peer-deps
```

Wait 3-5 minutes.

---

### STEP 6: Setup Backend

```cmd
cd D:\tiktok-final\backend

REM Create virtual environment
python -m venv venv

REM Activate it
venv\Scripts\activate

REM Install dependencies
pip install -r requirements.txt

REM Create .env file
copy .env.example .env
```

**Now edit the .env file:**

1. Open Notepad
2. Open file: `D:\tiktok-final\backend\.env`
3. Change `GOOGLE_API_KEY=your_actual_gemini_api_key_here` to your real key
4. Save and close

---

### STEP 7: Start Android Emulator

1. Open **Android Studio**
2. Click **"More Actions"** → **"Device Manager"**
3. Click **▶️ Play button** next to any device
4. **Wait 2 minutes** for emulator to fully boot (you'll see Android home screen)

---

### STEP 8: Run Everything (3 Terminals)

#### Terminal 1 - Backend

```cmd
cd D:\tiktok-final\backend
venv\Scripts\activate
python app.py
```

Should show:
```
* Running on http://127.0.0.1:5000
```

**Keep this terminal open!**

---

#### Terminal 2 - Metro Bundler

Open **NEW** Command Prompt:

```cmd
cd D:\TikTokViralCoach
npm start
```

Should show:
```
Welcome to Metro!
Server running on http://localhost:8081
```

**Keep this terminal open!**

---

#### Terminal 3 - Run Android App

Open **NEW** Command Prompt:

```cmd
cd D:\TikTokViralCoach
npx react-native run-android
```

Wait 5-10 minutes for first build.

You'll see:
```
BUILD SUCCESSFUL in 8m 32s
Installing APK...
```

---

### STEP 9: Launch the App

**If app doesn't auto-launch:**

1. Look at your **Android emulator**
2. **Swipe up** from bottom (opens app drawer)
3. Find **"TikTok Viral Coach"**
4. **Tap the icon**

App opens! 🎉

---

## 📁 Final Folder Structure

After completing all steps:

```
D:\
├── TikTokViralCoach\              [MAIN PROJECT]
│   ├── android\                  [Android build files]
│   ├── node_modules\             [Dependencies]
│   ├── src\                      [YOUR CODE]
│   │   ├── screens\             [7 screens]
│   │   ├── services\            [API service]
│   │   └── theme.ts
│   ├── App.tsx                   [YOUR CODE]
│   ├── package.json              [YOUR CONFIG]
│   └── ... (config files)
│
└── tiktok-final\                  [EXTRACTED ZIP]
    ├── TikTokViralCoach\         [Source code]
    └── backend\                  [Backend API]
        ├── venv\                 [Virtual environment]
        ├── app.py
        └── .env                  [Your API key]
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `D:\TikTokViralCoach\android\` folder exists
- [ ] `D:\TikTokViralCoach\src\screens\` has 7 .tsx files
- [ ] `D:\tiktok-final\backend\.env` has your API key
- [ ] Terminal 1 shows "Running on http://127.0.0.1:5000"
- [ ] Terminal 2 shows "Server running on http://localhost:8081"
- [ ] Terminal 3 shows "BUILD SUCCESSFUL"
- [ ] Android emulator is running
- [ ] App icon visible on emulator

---

## 🆘 Common Issues

### "Android project not found"
**Cause:** Didn't run `npx react-native init` in STEP 2
**Fix:** Go back to STEP 2

### "Port 8081 already in use"
```cmd
for /f "tokens=5" %a in ('netstat -aon ^| findstr :8081') do taskkill /PID %a /F
npm start
```

### "No connected devices"
**Cause:** Emulator not running
**Fix:** Start emulator in Android Studio (STEP 7)

### "styleText is not a function"
**Cause:** Using Anaconda Prompt
**Fix:** Use Regular Command Prompt

### App builds but doesn't launch
**Fix:** Manually tap app icon on emulator

---

## 🎯 Quick Reference

**3 Terminals Running:**

1. Backend: `D:\tiktok-final\backend\` → `python app.py`
2. Metro: `D:\TikTokViralCoach\` → `npm start`
3. Android: `D:\TikTokViralCoach\` → `npx react-native run-android`

**Main Folders:**
- **D:\TikTokViralCoach\** - React Native project (has android/ folder)
- **D:\tiktok-final\backend\** - Flask backend API

---

## 📱 Testing the App

1. Open app on emulator
2. Tap "Get Started"
3. Enter niche: "GRWM"
4. Choose video count: 10
5. Tap "Start Analysis"
6. Wait 2-5 minutes
7. View AI coaching
8. Chat with AI

---

## ✅ Success!

You now have:
- ✅ Working React Native app
- ✅ Backend API running
- ✅ App on Android emulator
- ✅ Ready to test and develop

---

**Need help? Check TROUBLESHOOTING.md in the ZIP!** 🚀
