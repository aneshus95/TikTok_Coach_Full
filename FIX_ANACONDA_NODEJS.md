# 🔧 Fix Anaconda Node.js Version Issue

## The Problem
- **Command Prompt:** Node.js v25+ ✅
- **Anaconda Prompt:** Node.js v18.12.1 ❌

Anaconda has its own old Node.js and overrides your system version.

---

## ✅ SOLUTION 1: Don't Use Anaconda Prompt (Easiest)

### Use Regular Command Prompt Instead

1. **Open Windows Command Prompt** (not Anaconda)
   - Press `Win + R`
   - Type `cmd`
   - Press Enter

2. **Verify Node version:**
   ```cmd
   node --version
   ```
   Should show: `v25.x.x` ✅

3. **Navigate to your project:**
   ```cmd
   cd C:\Users\anesh\tiktok-viral-coach-app\mobile
   ```

4. **Run your commands:**
   ```cmd
   npm install
   npx react-native run-android
   ```

**This is the simplest solution - just don't use Anaconda Prompt for React Native!**

---

## ✅ SOLUTION 2: Update Node.js in Anaconda

If you must use Anaconda Prompt:

### Option A: Install Node in Conda Environment

```cmd
# Activate your conda environment
conda activate base

# Install latest Node.js
conda install -c conda-forge nodejs=20

# Verify
node --version
```

### Option B: Remove Conda's Node.js (Use System Node)

```cmd
# Remove conda's Node.js
conda remove nodejs

# Now it will use system Node.js (v25)
node --version
```

---

## ✅ SOLUTION 3: Modify PATH Priority

Make system Node.js take priority over Anaconda's:

### Step 1: Find System Node.js Path

In regular Command Prompt:
```cmd
where node
```

You'll see something like:
```
C:\Program Files\nodejs\node.exe
C:\Users\anesh\anaconda3\node.exe
```

### Step 2: Edit Environment Variables

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click "Advanced" tab
3. Click "Environment Variables"
4. Under "System variables", find "Path"
5. Click "Edit"
6. **Move** `C:\Program Files\nodejs` to the **TOP** of the list
7. Make sure it's **ABOVE** any Anaconda paths
8. Click OK, OK, OK

### Step 3: Restart Anaconda Prompt

Open **NEW** Anaconda Prompt:
```cmd
node --version
```

Should now show: `v25.x.x` ✅

---

## 🎯 RECOMMENDED APPROACH

### For Backend (Python):
✅ **Use Anaconda Prompt**

```cmd
cd backend
conda activate
python app.py
```

### For Mobile (React Native):
✅ **Use Regular Command Prompt**

```cmd
cd mobile
npm start
```

**Keep them separate!** This avoids conflicts.

---

## 📋 Quick Setup Guide (Using Both)

### Terminal 1 - Backend (Anaconda Prompt)
```cmd
cd C:\Users\anesh\tiktok-viral-coach-app\backend
conda activate base
pip install -r requirements.txt
python app.py
```

### Terminal 2 - Mobile Metro (Regular CMD)
```cmd
cd C:\Users\anesh\tiktok-viral-coach-app\mobile
npm start
```

### Terminal 3 - Mobile Run (Regular CMD)
```cmd
cd C:\Users\anesh\tiktok-viral-coach-app\mobile
npx react-native run-android
```

---

## ✅ Why This Happens

Anaconda includes its own:
- Python ✅ (good)
- Node.js ❌ (old, causes conflicts)
- npm ❌ (old version)

**Solution:** Use Anaconda for Python, Regular CMD for Node.js

---

## 🧪 Test Your Setup

### In Anaconda Prompt:
```cmd
python --version
# Should show Python 3.x from Anaconda ✅
```

### In Regular Command Prompt:
```cmd
node --version
# Should show v25.x.x ✅

npm --version
# Should show v10+ ✅
```

---

## 🎯 Final Answer

**For React Native development:**

1. ❌ Don't use Anaconda Prompt
2. ✅ Use Regular Windows Command Prompt
3. ✅ Or use PowerShell
4. ✅ Or use Windows Terminal

**Your Node.js v25 is installed correctly - just use the right terminal!**

---

## 💡 Pro Tip

Install Windows Terminal (free from Microsoft Store):
- Better than Command Prompt
- Has tabs
- Can run both CMD and PowerShell
- More modern

---

## ⚡ Quick Commands (Regular CMD)

```cmd
# Clean install
cd C:\Users\anesh\tiktok-viral-coach-app\mobile
rmdir /s /q node_modules
del package-lock.json
npm cache clean --force
npm install

# Run
npm start
# New terminal:
npx react-native run-android
```

**No more styleText error!** 🎉

---

That's it! Use Regular Command Prompt for React Native, not Anaconda Prompt! ✅
