# 🔧 Fix: Port 8081 Already in Use

## The Problem
Metro bundler is already running on port 8081 (probably from a previous attempt).

## ✅ SOLUTIONS (Choose One)

---

## Solution 1: Kill the Process (Recommended)

### Find and Kill Process on Port 8081

**Windows:**
```cmd
# Find process using port 8081
netstat -ano | findstr :8081

# You'll see something like:
# TCP    0.0.0.0:8081           0.0.0.0:0              LISTENING       12345

# Kill it (replace 12345 with your PID)
taskkill /PID 12345 /F
```

**Quick One-Liner:**
```cmd
for /f "tokens=5" %a in ('netstat -aon ^| findstr :8081') do taskkill /PID %a /F
```

Then run:
```cmd
npm start
```

---

## Solution 2: Use Different Port

Start Metro on a different port:

```cmd
npm start -- --port 8082
```

Keep this running, then in **NEW terminal**:
```cmd
npx react-native run-android
```

Metro will automatically use port 8082.

---

## Solution 3: Close All Node Processes

Close everything and restart:

```cmd
# Kill all node processes
taskkill /IM node.exe /F

# Wait 5 seconds, then start again
npm start
```

---

## Solution 4: Restart Computer

If nothing else works:
1. Restart your computer
2. Try `npm start` again

---

## 🎯 Quick Fix Commands (Copy-Paste)

```cmd
REM Kill process on port 8081
for /f "tokens=5" %a in ('netstat -aon ^| findstr :8081') do taskkill /PID %a /F

REM Start Metro
npm start
```

---

## ⚠️ Common Causes

1. **Previous Metro still running** - Kill it with taskkill
2. **Other app using port 8081** - Use different port
3. **Crashed Metro process** - Kill all node.exe

---

## ✅ After Fixing

Once Metro starts successfully, you'll see:

```
Welcome to Metro!
  Fast - Scalable - Integrated

Server listening on http://localhost:8081
```

Then open **NEW terminal** and run:
```cmd
npx react-native run-android
```

---

## 🆘 If Port Issue Persists

**Check what's using the port:**
```cmd
netstat -ano | findstr :8081
```

**Check all node processes:**
```cmd
tasklist | findstr node.exe
```

**Kill ALL node processes:**
```cmd
taskkill /IM node.exe /F
```

---

Try Solution 1 first! 🚀
