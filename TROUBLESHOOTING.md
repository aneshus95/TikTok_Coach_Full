# 🆘 TROUBLESHOOTING GUIDE INDEX

## Quick Links to All Fixes

This folder contains detailed guides for every issue you might encounter.

---

## 📋 Setup Issues

### 1. Node.js Version Issues
- **FIX_ANACONDA_NODEJS.md** - Anaconda has old Node.js
- Use regular Command Prompt, not Anaconda

### 2. Python Version Issues  
- **FIX_PYTHON_VERSION.md** - Python 3.14 compatibility
- Install Python 3.12 instead

### 3. Port Already in Use
- **FIX_PORT_8081.md** - Metro bundler port conflict
- Kill process and restart

### 4. Android SDK Path Issues
- **FIX_LOCAL_PROPERTIES.md** - Trailing char < > error
- Create correct local.properties file

---

## 🤖 Android Issues

### 5. No Android Folder
- **COMPLETE_SETUP_FROM_SCRATCH.md** - Missing android/ directory
- Must run `npx react-native init` first

### 6. No Connected Devices
- **START_ANDROID_EMULATOR.md** - How to start emulator
- Use Android Studio Device Manager

### 7. App Won't Launch
- **FIX_APP_LAUNCH.md** - Build succeeds but app doesn't open
- Manual launch methods

---

## 🎯 Complete Setup

### 8. Step-by-Step Setup
- **EXACT_SETUP_COMMANDS.md** - Copy-paste commands
- All commands in order

### 9. Full Setup Guide
- **README.md** - Complete setup instructions
- Start here if first time

---

## 🔍 How to Use These Guides

1. **Identify your error message**
2. **Find matching guide** from list above
3. **Follow the fix** in that guide
4. **Continue with setup**

---

## ⚡ Quick Fixes (Most Common)

### Error: "styleText is not a function"
→ **FIX_ANACONDA_NODEJS.md**
- Use Regular CMD, not Anaconda

### Error: "Port 8081 already in use"
→ **FIX_PORT_8081.md**
```cmd
for /f "tokens=5" %a in ('netstat -aon ^| findstr :8081') do taskkill /PID %a /F
```

### Error: "Python metaclass error"
→ **FIX_PYTHON_VERSION.md**
- Install Python 3.12

### Error: "Trailing char < >"
→ **FIX_LOCAL_PROPERTIES.md**
```cmd
echo sdk.dir=C:\\Users\\anesh\\AppData\\Local\\Android\\Sdk > android\local.properties
```

### Error: "Android project not found"
→ **COMPLETE_SETUP_FROM_SCRATCH.md**
- Run `npx react-native init` first

### Error: "No connected devices"
→ **START_ANDROID_EMULATOR.md**
- Start emulator in Android Studio

### Build succeeds but app doesn't open
→ **FIX_APP_LAUNCH.md**
- Manually tap app icon on emulator

---

## 📞 Still Need Help?

1. Read the specific guide for your error
2. Check you followed all prerequisites
3. Verify correct versions (Node v20+, Python 3.12)
4. Make sure using Regular CMD (not Anaconda)

---

**All guides are in this folder - just open the one you need!** 🚀
