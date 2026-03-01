# 🐍 Fix: Python 3.14 Compatibility Issue

## The Problem

```
TypeError: Metaclasses with custom tp_new are not supported.
```

**Python 3.14** is too new and has breaking changes with Google's libraries.

The `google-generativeai` package doesn't support Python 3.14 yet.

---

## ✅ SOLUTION: Use Python 3.11 or 3.12

### Option 1: Install Python 3.12 (Recommended)

1. **Download Python 3.12:**
   👉 https://www.python.org/downloads/release/python-3120/
   
   Click: "Windows installer (64-bit)"

2. **Install Python 3.12:**
   - Run installer
   - ✅ Check "Add Python 3.12 to PATH"
   - Click "Install Now"

3. **Verify Installation:**
   ```cmd
   python --version
   ```
   Should show: `Python 3.12.x`

4. **Recreate Virtual Environment:**
   ```cmd
   cd D:\tiktok\complete-codebase\backend
   
   # Remove old venv
   rmdir /s /q venv
   
   # Create new with Python 3.12
   python -m venv venv
   
   # Activate
   venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Run
   python app.py
   ```

---

## Option 2: Use Anaconda with Python 3.12

If you prefer Anaconda:

```cmd
# Create environment with Python 3.12
conda create -n tiktok python=3.12

# Activate
conda activate tiktok

# Navigate to backend
cd D:\tiktok\complete-codebase\backend

# Install dependencies
pip install -r requirements.txt

# Run
python app.py
```

---

## Option 3: Downgrade Protobuf (Quick Fix)

If you can't change Python version right now:

```cmd
cd D:\tiktok\complete-codebase\backend
venv\Scripts\activate

# Downgrade protobuf
pip uninstall protobuf -y
pip install protobuf==4.25.3

# Downgrade google-generativeai
pip uninstall google-generativeai -y
pip install google-generativeai==0.3.2

# Try running
python app.py
```

---

## 🎯 Recommended: Fresh Setup with Python 3.12

```cmd
# 1. Install Python 3.12 from python.org

# 2. Verify version
python --version
# Should show 3.12.x

# 3. Navigate to backend
cd D:\tiktok\complete-codebase\backend

# 4. Remove old virtual environment
rmdir /s /q venv

# 5. Create new venv with Python 3.12
python -m venv venv

# 6. Activate
venv\Scripts\activate

# 7. Upgrade pip
python -m pip install --upgrade pip

# 8. Install dependencies
pip install -r requirements.txt

# 9. Create .env file
copy .env.example .env
# Edit .env and add your GOOGLE_API_KEY

# 10. Run server
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

---

## 🔍 Why This Happens

**Python 3.14** introduced changes to metaclass handling that break many packages:
- google-generativeai
- protobuf
- grpcio
- Many Google libraries

**Python 3.12** is the latest stable version that works with all packages.

---

## ✅ Compatible Python Versions

| Python Version | Works? | Recommended? |
|----------------|--------|--------------|
| 3.9 | ✅ Yes | ⚠️ Old |
| 3.10 | ✅ Yes | ⚠️ Old |
| 3.11 | ✅ Yes | ✅ Good |
| **3.12** | ✅ Yes | ✅ **BEST** |
| 3.13 | ⚠️ Maybe | ❌ Too new |
| 3.14 | ❌ No | ❌ Breaking changes |

---

## 📋 Quick Fix Checklist

- [ ] Download Python 3.12
- [ ] Install with "Add to PATH" checked
- [ ] Verify: `python --version` shows 3.12.x
- [ ] Delete old venv: `rmdir /s /q venv`
- [ ] Create new venv: `python -m venv venv`
- [ ] Activate: `venv\Scripts\activate`
- [ ] Install: `pip install -r requirements.txt`
- [ ] Create .env with your API key
- [ ] Run: `python app.py`

---

## 🆘 If You Must Use Python 3.14

Not recommended, but you can try:

```cmd
# Install from source (unstable)
pip install --pre --upgrade google-generativeai
pip install --pre --upgrade protobuf

# Or use older alternative
pip uninstall google-generativeai
pip install google-genai
```

Then modify `app.py` line 22:
```python
# Change from:
import google.generativeai as genai_alt

# To:
from google import genai as genai_alt
```

**But this is experimental and may have issues!**

---

## ✅ Best Solution

**Install Python 3.12** - it's stable, tested, and works perfectly with all libraries.

Download: https://www.python.org/downloads/release/python-3120/

---

After fixing Python version, your backend will start successfully! 🚀
