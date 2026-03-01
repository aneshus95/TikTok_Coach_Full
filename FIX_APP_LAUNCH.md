# 🔧 Fix: App Won't Launch After Install

## The Good News

✅ **BUILD SUCCESSFUL** - App compiled and installed!
✅ App is on your emulator
❌ Just failed to auto-launch

---

## ⚡ QUICK FIX - Manual Launch

### Method 1: Launch Manually on Emulator

**On your Android emulator:**
1. Look for "TikTok Viral Coach" app icon
2. **Tap the icon** to open the app
3. Done! 🎉

The app is installed, it just didn't auto-launch.

---

### Method 2: Launch via Command

```cmd
# Check if app is installed
adb shell pm list packages | findstr tiktok

# You should see:
# package:com.tiktokviralcoachtemp

# Launch the app manually
adb shell am start -n com.tiktokviralcoachtemp/.MainActivity
```

If you get an error, try:
```cmd
adb shell monkey -p com.tiktokviralcoachtemp 1
```

---

### Method 3: Run with Verbose Flag

Get more details about what's failing:

```cmd
npx react-native run-android --verbose
```

Look for the actual error message in the output.

---

## 🔍 Check What's Wrong

### Step 1: Verify App is Installed

```cmd
adb shell pm list packages | findstr tiktok
```

Should show: `package:com.tiktokviralcoachtemp`

### Step 2: Check LogCat for Errors

```cmd
adb logcat | findstr "MainActivity"
```

This shows real-time logs. Look for error messages.

### Step 3: Check if Metro Bundler is Running

In your Metro terminal, you should see:
```
Welcome to Metro!
Server running on http://localhost:8081
```

If not running:
```cmd
npm start
```

---

## 🎯 Most Common Causes & Fixes

### Issue 1: Metro Bundler Not Running

**Fix:**
```cmd
# Terminal 1 - Start Metro
npm start

# Terminal 2 - Launch app manually
adb shell am start -n com.tiktokviralcoachtemp/.MainActivity
```

### Issue 2: Wrong Package Name in MainActivity

**Check AndroidManifest.xml:**
```cmd
type android\app\src\main\AndroidManifest.xml | findstr package
```

Should show: `package="com.tiktokviralcoachtemp"`

**If it shows `com.tiktokviralcoach` (without temp), that's the issue!**

**Fix:**
Open `android\app\src\main\AndroidManifest.xml`
Change package to: `package="com.tiktokviralcoachtemp"`

Then rebuild:
```cmd
cd android
gradlew clean
cd ..
npx react-native run-android
```

### Issue 3: MainActivity.java Has Wrong Package

**Check:**
```cmd
type android\app\src\main\java\com\tiktokviralcoachtemp\MainActivity.java
```

First line should be:
```java
package com.tiktokviralcoachtemp;
```

If it says `package com.tiktokviralcoach;`, change it!

### Issue 4: App Crashes on Launch

**Check crash logs:**
```cmd
adb logcat *:E
```

Look for crash messages.

---

## ✅ COMPLETE FIX - Ensure Everything Matches

### Step 1: Verify All Package Names Match

**Check these files all say `com.tiktokviralcoachtemp`:**

1. **android/app/build.gradle:**
   ```gradle
   defaultConfig {
       applicationId "com.tiktokviralcoachtemp"
   ```

2. **android/app/src/main/AndroidManifest.xml:**
   ```xml
   <manifest package="com.tiktokviralcoachtemp">
   ```

3. **android/app/src/main/java/com/tiktokviralcoachtemp/MainActivity.java:**
   ```java
   package com.tiktokviralcoachtemp;
   ```

4. **android/app/src/main/java/com/tiktokviralcoachtemp/MainApplication.java:**
   ```java
   package com.tiktokviralcoachtemp;
   ```

### Step 2: Verify Java Folder Structure

```cmd
dir android\app\src\main\java\com\
```

Should show folder: `tiktokviralcoachtemp`

### Step 3: Clean and Rebuild

```cmd
cd android
gradlew clean
cd ..

# Uninstall old app
adb uninstall com.tiktokviralcoachtemp

# Rebuild
npx react-native run-android
```

---

## 🚀 Alternative: Just Launch It Manually

Since the app is already installed:

**On Emulator:**
1. Open app drawer (swipe up from bottom)
2. Find "TikTok Viral Coach"
3. Tap to open

**Or use command:**
```cmd
adb shell monkey -p com.tiktokviralcoachtemp -c android.intent.category.LAUNCHER 1
```

---

## 🔧 Debug Mode Launch

```cmd
# Start Metro
npm start

# In new terminal, uninstall and reinstall
adb uninstall com.tiktokviralcoachtemp
npx react-native run-android --variant=debug

# If it installs but doesn't launch, manually launch:
adb shell am start -n com.tiktokviralcoachtemp/.MainActivity
```

---

## 📱 Check App Status

```cmd
# Is app installed?
adb shell pm list packages | findstr tiktok

# Get app info
adb shell dumpsys package com.tiktokviralcoachtemp | findstr Activity

# Try to launch
adb shell am start com.tiktokviralcoachtemp/.MainActivity
```

---

## ✅ Quick Test

Try this simple command:
```cmd
adb shell am start com.tiktokviralcoachtemp/com.tiktokviralcoachtemp.MainActivity
```

If you see:
```
Starting: Intent { ... }
```

Good! Check your emulator - app should open.

If you see error, run with full package path:
```cmd
adb shell am start -n com.tiktokviralcoachtemp/.MainActivity -a android.intent.action.MAIN -c android.intent.category.LAUNCHER
```

---

## 🎯 Most Likely Solution

**The app is installed.** Just open it manually on the emulator!

1. Look at your emulator screen
2. Swipe up to see all apps
3. Find "TikTok Viral Coach"
4. Tap it

**OR:**

Make sure Metro is running, then manually launch:
```cmd
# Terminal 1 - Metro
npm start

# Terminal 2 - Launch app
adb shell monkey -p com.tiktokviralcoachtemp 1
```

---

The app is on your device - just needs to be launched! Try the manual launch methods above! 🚀
