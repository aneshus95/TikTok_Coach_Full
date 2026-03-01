"""
Crescio AI - Content Coach Backend
- Single prompt: load_elite_prompt analyzes the video and returns timestamp suggestions
- Prompt written per Gemini 3 prompting guide (docs.cloud.google.com)
- MIME type handling, comprehensive error handling, safe file operations
"""

import os
import re
import time
from dotenv import load_dotenv
load_dotenv(override=True)
import json
import secrets
import hashlib
import base64
import traceback
import smtplib
import threading
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from urllib.parse import urlencode, urljoin
import requests as http_requests
from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from werkzeug.utils import secure_filename
from db import init_db, store_otp, verify_otp_code, upsert_user, create_session, get_session, check_db_health, start_cleanup_thread

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    print("[WARN] WARNING: google-genai not installed")
    GENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    print("[WARN] WARNING: anthropic not installed — overlay edits unavailable")
    ANTHROPIC_AVAILABLE = False

app = Flask(__name__)
CORS(app, origins=[
    'http://localhost:*',
    'http://127.0.0.1:*',
    'https://tiktokcoachapp.onrender.com',
])

# Initialize database (PostgreSQL if DATABASE_URL set, else in-memory)
init_db()
start_cleanup_thread()

video_analyses = {}
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_mime_type(filepath: str) -> str:
    ext = filepath.rsplit('.', 1)[1].lower() if '.' in filepath else ''
    mime_types = {
        'mp4':  'video/mp4',
        'mov':  'video/quicktime',
        'avi':  'video/x-msvideo',
        'mkv':  'video/x-matroska',
        'webm': 'video/webm',
        'm4v':  'video/x-m4v',
        'mpeg': 'video/mpeg',
        'mpg':  'video/mpeg',
        '3gp':  'video/3gpp',
    }
    return mime_types.get(ext, 'video/mp4')


# ==========================================
# SYSTEM PROMPT
# Guideline: Use personas carefully — be explicit and unambiguous so the
# model does not ignore instructions to maintain persona adherence.
# ==========================================

SYSTEM_PROMPT = """You are an elite TikTok growth strategist who has helped hundreds of creators go viral in specific niches.
You understand the TikTok algorithm deeply — not surface-level tips, but the actual mechanics of how content gets distributed.
You think in terms of engagement signals, audience psychology, and niche-specific content strategy.
You never suggest generic advice like "add text overlay" or "use trending sounds." Every suggestion must be rooted in WHY it drives a specific engagement metric.
You output strict JSON only. No markdown, no prose outside the JSON structure."""


def load_elite_prompt(niche: str) -> str:
    return f"""Watch the entire video above. You are a {niche} niche expert and TikTok algorithm strategist.

## YOUR EXPERTISE

**The TikTok Algorithm (how it actually works):**
- Initial push: TikTok shows the video to ~200-500 people. If watch time, completion rate, and engagement are high, it pushes to 5K-50K.
- Completion rate is king: A video watched to the end 3x beats a video with 10x the likes but 30% drop-off at second 3.
- Engagement weighting: Saves > Shares > Comments > Likes. Saves tell the algorithm "this has lasting value."
- Comment velocity: Comments in the first 30 min matter more than comments over 24 hours.
- Rewatch signal: If viewers loop the video or rewatch, TikTok treats it as top-tier content.
- Niche distribution: TikTok clusters content by niche. Using the right signals tells the algorithm WHICH audience to push to.

**{niche} Audience Psychology:**
- What makes {niche} viewers stop scrolling (the pattern interrupt specific to this niche)
- What makes them comment (disagreement, recognition, "I do this too", asking for part 2)
- What makes them save (utility they'll come back to, reference material, motivation)
- What makes them share (social currency — "my friend NEEDS to see this")
- What makes them follow (anticipation — "I need to see what this person does next")

**Content Strategy vs Visual Edits:**
Your suggestions should focus on STRATEGY, not cosmetic changes. Think about:
- Story structure and narrative hooks
- Emotional triggers specific to {niche}
- Content framing and positioning
- Audience interaction and community building
- Series and content loop strategies
- Controversy, curiosity gaps, and open loops
- How to make the algorithm categorize this into the right niche

Your PRIMARY focus should be strategy — engagement signals, audience psychology, and algorithm mechanics. You CAN suggest text overlays, filters, transitions, or other visual edits when they genuinely serve a strategic purpose at a specific timestamp (e.g., a text hook in the first second to stop the scroll, a zoom to emphasize a key reaction). But never suggest them as filler — every suggestion must explain WHY it drives a specific engagement metric.

## YOUR TASK

Step 1 — Watch the full video. Record the exact duration in seconds.

Step 2 — Honest snapshot: What's this video's viral potential? What's holding it back from reaching 100K+ views?

Step 3 — Walk through every key moment across the full video — don't skip sections. For each: what's the engagement problem, and what's the fix? Prioritize strategy (content angle, hooks, audience psychology) but include visual edits (text, zoom, filter) when they serve a clear engagement purpose at that moment.

Step 4 — Give a posting strategy that maximizes the algorithm's initial push.

Return ONLY valid JSON. No markdown. No backticks. Start with {{ end with }}.

{{
  "video_length_seconds": 0,

  "snapshot": {{
    "honest_take": "Direct verdict — would this go viral in {niche}? Why or why not?",
    "engagement_prediction": "Which engagement signals (saves, shares, comments, completion) this video will struggle with and why",
    "keep_this": "The strongest strategic element — the one thing that's already working for {niche} engagement",
    "fix_this": "The #1 strategic problem. Not 'add text' — explain the content/engagement gap"
  }},

  "timestamps": [
    {{
      "time": "M:SS",
      "seconds": "SS",
      "title": "Short label",
      "category": "Hook | Story Structure | Engagement Trigger | Retention | CTA | Audience Psychology | Algorithm Signal",
      "issues": [
        {{
          "observation": "What's happening at this moment",
          "problem": "The engagement/algorithm problem — which metric this hurts (completion rate, save rate, comment rate, share rate) and the psychological reason why"
        }}
      ],
      "fixes": [
        {{
          "action": "Fix 1 — strategy or visual",
          "why_it_works": "The specific engagement signal this improves and why"
        }},
        {{
          "action": "Fix 2 — a different approach",
          "why_it_works": "Which algorithm signal this boosts and why"
        }},
        {{
          "action": "Fix 3 — the growth hack",
          "why_it_works": "How this creates a viral loop or community effect"
        }}
      ]
    }},
    {{
      "time": "M:SS",
      "seconds": "SS",
      "title": "Another key moment",
      "category": "Hook | Story Structure | Engagement Trigger | Retention | CTA | Audience Psychology | Algorithm Signal",
      "issues": [
        {{
          "observation": "What's happening here",
          "problem": "The engagement problem at this moment"
        }}
      ],
      "fixes": [
        {{
          "action": "Fix 1",
          "why_it_works": "Why"
        }},
        {{
          "action": "Fix 2",
          "why_it_works": "Why"
        }},
        {{
          "action": "Fix 3",
          "why_it_works": "Why"
        }}
      ]
    }}
  ],

  "priority_action": {{
    "fix_first": "The ONE change with the most leverage — could be a strategy shift or a key visual edit if it directly impacts engagement",
    "why_this_first": "Which algorithm signal this fixes and why it's the bottleneck for this video's growth",
    "expected_result": "Realistic prediction: how this changes the video's performance (be specific about metrics)"
  }},

  "posting_strategy": {{
    "caption": "The actual caption — optimized for {niche} algorithm categorization and comment engagement. Include a hook, a value statement, and a comment trigger. Use relevant {niche} hashtags",
    "first_comment": "The exact first comment — designed to start a conversation thread that boosts comment velocity. Should trigger debate, 'tag a friend', or part 2 requests",
    "best_time": "When to post for maximum {niche} audience overlap and why this timing matters for the algorithm's initial push",
    "engagement_hack": "One specific tactic to boost engagement in the first 30 minutes (e.g., respond to every comment with a question, pin a controversial take, go live after posting)"
  }},

  "growth_strategy": {{
    "series_potential": "How to turn this video into a series that builds followers. What's the recurring hook?",
    "community_play": "How to use this content to build a {niche} community — stitch/duet strategy, comment engagement, or collaboration ideas",
    "algorithm_positioning": "How to make TikTok's algorithm categorize this into the most profitable {niche} cluster"
  }},

  "before_you_repost": [
    "Fix #1 — the highest-impact change (strategy or visual)",
    "Fix #2 — engagement or content improvement",
    "Fix #3 — algorithm or audience targeting tweak",
    "Fix #4 — visual/editing change if it serves engagement",
    "Fix #5 — growth or community strategy"
  ]
}}

Output ONLY the JSON. Start with {{ and end with }}"""


# ==========================================
# VIDEO ANALYSIS
# ==========================================

def analyze_video_with_gemini(video_path: str, niche: str) -> tuple:
    """Upload video to Gemini, run load_elite_prompt against it. Returns (analysis_json, duration)."""

    if not GENAI_AVAILABLE:
        return ("Using default analysis (Gemini not configured)", 30)

    try:
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            return ("API key not configured", 30)

        client = genai.Client(api_key=api_key)

        if not os.path.exists(video_path):
            return ("ERROR: File not found", 0)
        if os.path.getsize(video_path) > MAX_FILE_SIZE:
            return ("ERROR: File too large", 0)

        mime_type    = get_mime_type(video_path)
        file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
        print(f"[>] {os.path.basename(video_path)} | {mime_type} | {file_size_mb:.2f}MB")

        print("[OUT] Uploading to Gemini...")
        start_time = time.time()

        with open(video_path, 'rb') as f:
            video_file = client.files.upload(file=f, config={'mime_type': mime_type})

        print(f"[OK] Uploaded in {time.time() - start_time:.1f}s - waiting for processing...")
        process_start = time.time()

        while video_file.state == "PROCESSING":
            if time.time() - process_start > 120:
                return ("Processing timeout", 30)
            time.sleep(2)
            try:
                video_file = client.files.get(name=video_file.name)
            except Exception as e:
                print(f"[WARN] Status check error: {e}")
                break

        print(f"[OK] Processed in {time.time() - process_start:.1f}s")

        if video_file.state == "FAILED":
            return ("Processing failed", 0)

        print("[>] Running elite prompt...")
        analysis_start = time.time()

        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=[
                types.Part.from_uri(file_uri=video_file.uri, mime_type=video_file.mime_type),
                load_elite_prompt(niche),
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=1.0,   # Gemini 3 guide: keep at default 1.0
                max_output_tokens=50000,
            )
        )

        print(f"[OK] Done in {time.time() - analysis_start:.1f}s | total {time.time() - start_time:.1f}s")

        analysis = response.text
        duration  = extract_duration_from_json(analysis)
        return (analysis, duration)

    except Exception as e:
        print(f"[ERR] Analysis error: {e}")
        traceback.print_exc()
        return (f"Error: {str(e)}", 0)


def extract_duration_from_json(text: str) -> int:
    try:
        first, last = text.find('{'), text.rfind('}')
        if first != -1 and last != -1:
            data = json.loads(text[first:last + 1])
            dur  = data.get('video_length_seconds')
            if dur and isinstance(dur, (int, float)) and 1 <= int(dur) <= 600:
                print(f"[OK] Duration: {int(dur)}s")
                return int(dur)
            ts_list = data.get('timestamps', [])
            if ts_list:
                max_sec = max((t.get('seconds', 0) for t in ts_list), default=0)
                if max_sec:
                    return int(max_sec) + 5
    except Exception as e:
        print(f"[WARN] Duration parse error: {e}")
    print("[WARN] Could not extract duration - defaulting to 30s")
    return 30


# ==========================================
# TIMESTAMP EXTRACTION
# ==========================================

def extract_timestamps_from_json(text: str, duration: int) -> list:
    print("[>] Extracting timestamps...")

    clean = text.strip()
    clean = re.sub(r'```json\s*', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'```\s*|`', '', clean)

    first, last = clean.find('{'), clean.rfind('}')
    if first == -1 or last == -1:
        raise Exception("No valid JSON braces found in Gemini response")

    clean = clean[first:last + 1]

    try:
        data = json.loads(clean)
        print("[OK] JSON parsed")
    except json.JSONDecodeError as e:
        print(f"[ERR] JSON parse failed: {e}\n[DOC] Snippet: {clean[:500]}")
        raise Exception(f"Invalid JSON from Gemini: {e}")

    if 'snapshot' in data:
        print(f"[>] Take: {data['snapshot'].get('honest_take', '')}")
        print(f"[>] Fix: {data['snapshot'].get('fix_this', '')}")

    ts_list = data.get('timestamps', [])
    if not ts_list:
        raise Exception("No timestamps found in Gemini response")

    timestamps = []
    for item in ts_list:
        try:
            secs = int(float(item.get('seconds', 0)))
            if secs == 0 and 'time' in item:
                m = re.search(r'(\d+):(\d+)', str(item['time']))
                if m:
                    secs = int(m.group(1)) * 60 + int(m.group(2))

            if secs >= duration:
                print(f"[WARN] Skipping {secs}s - exceeds {duration}s")
                continue

            title = str(item.get('title', f'{secs}s'))
            cat   = str(item.get('category', 'General'))

            # Issues — supports new merged schema and legacy field names
            issues = []
            for iss in (item.get('issues') or []):
                if isinstance(iss, dict):
                    for field, label in [
                        ('observation',     ''),
                        ('problem',         '[WARN] '),
                        ('engagement_cost', 'Engagement: '),
                        ('algorithm_cost',  'Algorithm: '),
                    ]:
                        val = iss.get(field)
                        if val and isinstance(val, str):
                            issues.append(f"{label}{val}")
                elif isinstance(iss, str) and iss:
                    issues.append(iss)

            # Fixes — supports object or plain-string format
            fixes = []
            for fix in (item.get('fixes') or []):
                if isinstance(fix, dict):
                    for field, label in [
                        ('action',          ''),
                        ('why_it_works',    'Why: '),
                        ('engagement_mechanic', 'Why: '),  # legacy fallback
                    ]:
                        val = fix.get(field)
                        if val and isinstance(val, str):
                            fixes.append(f"{label}{val}")
                elif isinstance(fix, str) and fix:
                    fixes.append(fix)

            issues = [str(i) for i in issues if i]
            fixes  = [str(f) for f in fixes  if f]

            if not issues or not fixes:
                print(f"[WARN] Skipping {secs}s - missing issues or fixes")
                continue

            timestamps.append({
                'timestamp':   secs,
                'title':       title,
                'categories':  [cat],
                'issues':      issues,
                'suggestions': fixes,
                'emoji':       get_emoji(cat, secs),
            })
            print(f"   [OK] {secs}s: {title} | {len(issues)} issues, {len(fixes)} fixes")

        except Exception as e:
            print(f"[WARN] Error processing timestamp: {e}")
            continue

    timestamps.sort(key=lambda x: x['timestamp'])

    if not timestamps:
        raise Exception("No valid timestamps extracted from Gemini response")

    print(f"[OK] Extracted {len(timestamps)} timestamps")
    return timestamps


def get_emoji(category: str, seconds: int) -> str:
    c = category.lower()
    if seconds == 0 or 'hook' in c:     return '🎣'
    if 'visual' in c:                   return '✨'
    if 'audio' in c or 'sound' in c:    return '🎵'
    if 'text' in c:                     return '📝'
    if 'pacing' in c or 'edit' in c:    return '⚡'
    if 'engagement' in c:               return '💬'
    if 'cta' in c or 'ending' in c:     return '🎯'
    if 'save' in c or 'retention' in c: return '🔖'
    if 'share' in c:                    return '🔁'
    if 'follow' in c:                   return '👤'
    return '💡'


def generate_smart_defaults(duration: int) -> list:
    """Fallback timestamps when Gemini is unavailable."""
    defaults = [{'timestamp': 0, 'title': 'Hook (0-3s)', 'categories': ['Hook'],
                 'issues': ['Hook optimization needed', 'First frame impact missing'],
                 'suggestions': ['Show result immediately to trigger curiosity gap', 'Add movement to interrupt scroll'],
                 'emoji': '🎣'}]
    if duration >= 10:
        t = int(duration * 0.2)
        defaults.append({'timestamp': t, 'title': f'Pacing ({t}s)', 'categories': ['Pacing'],
                         'issues': ['Pace slows — dopamine loop at risk', 'Energy drops after hook'],
                         'suggestions': ['Add a cut to maintain pattern interrupt', 'Change angle to reset attention'],
                         'emoji': '⚡'})
    if duration >= 15:
        t = int(duration * 0.5)
        defaults.append({'timestamp': t, 'title': f'Engagement Plant ({t}s)', 'categories': ['Engagement'],
                         'issues': ['No comment trigger planted', 'No save hook — content has no reference value'],
                         'suggestions': ['Add identity-statement overlay to drive comments', 'Add utility element to trigger save reflex'],
                         'emoji': '💬'})
    if duration >= 8:
        t = max(int(duration * 0.9), duration - 3)
        defaults.append({'timestamp': t, 'title': f'Follow Hook ({t}s)', 'categories': ['CTA'],
                         'issues': ['Weak ending — no follow trigger', 'Missing parasocial close'],
                         'suggestions': ['Add series tease to build anticipation', 'Loop visually to boost rewatch'],
                         'emoji': '🎯'})
    return defaults


# ==========================================
# ROUTES
# ==========================================

@app.route('/')
def home():
    return jsonify({'status': 'Crescio AI API', 'version': '1.0.0', 'genai': GENAI_AVAILABLE})


@app.route('/api/health')
def health():
    return jsonify({
        'status':          'healthy',
        'genai_available': GENAI_AVAILABLE,
        'api_key_set':     bool(os.getenv('GOOGLE_API_KEY')),
        'upload_folder':   os.path.exists(UPLOAD_FOLDER),
        'database':        check_db_health(),
    })


@app.route('/api/scrape/start', methods=['POST'])
def scrape_start():
    data = request.get_json()
    return jsonify({'job_id': f"job_{int(time.time())}", 'niche': data.get('niche', 'TikTok'), 'status': 'ready'})


@app.route('/api/video/upload', methods=['POST'])
def upload_video():
    """Upload video → analyze with load_elite_prompt → return timestamps."""
    try:
        print(f"\n{'='*60}\n[>] UPLOAD & ANALYSIS\n{'='*60}")

        if 'video' not in request.files:
            return jsonify({'error': 'No video file'}), 400

        video = request.files['video']
        niche = request.form.get('niche', 'TikTok')

        if not video.filename:
            return jsonify({'error': 'Invalid filename'}), 400
        if not allowed_file(video.filename):
            return jsonify({'error': f'Invalid type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

        filename   = secure_filename(video.filename)
        video_path = os.path.join(UPLOAD_FOLDER, filename)
        video.save(video_path)

        if not os.path.exists(video_path):
            return jsonify({'error': 'Save failed'}), 500

        file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
        print(f"[OK] Saved: {file_size_mb:.2f}MB")

        if file_size_mb > MAX_FILE_SIZE / (1024 * 1024):
            os.remove(video_path)
            return jsonify({'error': f'Too large. Max: {MAX_FILE_SIZE // (1024 * 1024)}MB'}), 400

        analysis, duration = analyze_video_with_gemini(video_path, niche)

        if str(analysis).startswith('ERROR') or duration == 0:
            return jsonify({'error': f'Analysis failed: {analysis}'}), 500

        try:
            timestamps = extract_timestamps_from_json(analysis, duration)
        except Exception as e:
            print(f"[WARN] Timestamp extraction failed ({e}) - using defaults")
            timestamps = generate_smart_defaults(duration)

        aid = f"analysis_{int(time.time())}"
        video_analyses[aid] = {
            'analysis':   analysis,
            'duration':   duration,
            'niche':      niche,
            'timestamps': timestamps,
            'video_path': video_path,
        }

        print(f"[OK] Done | ID: {aid} | {duration}s | {len(timestamps)} timestamps\n{'='*60}\n")

        return jsonify({
            'analysis_id': aid,
            'duration':    duration,
            'timestamps':  timestamps,
            'coaching':    analysis,
        })

    except Exception as e:
        print(f"[ERR] Upload error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/coaching/generate', methods=['POST'])
def generate_coaching():
    """Return the analysis already produced during upload."""
    try:
        data = request.get_json()
        if isinstance(data, str):
            data = json.loads(data)

        aid = data.get('analysis_id')
        if not aid or aid not in video_analyses:
            return jsonify({'error': 'Analysis not found. Please upload video first.'}), 404

        stored = video_analyses[aid]
        return jsonify({
            'coaching':    stored['analysis'],
            'timestamps':  stored['timestamps'],
            'duration':    stored['duration'],
            'analysis_id': aid,
            'niche':       stored['niche'],
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/chat/ask', methods=['POST'])
def chat_ask():
    try:
        data     = request.get_json()
        question = data.get('question', '')
        niche    = data.get('niche', 'TikTok')

        if not question:
            return jsonify({'error': 'No question'}), 400
        if not GENAI_AVAILABLE:
            return jsonify({'response': 'Chat unavailable (Gemini not configured)'})

        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            return jsonify({'error': 'API key not set'}), 500

        client = genai.Client(api_key=api_key)

        prompt = f"""You are an elite {niche} TikTok engagement coach.

Question: {question}

Answer in 2-3 focused paragraphs. Be specific, niche-aware, and actionable.
Where relevant, state which engagement action (comment, share, save, follow) your advice targets and explain the causal mechanism."""

        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=1.0,   # Gemini 3 guide: keep at default 1.0
                max_output_tokens=50000,
            )
        )

        return jsonify({'response': response.text})

    except Exception as e:
        print(f"[ERR] Chat error: {e}")
        return jsonify({'error': str(e)}), 500


# ==========================================
# TRENDING IDEAS — Gemini + Google Search Grounding
# ==========================================

TRENDING_SYSTEM_PROMPT = """You are a TikTok trend analyst with access to real-time web data.
Your job is to find CURRENT, REAL trending TikTok content ideas for a specific niche.

CRITICAL DATE RULE:
- Today's date will be provided in the query. You MUST only include trends from the LAST 30 DAYS.
- REJECT any trend older than 30 days. If a source is from 2025 or earlier, IGNORE it completely.
- Prioritize trends from the LAST 7 DAYS over older ones.
- Every idea MUST include evidence of recency in the "why_trending" field (e.g., "went viral
  this week", "trending since Feb 2026", "X million views in the last 7 days").
- If you cannot verify a trend is from the last 30 days, DO NOT include it.

NICHE RELEVANCE RULE (CRITICAL):
- Every single idea MUST be DIRECTLY and SPECIFICALLY about the user's niche.
- Do NOT include generic TikTok trends that are only loosely or tangentially related.
- If the niche is "underground music", every idea must be about creating underground music
  content — NOT general music trends, NOT fashion, NOT lifestyle, NOT random viral formats
  that happen to use music.
- Ask yourself for each idea: "Would a creator who ONLY makes [niche] content use this?"
  If the answer is no, REMOVE IT and replace it with a niche-specific one.
- The niche should be the CORE SUBJECT of every idea, not a side element or backdrop.

IMPORTANT RULES:
- Search Google for the LATEST TikTok trends, viral formats, and popular content ideas
  SPECIFIC TO the given niche
- Add the current month and year to your search queries (e.g., "trending TikTok fitness February 2026")
- Also search for "[niche] TikTok creators" and "[niche] TikTok trends" to find niche-specific content
- Focus on ACTIONABLE ideas the user can film TODAY
- Include specific trending hashtags and formats when found
- Be specific — "Do X with Y effect" is better than "Make creative content"
- For EACH idea, find the specific trending TikTok sound/song that is commonly used
  with that type of content. The sound MUST be relevant to that specific idea, not generic.
  Search for "trending TikTok sounds for [format/topic]" to find the right match.
  If you cannot find a specific sound for an idea, set suggested_sound to null.

OUTPUT FORMAT — Return ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "ideas": [
    {
      "title": "Short catchy name for the idea",
      "description": "2-3 sentence explanation of what to film and how",
      "format": "Video format type (e.g., POV, Tutorial, Get Ready With Me, Transition, Duet, Storytime, Day in My Life)",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
      "difficulty": "Easy|Medium|Hard",
      "why_trending": "Brief reason why this is currently viral",
      "suggested_sound": "Name of specific trending TikTok sound/song that fits THIS idea, or null if unknown",
      "tiktok_link": "A real TikTok URL to explore this trend — use https://www.tiktok.com/tag/HASHTAG (without #, lowercase, no spaces) for the most relevant hashtag, or https://www.tiktok.com/search?q=QUERY for the trend topic"
    }
  ],
  "source_summary": "One-line summary of where these trends were found"
}

Return exactly 6-8 ideas. Each idea must be unique and specific to the niche."""


@app.route('/api/trending/ideas', methods=['POST'])
def trending_ideas():
    """Fetch trending TikTok ideas for a niche using Gemini + Google Search grounding."""
    try:
        data = request.get_json() or {}
        niche = (data.get('niche') or 'TikTok').strip()

        if not GENAI_AVAILABLE:
            return jsonify({'error': 'Google GenAI SDK not available'}), 503

        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            return jsonify({'error': 'GOOGLE_API_KEY not configured'}), 503

        client = genai.Client(api_key=api_key)
        print(f"[TRENDING] Fetching trending ideas for niche: '{niche}'")

        # Enable Google Search grounding — Gemini will search Google in real time
        grounding_tool = types.Tool(google_search=types.GoogleSearch())

        today = datetime.utcnow().strftime('%B %d, %Y')
        month_year = datetime.utcnow().strftime('%B %Y')
        contents_text = (
            f"Today is {today}. "
            f"I need trending TikTok content ideas SPECIFICALLY about \"{niche}\". "
            f"Search for: "
            f"1) \"{niche} TikTok trends {month_year}\" "
            f"2) \"{niche} TikTok creators viral {month_year}\" "
            f"3) \"trending {niche} content TikTok this week\" "
            f"Only include results from the last 30 days. Ignore anything older. "
            f"Every idea MUST be directly about {niche} — not general TikTok trends "
            f"that are loosely related. A {niche} creator should look at each idea "
            f"and immediately know how to make it about {niche}."
        )
        config = types.GenerateContentConfig(
            system_instruction=TRENDING_SYSTEM_PROMPT,
            tools=[grounding_tool],
            temperature=0.7,
            max_output_tokens=4000,
        )

        # Retry up to 3 times on transient errors (503 high demand)
        response = None
        last_err = None
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model='gemini-3-flash-preview',
                    contents=contents_text,
                    config=config,
                )
                break
            except Exception as retry_err:
                last_err = retry_err
                err_str = str(retry_err)
                if '503' in err_str or 'UNAVAILABLE' in err_str or 'high demand' in err_str.lower():
                    wait = (attempt + 1) * 3
                    print(f"[TRENDING] Gemini 503 — retrying in {wait}s (attempt {attempt + 1}/3)")
                    time.sleep(wait)
                else:
                    raise

        if response is None:
            print(f"[ERR] Trending: all retries failed — {last_err}")
            return jsonify({'error': 'AI service temporarily busy. Please try again in a moment.'}), 503

        raw = response.text.strip()
        print(f"[TRENDING] Raw response length: {len(raw)} chars")

        # Parse JSON from response (strip markdown fences if present)
        if raw.startswith('```'):
            raw = '\n'.join(raw.split('\n')[1:])
        if raw.endswith('```'):
            raw = '\n'.join(raw.split('\n')[:-1])
        raw = raw.strip()

        # Find JSON object
        first_brace = raw.find('{')
        last_brace = raw.rfind('}')
        if first_brace == -1 or last_brace == -1:
            return jsonify({'error': 'Failed to parse trending data'}), 500

        parsed = json.loads(raw[first_brace:last_brace + 1])

        # Post-process: ensure every idea has a tiktok_link
        ideas = parsed.get('ideas', [])
        for idea in ideas:
            if not idea.get('tiktok_link'):
                # Generate link from first hashtag or title
                hashtags = idea.get('hashtags', [])
                if hashtags:
                    tag = hashtags[0].lstrip('#').lower().replace(' ', '')
                    idea['tiktok_link'] = f'https://www.tiktok.com/tag/{tag}'
                else:
                    query = idea.get('title', niche).replace(' ', '+')
                    idea['tiktok_link'] = f'https://www.tiktok.com/search?q={query}'

        result = {
            'niche': niche,
            'ideas': ideas,
            'source_summary': parsed.get('source_summary', ''),
            'fetched_at': datetime.utcnow().isoformat() + 'Z',
        }

        print(f"[OK] Trending: {len(result['ideas'])} ideas for '{niche}'")
        return jsonify(result)

    except json.JSONDecodeError as je:
        print(f"[ERR] Trending JSON parse error: {je}")
        return jsonify({'error': 'Failed to parse AI response. Try again.'}), 500
    except Exception as e:
        err_str = str(e)
        print(f"[ERR] Trending error: {err_str}")
        traceback.print_exc()
        if '503' in err_str or 'UNAVAILABLE' in err_str or 'high demand' in err_str.lower():
            return jsonify({'error': 'AI service temporarily busy. Please try again in a moment.'}), 503
        return jsonify({'error': 'Failed to fetch trending ideas. Try again.'}), 500


# ==========================================
# AUTH — OTP SYSTEM
# ==========================================

OTP_EXPIRY_SECONDS = 600   # 10 minutes
SESSION_EXPIRY_HOURS = 720  # 30 days

SMTP_HOST     = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT     = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER     = os.getenv('SMTP_USER', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
FROM_EMAIL    = os.getenv('FROM_EMAIL', SMTP_USER)
DEV_MODE      = os.getenv('DEV_MODE', 'true').lower() == 'true'


def generate_otp() -> str:
    return str(secrets.randbelow(900000) + 100000)


def generate_token(contact: str) -> str:
    raw = f"{contact}:{secrets.token_hex(32)}:{time.time()}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def send_email_otp(to_email: str, otp: str) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[WARN] SMTP not configured - OTP for {to_email}: {otp}")
        return True  # still succeed in dev

    try:
        msg = MIMEText(
            f"Your Crescio AI verification code is: {otp}\n\n"
            f"This code expires in 10 minutes. Do not share it with anyone."
        )
        msg['Subject'] = f"Your Crescio AI code: {otp}"
        msg['From']    = FROM_EMAIL
        msg['To']      = to_email

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
        print(f"[OK] OTP email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[ERR] Email send failed: {e}")
        return False


@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    try:
        data    = request.get_json()
        contact = (data.get('contact') or '').strip()
        mode    = data.get('mode', 'email')

        if not contact:
            return jsonify({'error': 'Contact is required'}), 400

        otp = generate_otp()
        store_otp(contact, otp, mode, OTP_EXPIRY_SECONDS)
        print(f"[AUTH] OTP generated for {contact}: {otp if DEV_MODE else '******'}")

        if mode == 'email':
            def send_async():
                send_email_otp(contact, otp)
            threading.Thread(target=send_async, daemon=True).start()
        else:
            # Phone — log in dev mode; integrate Twilio for production
            print(f"[SMS-DEV] OTP for {contact}: {otp}")

        response = {'message': f'Verification code sent to {contact}'}
        if DEV_MODE:
            response['dev_otp'] = otp  # only in dev!
        return jsonify(response)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data    = request.get_json()
        contact = (data.get('contact') or '').strip()
        otp     = (data.get('otp') or '').strip()

        if not contact or not otp:
            return jsonify({'error': 'Contact and OTP are required'}), 400

        # Verify OTP
        valid, error_msg = verify_otp_code(contact, otp)
        if not valid:
            return jsonify({'error': error_msg}), 400

        # Create or update user
        user_id = hashlib.sha256(contact.encode()).hexdigest()[:16]
        upsert_user(user_id, contact, mode)

        # Create session
        token = generate_token(contact)
        create_session(token, user_id, SESSION_EXPIRY_HOURS)

        print(f"[OK] Auth: {contact} logged in (user_id: {user_id})")
        return jsonify({'token': token, 'user_id': user_id})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def get_auth_token():
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


def require_auth():
    """Return session dict or None if unauthorized."""
    token = get_auth_token()
    if not token:
        return None
    return get_session(token)


# ==========================================
# TIKTOK — OAUTH + ANALYTICS
# ==========================================

TIKTOK_CLIENT_KEY    = os.getenv('TIKTOK_CLIENT_KEY', '')
TIKTOK_CLIENT_SECRET = os.getenv('TIKTOK_CLIENT_SECRET', '')
BACKEND_URL          = os.getenv('BACKEND_URL', 'https://tiktokcoachapp.onrender.com')
TIKTOK_REDIRECT_URI  = f"{BACKEND_URL}/api/tiktok/callback"
TIKTOK_SCOPES        = 'user.info.basic,video.list'

# Cache TikTok states for CSRF protection
tiktok_states = {}   # state -> {created_at}


@app.route('/api/tiktok/auth-url', methods=['GET'])
def tiktok_auth_url():
    """Return the TikTok OAuth authorization URL."""
    try:
        if not TIKTOK_CLIENT_KEY:
            # Demo mode — explain what to configure
            return jsonify({
                'error':   'TikTok app not configured',
                'setup':   'Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env',
                'guide':   'https://developers.tiktok.com/doc/login-kit-web',
                'auth_url': None,
            }), 503

        state = secrets.token_urlsafe(32)
        tiktok_states[state] = {'created_at': time.time()}

        params = {
            'client_key':     TIKTOK_CLIENT_KEY,
            'scope':          TIKTOK_SCOPES,
            'response_type':  'code',
            'redirect_uri':   TIKTOK_REDIRECT_URI,
            'state':          state,
        }
        auth_url = 'https://www.tiktok.com/v2/auth/authorize/?' + urlencode(params)

        return jsonify({'auth_url': auth_url, 'state': state})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/tiktok/callback', methods=['GET'])
def tiktok_callback():
    """Handle TikTok OAuth redirect — exchanges code for token and shows success page."""
    code    = request.args.get('code', '')
    state   = request.args.get('state', '')
    error   = request.args.get('error', '')

    if error:
        return f"<html><body><script>window.location='contentflow://tiktok-error?error={error}'</script>TikTok error: {error}</body></html>"

    # Validate state
    if state not in tiktok_states:
        return "<html><body>Invalid state. Please try connecting again.</body></html>", 400
    del tiktok_states[state]

    try:
        # Exchange code for access token
        token_resp = http_requests.post(
            'https://open.tiktokapis.com/v2/oauth/token/',
            data={
                'client_key':    TIKTOK_CLIENT_KEY,
                'client_secret': TIKTOK_CLIENT_SECRET,
                'code':          code,
                'grant_type':    'authorization_code',
                'redirect_uri':  TIKTOK_REDIRECT_URI,
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15,
        )
        token_data = token_resp.json()

        if 'error' in token_data:
            return f"<html><body>Token error: {token_data.get('error_description','unknown')}</body></html>", 400

        access_token  = token_data.get('access_token', '')
        refresh_token = token_data.get('refresh_token', '')

        # Return success page that deep-links back to app or shows the token
        return f"""<html>
<head><title>Connected!</title>
<style>body{{font-family:sans-serif;background:#050810;color:#00D4FF;text-align:center;padding:60px 20px}}
h1{{font-size:2rem}}p{{color:#94A3B8}}code{{background:#111827;padding:8px 16px;border-radius:8px;display:block;margin:20px auto;word-break:break-all;max-width:400px;font-size:12px}}</style>
</head>
<body>
<h1>✓ TikTok Connected!</h1>
<p>Your TikTok account has been successfully linked to Crescio AI.</p>
<p>Copy this token back to the app if prompted, or return to the app now.</p>
<code>{access_token}</code>
<p style="margin-top:30px;font-size:13px;color:#334155">You can close this tab and return to the app.</p>
</body>
</html>"""

    except Exception as e:
        traceback.print_exc()
        return f"<html><body>Connection failed: {str(e)}</body></html>", 500


@app.route('/api/tiktok/connect', methods=['POST'])
def tiktok_connect():
    """Exchange authorization code for access token (called from React Native)."""
    try:
        data  = request.get_json()
        code  = data.get('code', '')
        state = data.get('state', '')

        if not TIKTOK_CLIENT_KEY:
            return jsonify({'error': 'TikTok not configured. Set TIKTOK_CLIENT_KEY env var.'}), 503

        token_resp = http_requests.post(
            'https://open.tiktokapis.com/v2/oauth/token/',
            data={
                'client_key':    TIKTOK_CLIENT_KEY,
                'client_secret': TIKTOK_CLIENT_SECRET,
                'code':          code,
                'grant_type':    'authorization_code',
                'redirect_uri':  TIKTOK_REDIRECT_URI,
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15,
        )
        token_data = token_resp.json()

        if 'error' in token_data:
            return jsonify({'error': token_data.get('error_description', 'Token exchange failed')}), 400

        return jsonify({
            'access_token':  token_data.get('access_token'),
            'refresh_token': token_data.get('refresh_token'),
            'open_id':       token_data.get('open_id'),
            'expires_in':    token_data.get('expires_in'),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def tiktok_get(endpoint: str, access_token: str, params: dict = None, data: dict = None) -> dict:
    """Make an authenticated request to the TikTok API v2."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type':  'application/json',
    }
    url = f"https://open.tiktokapis.com{endpoint}"
    if data:
        resp = http_requests.post(url, json=data, headers=headers, params=params, timeout=15)
    else:
        resp = http_requests.get(url, headers=headers, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


@app.route('/api/tiktok/profile', methods=['GET'])
def tiktok_profile():
    """Fetch the user's TikTok profile via the API."""
    access_token = request.headers.get('X-TikTok-Token', '')
    if not access_token:
        return jsonify({'error': 'Missing TikTok token'}), 401

    try:
        result = tiktok_get(
            '/v2/user/info/',
            access_token,
            params={'fields': 'open_id,union_id,avatar_url,display_name,bio_description,'
                               'is_verified,follower_count,following_count,likes_count,video_count'}
        )
        user = result.get('data', {}).get('user', {})
        if not user:
            return jsonify({'error': result.get('error', {}).get('message', 'No user data')}), 400

        return jsonify({
            'username':       user.get('open_id', '')[:12],
            'display_name':   user.get('display_name', 'TikTok User'),
            'avatar_url':     user.get('avatar_url', ''),
            'bio':            user.get('bio_description', ''),
            'follower_count': user.get('follower_count', 0),
            'following_count':user.get('following_count', 0),
            'likes_count':    user.get('likes_count', 0),
            'video_count':    user.get('video_count', 0),
            'is_verified':    user.get('is_verified', False),
        })

    except http_requests.HTTPError as e:
        return jsonify({'error': f'TikTok API error: {e.response.status_code}'}), 502
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/tiktok/videos', methods=['GET'])
def tiktok_videos():
    """Fetch the user's recent TikTok videos with engagement metrics."""
    access_token = request.headers.get('X-TikTok-Token', '')
    if not access_token:
        return jsonify({'error': 'Missing TikTok token'}), 401

    try:
        result = tiktok_get(
            '/v2/video/list/',
            access_token,
            params={
                'fields': 'id,title,cover_image_url,create_time,'
                          'view_count,like_count,comment_count,share_count',
                'max_count': 20,
            }
        )
        videos_data = result.get('data', {}).get('videos', [])

        videos = []
        for v in videos_data:
            videos.append({
                'id':            v.get('id', ''),
                'title':         v.get('title', ''),
                'cover_url':     v.get('cover_image_url', ''),
                'create_time':   v.get('create_time', 0),
                'view_count':    v.get('view_count', 0),
                'like_count':    v.get('like_count', 0),
                'comment_count': v.get('comment_count', 0),
                'share_count':   v.get('share_count', 0),
            })

        return jsonify(videos)

    except http_requests.HTTPError as e:
        return jsonify({'error': f'TikTok API error: {e.response.status_code}'}), 502
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/tiktok/stats', methods=['GET'])
def tiktok_stats():
    """Compute aggregated engagement stats from the user's recent videos."""
    access_token = request.headers.get('X-TikTok-Token', '')
    if not access_token:
        return jsonify({'error': 'Missing TikTok token'}), 401

    try:
        result = tiktok_get(
            '/v2/video/list/',
            access_token,
            params={
                'fields': 'id,create_time,view_count,like_count,comment_count,share_count',
                'max_count': 30,
            }
        )
        videos = result.get('data', {}).get('videos', [])

        now_ts       = time.time()
        week_ago_ts  = now_ts - 7 * 86400

        total_views    = 0
        total_likes    = 0
        total_comments = 0
        total_shares   = 0
        videos_this_week = 0
        last_post_ts   = 0
        daily_streak   = 0

        # Sort by create_time desc to detect streak
        sorted_vids = sorted(videos, key=lambda v: v.get('create_time', 0), reverse=True)
        post_days   = set()

        for v in sorted_vids:
            ct            = v.get('create_time', 0)
            total_views   += v.get('view_count', 0)
            total_likes   += v.get('like_count', 0)
            total_comments+= v.get('comment_count', 0)
            total_shares  += v.get('share_count', 0)

            if ct > week_ago_ts:
                videos_this_week += 1
            if ct > last_post_ts:
                last_post_ts = ct

            day_key = datetime.fromtimestamp(ct).strftime('%Y-%m-%d')
            post_days.add(day_key)

        # Calculate days since last post
        days_since = 0
        if last_post_ts > 0:
            days_since = int((now_ts - last_post_ts) / 86400)

        # Calculate posting streak (consecutive days from today backwards)
        streak     = 0
        check_date = datetime.now()
        for _ in range(60):
            if check_date.strftime('%Y-%m-%d') in post_days:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        daily_streak = streak

        # Engagement rate = (likes + comments + shares) / views * 100
        eng_rate = 0.0
        if total_views > 0:
            eng_rate = round((total_likes + total_comments + total_shares) / total_views * 100, 2)

        return jsonify({
            'total_views':          total_views,
            'total_likes':          total_likes,
            'total_comments':       total_comments,
            'total_shares':         total_shares,
            'avg_engagement_rate':  eng_rate,
            'videos_this_week':     videos_this_week,
            'days_since_last_post': days_since,
            'posting_streak':       daily_streak,
        })

    except http_requests.HTTPError as e:
        return jsonify({'error': f'TikTok API error: {e.response.status_code}'}), 502
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==========================================
# VEO 3 — AI VIDEO GENERATION
# ==========================================

# In-memory task store
veo_tasks = {}   # task_id -> {state, prompt, created_at, video_url?, error_message?}

VEO_MODEL = 'veo-3.1-generate-preview'


# ──────────────────────────────────────────
# VEO 3 — PROMPT ENHANCEMENT (Gemini-powered)
# ──────────────────────────────────────────

VEO_PROMPT_SYSTEM = """You are a Veo 3.1 prompt engineer for IMAGE-TO-VIDEO editing.

## CORE PRINCIPLE
The seed image IS the context. Veo can SEE everything in it.
DO NOT re-describe the subject, face, clothing, background, or lighting.
Mentioning these things — even to "preserve" them — draws Veo's attention to them
and causes unwanted modifications. ONLY describe the CHANGE the user wants.

## PROMPT STRUCTURE
Sentence 1: "Starting from this exact frame, continuing as a smooth video,"
Sentence 2: The specific edit/change/addition the user requested.
Sentence 3 (optional): Camera instruction if needed (default: static locked shot).
That's it. 2-3 sentences. 30-60 words MAX.

## WHAT TO INCLUDE
- The requested change using force-based verbs: emerge, drift, pulse, ripple, sweep, float, sway
- Spatial positioning if needed: "from the left side", "in the upper area", "at the bottom"
- Camera only if user requested movement. Default: omit (Veo defaults to static).

## WHAT TO NEVER INCLUDE
- Any description of the person/subject (face, expression, skin, clothing, hair, pose)
- Any description of the background or environment
- Any description of the lighting or color grading
- Any "preserve" or "maintain" or "unchanged" language — this backfires
- Any mention of body parts (mouth, hands, eyes, head) — rewrite to spatial positions

## BODY PART → SPATIAL REWRITE
If user references body parts, replace with frame positions:
  mouth/chin → "lower-center of frame"
  head/above head → "top of frame"
  eyes/forehead → "upper-center area"
  hands/arms → "sides of frame"
  chest/torso → "center of frame"
  feet/legs → "bottom of frame"

## EXAMPLES

User: "add fire from my hands"
→ Starting from this exact frame, continuing as a smooth video, realistic flickering orange flames emerge and pulse from the sides of the frame, casting warm dynamic light.

User: "make the background neon purple"
→ Starting from this exact frame, continuing as a smooth video, the background gradually shifts to a vivid neon purple glow with soft light spill.

User: "add rain"
→ Starting from this exact frame, continuing as a smooth video, heavy rain falls through the scene with visible droplets and subtle splashes on surfaces.

User: "make it cinematic slow motion"
→ Starting from this exact frame, continuing as a smooth video, all motion slows to elegant half-speed with a gentle dolly-in on a 35mm lens.

User: "add text HELLO from my mouth"
→ Starting from this exact frame, continuing as a smooth video, bold floating text reading "HELLO" drifts outward from the lower-center of the frame with a subtle vibrating pulse.

User: "make my hair blue"
→ Starting from this exact frame, continuing as a smooth video, the hair transitions to a vivid electric blue color with natural shine and movement.

## RULES
1. 2-3 sentences MAX. 30-60 words. Shorter = better for image-to-video.
2. NEVER describe what's already visible in the image.
3. NEVER use preservation language (it causes the opposite effect).
4. ONE change per prompt. Don't stack multiple effects.
5. Use professional film terms for camera: dolly, crane, pan, arc — only if requested.

## OUTPUT
Return ONLY the raw prompt. No explanations, no markdown, no labels, no quotes."""


def enhance_prompt_for_veo(user_prompt: str) -> str:
    """Use Gemini to convert a casual user edit request into a structured Veo 3 prompt.

    Falls back to a basic template if Gemini is unavailable.
    """
    if not GENAI_AVAILABLE:
        return _basic_prompt_template(user_prompt)

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        return _basic_prompt_template(user_prompt)

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=f"User's edit request: \"{user_prompt}\"",
            config=types.GenerateContentConfig(
                system_instruction=VEO_PROMPT_SYSTEM,
                temperature=0.3,   # Low temperature for precise, consistent prompts
                max_output_tokens=2000,  # Needs headroom for model thinking tokens
            ),
        )

        enhanced = response.text.strip()
        # Remove any markdown code fences Gemini might add
        if enhanced.startswith('```'):
            enhanced = '\n'.join(enhanced.split('\n')[1:])
        if enhanced.endswith('```'):
            enhanced = '\n'.join(enhanced.split('\n')[:-1])
        enhanced = enhanced.strip()

        if len(enhanced) < 20:
            print(f"[WARN] Prompt enhancer returned short result, using fallback")
            return _basic_prompt_template(user_prompt)

        print(f"[VEO] Enhanced prompt: '{enhanced[:120]}...'")
        return enhanced

    except Exception as e:
        print(f"[WARN] Prompt enhancement failed ({e}), using fallback template")
        return _basic_prompt_template(user_prompt)


def _basic_prompt_template(user_prompt: str) -> str:
    """Fallback template when Gemini enhancement is unavailable."""
    return (
        f"Starting from this exact frame as the first frame of the video, "
        f"generate a natural video continuation where: {user_prompt}. "
        f"Static camera, no camera movement. "
        f"Preserve the exact background, lighting, camera angle, "
        f"body position, scene composition, and all elements that are NOT "
        f"being edited. The only change should be what was requested. "
        f"The result must look like it was filmed in the same take as the "
        f"original video — same color grading, same resolution, same style. "
        f"Maintain natural subtle motion. Do not add any new "
        f"elements, text overlays, or effects unless explicitly requested."
    )


def run_veo_generation(task_id: str, prompt: str, aspect_ratio: str, duration_seconds: int):
    """Run Veo 3 generation in a background thread."""
    try:
        veo_tasks[task_id]['state'] = 'PROCESSING'

        if not GENAI_AVAILABLE:
            time.sleep(5)
            veo_tasks[task_id]['state'] = 'FAILED'
            veo_tasks[task_id]['error_message'] = 'Google GenAI SDK not installed'
            return

        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            veo_tasks[task_id]['state'] = 'FAILED'
            veo_tasks[task_id]['error_message'] = 'GOOGLE_API_KEY not configured'
            return

        client = genai.Client(api_key=api_key)
        print(f"[VEO] Veo 3: Starting generation | task={task_id} | prompt='{prompt[:80]}...'")

        try:
            operation = client.models.generate_videos(
                model=VEO_MODEL,
                prompt=prompt,
                config=types.GenerateVideosConfig(
                    aspect_ratio=aspect_ratio,
                    number_of_videos=1,
                    duration_seconds=duration_seconds,
                    enhance_prompt=True,
                ),
            )

            print(f"[VEO] Veo 3: Operation started | polling for completion...")
            max_polls = 90
            poll_count = 0

            while not operation.done and poll_count < max_polls:
                time.sleep(4)
                poll_count += 1
                try:
                    operation = client.operations.get(operation)
                except Exception as poll_err:
                    print(f"[WARN] Poll error: {poll_err}")

            if not operation.done:
                veo_tasks[task_id]['state'] = 'FAILED'
                veo_tasks[task_id]['error_message'] = 'Generation timed out'
                return

            if operation.response and operation.response.generated_videos:
                generated = operation.response.generated_videos[0]
                # Download the video file locally so we can serve it over HTTP
                video_filename = f"veo_{task_id}.mp4"
                video_path = os.path.join(UPLOAD_FOLDER, video_filename)
                try:
                    client.files.download(file=generated.video)
                    generated.video.save(video_path)
                    print(f"[OK] Veo 3: Saved to {video_path}")
                    try:
                        mp4_faststart(video_path)
                    except Exception as fs_err:
                        print(f"[WARN] Veo 3: fast-start failed ({fs_err}), continuing with original")
                except Exception as dl_err:
                    print(f"[WARN] Veo 3: download/save failed ({dl_err}), trying .uri fallback")
                    video_uri = generated.video.uri if hasattr(generated, 'video') else ''
                    veo_tasks[task_id]['state'] = 'SUCCEEDED'
                    veo_tasks[task_id]['video_url'] = video_uri
                    return

                backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
                serve_url = f"{backend_url}/api/video/serve/{video_filename}"
                veo_tasks[task_id]['state']     = 'SUCCEEDED'
                veo_tasks[task_id]['video_url'] = serve_url
                print(f"[OK] Veo 3: Done | task={task_id} | serve_url={serve_url}")
            else:
                veo_tasks[task_id]['state']         = 'FAILED'
                veo_tasks[task_id]['error_message'] = 'No video generated'

        except Exception as gen_err:
            error_msg = str(gen_err)
            print(f"[ERR] Veo 3 generation error: {error_msg}")
            veo_tasks[task_id]['state'] = 'FAILED'
            if 'not found' in error_msg.lower() or '404' in error_msg or 'not supported' in error_msg.lower():
                veo_tasks[task_id]['error_message'] = (
                    'Veo 3 requires Google AI Gemini API access with video generation enabled. '
                    'Enable it at aistudio.google.com or upgrade your API quota.'
                )
            elif '429' in error_msg or 'RESOURCE_EXHAUSTED' in error_msg or 'quota' in error_msg.lower():
                veo_tasks[task_id]['error_message'] = (
                    'API quota exceeded. Veo 3 video generation has usage limits. '
                    'Wait a few minutes or check your plan at ai.google.dev/rate-limits.'
                )
            else:
                veo_tasks[task_id]['error_message'] = error_msg

    except Exception as e:
        traceback.print_exc()
        veo_tasks[task_id]['state']         = 'FAILED'
        veo_tasks[task_id]['error_message'] = str(e)


@app.route('/api/veo/generate', methods=['POST'])
def veo_generate():
    """Start a Veo 3 video generation task."""
    try:
        data             = request.get_json()
        prompt           = (data.get('prompt') or '').strip()
        aspect_ratio     = data.get('aspect_ratio', '9:16')
        duration_seconds = int(data.get('duration_seconds', 30))

        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        if len(prompt) > 1000:
            return jsonify({'error': 'Prompt too long (max 1000 characters)'}), 400

        valid_ratios = {'9:16', '16:9', '1:1', '4:3'}
        if aspect_ratio not in valid_ratios:
            aspect_ratio = '9:16'

        duration_seconds = max(5, min(duration_seconds, 60))

        task_id = f"veo_{secrets.token_hex(8)}_{int(time.time())}"
        veo_tasks[task_id] = {
            'state':       'QUEUED',
            'prompt':      prompt,
            'aspect_ratio':aspect_ratio,
            'duration':    duration_seconds,
            'created_at':  time.time(),
            'video_url':   None,
            'error_message': None,
        }

        # Start generation in background thread
        thread = threading.Thread(
            target=run_veo_generation,
            args=(task_id, prompt, aspect_ratio, duration_seconds),
            daemon=True,
        )
        thread.start()

        print(f"[VEO] Veo task queued: {task_id}")
        return jsonify({'task_id': task_id, 'state': 'QUEUED'})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/veo/status/<task_id>', methods=['GET'])
def veo_status(task_id):
    """Poll the status of a Veo 3 generation task."""
    task = veo_tasks.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify({
        'task_id':          task_id,
        'state':            task['state'],
        'video_url':        task.get('video_url'),
        'video_filename':   task.get('video_filename'),
        'source_filename':  task.get('source_filename'),
        'thumbnail_url':    task.get('thumbnail_url'),
        'error_message':    task.get('error_message'),
        'prompt':           task.get('prompt', ''),
        'enhanced_prompt':  task.get('enhanced_prompt', ''),
        'duration':         task.get('duration'),
        'aspect_ratio':     task.get('aspect_ratio'),
    })


@app.route('/api/video/serve/<filename>', methods=['GET', 'HEAD'])
def serve_video(filename):
    """Serve a generated video file with full Range request support for ExoPlayer."""
    from flask import Response
    safe_name = secure_filename(filename)
    file_path = os.path.join(UPLOAD_FOLDER, safe_name)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Video file not found'}), 404

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get('Range')

    if range_header:
        # Parse Range: bytes=start-end
        byte_range = range_header.replace('bytes=', '').strip()
        parts = byte_range.split('-')
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        with open(file_path, 'rb') as f:
            f.seek(start)
            data = f.read(length)

        resp = Response(data, status=206, mimetype='video/mp4')
        resp.headers['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        resp.headers['Content-Length'] = str(length)
    else:
        with open(file_path, 'rb') as f:
            data = f.read()
        resp = Response(data, status=200, mimetype='video/mp4')
        resp.headers['Content-Length'] = str(file_size)

    resp.headers['Accept-Ranges'] = 'bytes'
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@app.route('/api/video/stitch', methods=['POST'])
def stitch_video():
    """Stitch AI-edited segment back into original video at [start_time, end_time].

    Accepts:
      - 'video' multipart file  OR  'video_filename' form field — the current full video
      - 'edited_filename' — server-side filename of the AI-edited segment
      - 'start_time' — where the edit begins (seconds)
      - 'end_time' — where the edit ends (seconds)
    Returns: { video_url, video_filename }
    """
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg is not available'}), 500

    try:
        start_time = float(request.form.get('start_time', 0))
        end_time = float(request.form.get('end_time', 0))
        edited_filename = secure_filename(request.form.get('edited_filename', ''))

        if not edited_filename:
            return jsonify({'error': 'edited_filename is required'}), 400
        edited_path = os.path.join(UPLOAD_FOLDER, edited_filename)
        if not os.path.exists(edited_path):
            return jsonify({'error': 'Edited video file not found on server'}), 404

        # Resolve source (current full video)
        if 'video' in request.files:
            video = request.files['video']
            raw_name = secure_filename(video.filename or 'video.mp4')
            source_filename = f"stitch_src_{secrets.token_hex(6)}_{raw_name}"
            source_path = os.path.join(UPLOAD_FOLDER, source_filename)
            video.save(source_path)
        elif request.form.get('video_filename'):
            source_filename = secure_filename(request.form['video_filename'])
            source_path = os.path.join(UPLOAD_FOLDER, source_filename)
            if not os.path.exists(source_path):
                return jsonify({'error': 'Source video not found on server'}), 404
        else:
            return jsonify({'error': 'No source video provided'}), 400

        # Get source video duration — try ffprobe first, then ffmpeg fallback
        source_duration = None

        # Method 1: ffprobe
        try:
            ffprobe_bin = ffmpeg.replace('ffmpeg', 'ffprobe')
            probe_result = subprocess.run(
                [ffprobe_bin, '-v', 'error', '-show_entries', 'format=duration',
                 '-of', 'csv=p=0', source_path],
                capture_output=True, timeout=15, text=True,
            )
            if probe_result.returncode == 0 and probe_result.stdout.strip():
                source_duration = float(probe_result.stdout.strip())
                print(f"[STITCH] Source duration (ffprobe): {source_duration}s")
        except Exception as e:
            print(f"[STITCH] ffprobe failed: {e}")

        # Method 2: ffmpeg -i (parse duration from stderr)
        if source_duration is None:
            try:
                probe2 = subprocess.run(
                    [ffmpeg, '-i', source_path],
                    capture_output=True, timeout=15, text=True,
                )
                import re
                dur_match = re.search(r'Duration:\s*(\d+):(\d+):(\d+)\.(\d+)', probe2.stderr)
                if dur_match:
                    h, m, s, ms = dur_match.groups()
                    source_duration = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 100
                    print(f"[STITCH] Source duration (ffmpeg -i): {source_duration}s")
            except Exception as e:
                print(f"[STITCH] ffmpeg -i duration parse failed: {e}")

        if source_duration is None:
            print(f"[WARN] Could not determine source video duration — part3 will be skipped")

        uid = secrets.token_hex(6)
        part1_path = os.path.join(UPLOAD_FOLDER, f"_part1_{uid}.mp4")
        part3_path = os.path.join(UPLOAD_FOLDER, f"_part3_{uid}.mp4")
        output_filename = f"stitched_{secrets.token_hex(8)}_{int(time.time())}.mp4"
        output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        concat_list_path = os.path.join(UPLOAD_FOLDER, f"_concat_{uid}.txt")

        parts = []
        temp_files = [concat_list_path]

        try:
            # Part 1: original[0 → start_time] (if start_time > 0)
            if start_time > 0.1:
                cmd1 = [ffmpeg, '-y', '-i', source_path,
                        '-t', str(start_time), '-c', 'copy',
                        '-avoid_negative_ts', '1', part1_path]
                subprocess.run(cmd1, capture_output=True, timeout=120)
                if os.path.exists(part1_path) and os.path.getsize(part1_path) > 0:
                    parts.append(part1_path)
                    temp_files.append(part1_path)

            # Part 2: AI-edited segment
            parts.append(edited_path)

            # Part 3: original[end_time → end] (if not at end of video)
            has_part3 = source_duration and (source_duration - end_time) > 0.2
            if has_part3:
                cmd3 = [ffmpeg, '-y', '-i', source_path,
                        '-ss', str(end_time), '-c', 'copy',
                        '-avoid_negative_ts', '1', part3_path]
                subprocess.run(cmd3, capture_output=True, timeout=120)
                if os.path.exists(part3_path) and os.path.getsize(part3_path) > 0:
                    parts.append(part3_path)
                    temp_files.append(part3_path)

            print(f"[STITCH] Parts to concat: {len(parts)} | start={start_time} end={end_time} dur={source_duration}")

            FADE_DUR = 0.3  # Crossfade duration in seconds

            if len(parts) == 1:
                # Only the edited segment — just copy it
                print(f"[WARN] Stitch has only 1 part — returning edited segment as-is")
                import shutil
                shutil.copy2(edited_path, output_path)
            else:
                # Get duration of each part for crossfade offset calculation
                part_durations = []
                for p in parts:
                    dur = _get_video_duration(ffmpeg, p)
                    part_durations.append(dur)
                    print(f"[STITCH] Part {p}: {dur:.2f}s")

                n = len(parts)
                inputs = []
                for p in parts:
                    inputs.extend(['-i', p])

                # Check if all parts have valid durations for crossfade
                can_crossfade = all(d > FADE_DUR * 2 for d in part_durations) and n >= 2

                if can_crossfade:
                    # Build xfade chain for smooth crossfade transitions
                    # xfade offset = cumulative duration of output so far minus fade overlap
                    vfilter_parts = []
                    afilter_parts = []
                    cumulative_dur = part_durations[0]

                    for i in range(1, n):
                        src_v = f'[{i-1}:v]' if i == 1 else f'[v{i-1}]'
                        src_a = f'[{i-1}:a]' if i == 1 else f'[a{i-1}]'
                        dst_v = '[outv]' if i == n - 1 else f'[v{i}]'
                        dst_a = '[outa]' if i == n - 1 else f'[a{i}]'
                        offset = cumulative_dur - FADE_DUR

                        vfilter_parts.append(
                            f'{src_v}[{i}:v]xfade=transition=fade:duration={FADE_DUR}:offset={offset:.3f}{dst_v}'
                        )
                        afilter_parts.append(
                            f'{src_a}[{i}:a]acrossfade=d={FADE_DUR}:c1=tri:c2=tri{dst_a}'
                        )
                        # After xfade, combined duration loses one fade_dur
                        cumulative_dur = cumulative_dur + part_durations[i] - FADE_DUR

                    filter_str = ';'.join(vfilter_parts + afilter_parts)
                    print(f"[STITCH] Crossfade filter: {filter_str}")

                    xfade_cmd = [ffmpeg, '-y'] + inputs + [
                        '-filter_complex', filter_str,
                        '-map', '[outv]', '-map', '[outa]',
                        '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                        '-c:a', 'aac', '-b:a', '128k',
                        '-movflags', '+faststart',
                        output_path,
                    ]
                    result = subprocess.run(xfade_cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

                    # If audio crossfade fails, try video crossfade only
                    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                        print(f"[STITCH] Audio crossfade failed, trying video-only xfade")
                        filter_str_v = ';'.join(vfilter_parts)
                        xfade_v_cmd = [ffmpeg, '-y'] + inputs + [
                            '-filter_complex', filter_str_v,
                            '-map', '[outv]',
                            '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                            '-movflags', '+faststart',
                            output_path,
                        ]
                        subprocess.run(xfade_v_cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

                # Fallback: plain concat (no crossfade) if xfade failed or durations unknown
                if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                    print(f"[STITCH] Falling back to plain concat (no crossfade)")
                    filter_parts_concat = ''.join(f'[{i}:v:0][{i}:a:0]' for i in range(n))
                    filter_str_concat = f'{filter_parts_concat}concat=n={n}:v=1:a=1[outv][outa]'

                    concat_cmd = [ffmpeg, '-y'] + inputs + [
                        '-filter_complex', filter_str_concat,
                        '-map', '[outv]', '-map', '[outa]',
                        '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                        '-c:a', 'aac', '-b:a', '128k',
                        '-movflags', '+faststart',
                        output_path,
                    ]
                    subprocess.run(concat_cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

                    # Last resort: video-only concat
                    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                        filter_parts_v = ''.join(f'[{i}:v:0]' for i in range(n))
                        filter_str_v = f'{filter_parts_v}concat=n={n}:v=1:a=0[outv]'
                        concat_cmd_v = [ffmpeg, '-y'] + inputs + [
                            '-filter_complex', filter_str_v,
                            '-map', '[outv]',
                            '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                            '-movflags', '+faststart',
                            output_path,
                        ]
                        subprocess.run(concat_cmd_v, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                return jsonify({'error': 'Stitch failed — ffmpeg produced no output'}), 500

            # Apply mp4 fast-start
            try:
                mp4_faststart(output_path)
            except Exception:
                pass

            backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
            serve_url = f"{backend_url}/api/video/serve/{output_filename}"

            print(f"[STITCH] Done: {output_filename} ({os.path.getsize(output_path)} bytes) "
                  f"| parts={len(parts)} | start={start_time} end={end_time}")

            return jsonify({
                'video_url': serve_url,
                'video_filename': output_filename,
            })

        finally:
            # Clean up temp files (not the output or edited segment)
            for tf in temp_files:
                try:
                    if os.path.exists(tf):
                        os.remove(tf)
                except Exception:
                    pass

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==========================================
# VIDEO EDITOR — Frame Extraction + Veo Edit
# ==========================================

import subprocess

# ── MP4 Fast-Start (move moov atom before mdat for streaming) ──
def mp4_faststart(filepath: str):
    """Move moov atom to beginning of MP4 for fast-start streaming on Android."""
    import struct as _struct

    with open(filepath, 'rb') as f:
        data = f.read()

    # Parse top-level boxes
    boxes = []
    pos = 0
    while pos < len(data) - 8:
        size = _struct.unpack('>I', data[pos:pos+4])[0]
        box_type = data[pos+4:pos+8]
        if size < 8 or pos + size > len(data):
            break
        boxes.append((box_type, pos, size))
        pos += size

    moov_info = next(((i, o, s) for t, o, s in boxes if t == b'moov' for i in [o]), None)
    mdat_info = next(((i, o, s) for t, o, s in boxes if t == b'mdat' for i in [o]), None)

    if moov_info is None or mdat_info is None:
        return  # Can't fast-start

    moov_offset = moov_info[1] if isinstance(moov_info, tuple) else moov_info
    moov_size = next(s for t, o, s in boxes if t == b'moov')
    mdat_offset = next(o for t, o, s in boxes if t == b'mdat')
    mdat_size = next(s for t, o, s in boxes if t == b'mdat')

    if moov_offset < mdat_offset:
        return  # Already fast-start

    moov_data = bytearray(data[moov_offset:moov_offset + moov_size])
    offset_delta = moov_size

    # Update chunk offsets (stco/co64) inside moov — recursive search
    def _update_stco(buf, start, end, delta):
        p = start
        while p < end - 8:
            sz = _struct.unpack('>I', buf[p:p+4])[0]
            bt = buf[p+4:p+8]
            if sz < 8 or p + sz > end:
                break
            if bt == b'stco':
                cnt = _struct.unpack('>I', buf[p+12:p+16])[0]
                for i in range(cnt):
                    op = p + 16 + i * 4
                    if op + 4 <= end:
                        old = _struct.unpack('>I', buf[op:op+4])[0]
                        _struct.pack_into('>I', buf, op, old + delta)
            elif bt == b'co64':
                cnt = _struct.unpack('>I', buf[p+12:p+16])[0]
                for i in range(cnt):
                    op = p + 16 + i * 8
                    if op + 8 <= end:
                        old = _struct.unpack('>Q', buf[op:op+8])[0]
                        _struct.pack_into('>Q', buf, op, old + delta)
            elif bt in (b'moov', b'trak', b'mdia', b'minf', b'stbl', b'udta', b'edts', b'dinf'):
                _update_stco(buf, p + 8, p + sz, delta)
            p += sz

    _update_stco(moov_data, 8, len(moov_data), offset_delta)

    # Rebuild: everything before mdat + moov + mdat
    with open(filepath, 'wb') as f:
        f.write(data[:mdat_offset])
        f.write(bytes(moov_data))
        f.write(data[mdat_offset:mdat_offset + mdat_size])

    print(f"[OK] MP4 fast-start applied: {filepath}")


# Find ffmpeg binary — try system PATH first, then imageio-ffmpeg fallback
# Uses lazy detection so ffmpeg installed after startup is still found
_ffmpeg_bin_cache = None
_ffmpeg_checked = False

def _get_video_duration(ffmpeg_bin: str, filepath: str) -> float:
    """Get video duration in seconds using ffprobe or ffmpeg -i fallback."""
    # Method 1: ffprobe
    try:
        ffprobe_bin = ffmpeg_bin.replace('ffmpeg', 'ffprobe')
        result = subprocess.run(
            [ffprobe_bin, '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', filepath],
            capture_output=True, timeout=15, text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception:
        pass
    # Method 2: ffmpeg -i (parse duration from stderr)
    try:
        result = subprocess.run(
            [ffmpeg_bin, '-i', filepath],
            capture_output=True, timeout=15, text=True,
        )
        import re as _re
        dur_match = _re.search(r'Duration:\s*(\d+):(\d+):(\d+)\.(\d+)', result.stderr)
        if dur_match:
            h, m, s, ms = dur_match.groups()
            return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 100
    except Exception:
        pass
    return 0.0


def _find_ffmpeg():
    global _ffmpeg_bin_cache, _ffmpeg_checked
    if _ffmpeg_checked:
        return _ffmpeg_bin_cache
    # Try system ffmpeg
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
        if result.returncode == 0:
            _ffmpeg_bin_cache = 'ffmpeg'
            _ffmpeg_checked = True
            return _ffmpeg_bin_cache
    except (FileNotFoundError, Exception):
        pass
    # Try imageio-ffmpeg bundled binary
    try:
        import imageio_ffmpeg
        _ffmpeg_bin_cache = imageio_ffmpeg.get_ffmpeg_exe()
        _ffmpeg_checked = True
        return _ffmpeg_bin_cache
    except ImportError:
        pass
    # Not found — don't cache failure so we retry next call
    return None

FFMPEG_BIN = _find_ffmpeg()
FFMPEG_AVAILABLE = FFMPEG_BIN is not None


def extract_frame_at_timestamp(video_path: str, timestamp: float) -> str:
    """Extract a single frame from a video at the given timestamp using ffmpeg."""
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        raise Exception("ffmpeg is not available. Install ffmpeg or imageio-ffmpeg.")

    frame_filename = f"frame_{secrets.token_hex(6)}_{int(timestamp * 100)}.png"
    frame_path = os.path.join(UPLOAD_FOLDER, frame_filename)

    cmd = [
        ffmpeg, '-y',
        '-ss', str(timestamp),
        '-i', video_path,
        '-vframes', '1',
        '-q:v', '1',
        frame_path,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if os.path.exists(frame_path) and os.path.getsize(frame_path) > 0:
            print(f"[FRAME] Frame extracted: {frame_path} ({os.path.getsize(frame_path)} bytes)")
            return frame_path
        else:
            raise Exception(f"ffmpeg failed. stderr: {result.stderr.decode()[:300]}")
    except FileNotFoundError:
        raise Exception("ffmpeg binary not found despite being detected.")


def run_veo_edit(task_id: str, frame_path: str, prompt: str, aspect_ratio: str, duration_seconds: int):
    """Run Veo 3 image-to-video generation using an extracted frame as seed."""
    try:
        veo_tasks[task_id]['state'] = 'PROCESSING'

        if not GENAI_AVAILABLE:
            time.sleep(3)
            veo_tasks[task_id]['state'] = 'FAILED'
            veo_tasks[task_id]['error_message'] = 'Google GenAI SDK not available'
            return

        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            veo_tasks[task_id]['state'] = 'FAILED'
            veo_tasks[task_id]['error_message'] = 'GOOGLE_API_KEY not configured'
            return

        client = genai.Client(api_key=api_key)
        print(f"[VEO] Veo Edit: Starting | task={task_id} | prompt='{prompt[:60]}...'")

        # Read the frame image
        with open(frame_path, 'rb') as f:
            frame_bytes = f.read()

        # Determine mime type
        ext = os.path.splitext(frame_path)[1].lower()
        mime_map = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}
        mime_type = mime_map.get(ext, 'image/png')

        # Enhance user prompt into Veo 3-compliant surgical edit prompt
        print(f"[VEO] User prompt: '{prompt}'")
        veo_prompt = enhance_prompt_for_veo(prompt)
        print(f"[VEO] Final Veo prompt ({len(veo_prompt)} chars): '{veo_prompt[:150]}...'")
        veo_tasks[task_id]['enhanced_prompt'] = veo_prompt

        try:
            # Use Veo 3 with seed image (image-to-video)
            # Note: enhance_prompt is NOT supported for image-to-video
            operation = client.models.generate_videos(
                model=VEO_MODEL,
                prompt=veo_prompt,
                image=types.Image(
                    image_bytes=frame_bytes,
                    mime_type=mime_type,
                ),
                config=types.GenerateVideosConfig(
                    aspect_ratio=aspect_ratio,
                    number_of_videos=1,
                    duration_seconds=duration_seconds,
                    person_generation='allow_all',
                ),
            )

            print(f"[VEO] Veo Edit: Operation started, polling...")
            max_polls = 90
            poll_count = 0

            while not operation.done and poll_count < max_polls:
                time.sleep(4)
                poll_count += 1
                try:
                    operation = client.operations.get(operation)
                except Exception as poll_err:
                    print(f"[WARN] Poll error: {poll_err}")

            if not operation.done:
                veo_tasks[task_id]['state'] = 'FAILED'
                veo_tasks[task_id]['error_message'] = 'Edit timed out after 6 minutes'
                return

            # ── Diagnostic logging ──
            print(f"[VEO] Operation done. Inspecting response...")
            print(f"[VEO]   operation.done    = {operation.done}")
            print(f"[VEO]   operation.error   = {getattr(operation, 'error', 'N/A')}")
            print(f"[VEO]   operation.response = {operation.response}")
            if operation.response:
                print(f"[VEO]   response type     = {type(operation.response)}")
                print(f"[VEO]   response attrs    = {[a for a in dir(operation.response) if not a.startswith('_')]}")
                gv = getattr(operation.response, 'generated_videos', None)
                print(f"[VEO]   generated_videos  = {gv}")
                rai = getattr(operation.response, 'rai_media_filtered_count', None)
                if rai is not None:
                    print(f"[VEO]   rai_filtered      = {rai}")
                rai_reasons = getattr(operation.response, 'rai_media_filtered_reasons', None)
                if rai_reasons is not None:
                    print(f"[VEO]   rai_reasons       = {rai_reasons}")
            if hasattr(operation, 'metadata'):
                print(f"[VEO]   metadata          = {operation.metadata}")

            # Check for operation-level error
            op_error = getattr(operation, 'error', None)
            if op_error:
                veo_tasks[task_id]['state'] = 'FAILED'
                veo_tasks[task_id]['error_message'] = f'Veo API error: {op_error}'
                print(f"[ERR] Veo Edit: operation.error = {op_error}")
                return

            if operation.response and operation.response.generated_videos:
                generated = operation.response.generated_videos[0]
                # Download the video file locally so we can serve it over HTTP
                video_filename = f"veo_{task_id}.mp4"
                video_path = os.path.join(UPLOAD_FOLDER, video_filename)
                try:
                    client.files.download(file=generated.video)
                    generated.video.save(video_path)
                    print(f"[OK] Veo Edit: Saved to {video_path}")
                    try:
                        mp4_faststart(video_path)
                    except Exception as fs_err:
                        print(f"[WARN] Veo Edit: fast-start failed ({fs_err}), continuing with original")
                except Exception as dl_err:
                    print(f"[WARN] Veo Edit: download/save failed ({dl_err}), trying .uri fallback")
                    video_uri = generated.video.uri if hasattr(generated, 'video') else ''
                    veo_tasks[task_id]['state'] = 'SUCCEEDED'
                    veo_tasks[task_id]['video_url'] = video_uri
                    return

                backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
                serve_url = f"{backend_url}/api/video/serve/{video_filename}"
                veo_tasks[task_id]['state'] = 'SUCCEEDED'
                veo_tasks[task_id]['video_url'] = serve_url
                veo_tasks[task_id]['video_filename'] = video_filename
                print(f"[OK] Veo Edit: Done | task={task_id} | serve_url={serve_url}")
            else:
                # Build detailed error message
                rai_count = getattr(operation.response, 'rai_media_filtered_count', 0) if operation.response else 0
                rai_reasons = getattr(operation.response, 'rai_media_filtered_reasons', None) if operation.response else None
                if rai_count and rai_count > 0:
                    err_msg = f'Video blocked by content safety filter ({rai_count} filtered). '
                    if rai_reasons:
                        err_msg += f'Reasons: {rai_reasons}. '
                    err_msg += 'Try a different prompt or video segment.'
                elif not operation.response:
                    err_msg = 'Veo API returned empty response. The model may not support image-to-video for this content.'
                else:
                    err_msg = 'No edited video generated. Try a clearer prompt or different segment.'
                veo_tasks[task_id]['state'] = 'FAILED'
                veo_tasks[task_id]['error_message'] = err_msg
                print(f"[ERR] Veo Edit: {err_msg}")

        except Exception as gen_err:
            error_msg = str(gen_err)
            print(f"[ERR] Veo Edit error: {error_msg}")
            veo_tasks[task_id]['state'] = 'FAILED'
            if 'not found' in error_msg.lower() or '404' in error_msg or 'not supported' in error_msg.lower():
                veo_tasks[task_id]['error_message'] = (
                    'Veo 3 image-to-video requires API access with video generation enabled. '
                    'Check aistudio.google.com for quota.'
                )
            elif '429' in error_msg or 'RESOURCE_EXHAUSTED' in error_msg or 'quota' in error_msg.lower():
                veo_tasks[task_id]['error_message'] = (
                    'API quota exceeded. Veo 3 video generation has usage limits. '
                    'Wait a few minutes or check your plan at ai.google.dev/rate-limits.'
                )
            else:
                veo_tasks[task_id]['error_message'] = error_msg

    except Exception as e:
        traceback.print_exc()
        veo_tasks[task_id]['state'] = 'FAILED'
        veo_tasks[task_id]['error_message'] = str(e)
    finally:
        # Clean up frame file
        try:
            if os.path.exists(frame_path):
                os.remove(frame_path)
        except Exception:
            pass


@app.route('/api/video/extract-frame', methods=['POST'])
def extract_frame_endpoint():
    """Extract a frame from an uploaded video at a specific timestamp."""
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400

        video = request.files['video']
        timestamp = float(request.form.get('timestamp', 0))

        filename = secure_filename(video.filename or 'video.mp4')
        video_path = os.path.join(UPLOAD_FOLDER, f"edit_{secrets.token_hex(6)}_{filename}")
        video.save(video_path)

        try:
            frame_path = extract_frame_at_timestamp(video_path, timestamp)
            with open(frame_path, 'rb') as f:
                frame_data = base64.b64encode(f.read()).decode('utf-8')

            # Clean up
            os.remove(frame_path)
            os.remove(video_path)

            return jsonify({
                'frame_base64': frame_data,
                'timestamp': timestamp,
                'mime_type': 'image/png',
            })
        except Exception as e:
            if os.path.exists(video_path):
                os.remove(video_path)
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==========================================
# REMOTION + CLAUDE — AI VIDEO EDITING (CODE GENERATION)
# ==========================================

REMOTION_URL = os.getenv('REMOTION_SERVICE_URL', 'http://localhost:3100')

# Step 1 prompt: Claude decides what video info it needs from Gemini
CLAUDE_VISION_DECISION_PROMPT = """You decide whether a video edit request needs visual analysis of the source video.

Think critically about TWO things:
1. Does the edit reference specific objects, people, body parts, or spatial positions?
2. Does the referenced object MOVE during the video (e.g., hands gesturing, person walking)?

There are TWO analysis modes:
- "static": Analyze a single frame (for stationary objects or zoom targets — face position, background layout, etc.)
- "motion": Track an object across multiple frames (for effects that must follow moving objects — fire on moving hands, glow around a walking person, etc.)

Examples that NEED static vision:
- "zoom in on my face" -> face doesn't move much, just need position
- "text above my head" -> head position (roughly static)
- "blur the background" -> need person vs background areas

Examples that NEED motion tracking:
- "add fire from my hands" -> hands move, fire must follow
- "add fireball on my hand" -> hand sweeps across screen, effect must track it
- "add glow trail following me" -> person moves, need trajectory
- "sparkles around my moving hand" -> hand in motion

Examples that DON'T need vision:
- "add rain effect" -> covers full frame
- "add text HELLO in the center" -> explicit position given
- "slow zoom in" -> no spatial reference to video content
- "add neon glow border" -> frame-level effect

Return ONLY valid JSON:
{
  "needs_vision": true or false,
  "tracking_mode": "static" or "motion",
  "vision_prompt": "specific question to ask (only if needs_vision is true)"
}

If needs_vision is true, write a precise vision_prompt asking for positions as percentages (x% from left, y% from top).
For motion mode, focus on what object to track (e.g., "Track the position of both hands in each frame")."""


def _extract_frame(ffmpeg_bin: str, video_path: str, timestamp: float) -> str:
    """Extract a single frame from video at given timestamp. Returns path to jpg."""
    frame_path = os.path.join(UPLOAD_FOLDER, f"frame_{secrets.token_hex(4)}_{int(timestamp*100)}.jpg")
    cmd = [
        ffmpeg_bin, '-y',
        '-ss', str(max(0, timestamp)),
        '-i', video_path,
        '-vframes', '1',
        '-q:v', '2',
        frame_path,
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=10, encoding='utf-8', errors='replace')
    if result.returncode != 0 or not os.path.exists(frame_path):
        return ''
    return frame_path


def analyze_frame_with_gemini(video_path: str, timestamp: float, vision_prompt: str) -> str:
    """Extract a frame at timestamp and ask Gemini a specific question about it."""
    ffmpeg = _find_ffmpeg()
    if not ffmpeg or not GENAI_AVAILABLE:
        return ''

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        return ''

    frame_path = _extract_frame(ffmpeg, video_path, timestamp)
    if not frame_path:
        return ''

    try:
        with open(frame_path, 'rb') as f:
            frame_bytes = f.read()

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=[
                vision_prompt + '\nBe precise with spatial positions as percentages (x% from left, y% from top). Give detailed, thorough analysis — do NOT truncate.',
                types.Part.from_bytes(data=frame_bytes, mime_type='image/jpeg'),
            ],
            config=types.GenerateContentConfig(
                max_output_tokens=8000,
            ),
        )

        analysis = response.text.strip()
        print(f"[EDIT] Gemini vision: {analysis[:200]}")
        return analysis

    except Exception as e:
        print(f"[WARN] Gemini vision failed: {e}")
        return ''
    finally:
        try:
            os.remove(frame_path)
        except Exception:
            pass


def analyze_video_motion_with_gemini(video_path: str, start_time: float,
                                       duration: float, vision_prompt: str,
                                       num_samples: int = 5) -> str:
    """Extract multiple frames across the segment and track object positions over time.

    Returns a trajectory description like:
      "Frame at 0.0s: hand at 20% left, 50% top
       Frame at 1.0s: hand at 40% left, 48% top
       Frame at 2.0s: hand at 60% left, 45% top
       ..."
    This gives Claude the data to animate effects along a motion path.
    """
    ffmpeg = _find_ffmpeg()
    if not ffmpeg or not GENAI_AVAILABLE:
        return ''

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        return ''

    # Sample evenly across the segment (at least 3 frames, max num_samples)
    num_frames = max(3, min(num_samples, int(duration * 2)))  # ~2 fps sampling
    if duration <= 1:
        num_frames = 3
    step = duration / max(1, num_frames - 1)
    timestamps = [start_time + i * step for i in range(num_frames)]

    # Extract all frames
    frame_paths = []
    for ts in timestamps:
        fp = _extract_frame(ffmpeg, video_path, ts)
        if fp:
            frame_paths.append((ts - start_time, fp))  # relative time within segment

    if not frame_paths:
        return ''

    print(f"[EDIT] Motion tracking: extracted {len(frame_paths)} frames across {duration}s segment")

    try:
        client = genai.Client(api_key=api_key)

        # Build multi-frame prompt asking Gemini to track positions across frames
        contents = [
            f"""You are analyzing {len(frame_paths)} frames from a video segment ({duration:.1f}s long).
{vision_prompt}

For EACH frame below, report the position of the requested object as percentages (x% from left, y% from top).
Format your response as a structured list:
Frame at [time]s: [object] at [x]% left, [y]% top
Frame at [time]s: [object] at [x]% left, [y]% top
...

Be precise. If the object is not visible in a frame, say "not visible".
Keep response concise — just the position data.""",
        ]

        for rel_time, fp in frame_paths:
            with open(fp, 'rb') as f:
                frame_bytes = f.read()
            contents.append(f"\nFrame at {rel_time:.1f}s:")
            contents.append(types.Part.from_bytes(data=frame_bytes, mime_type='image/jpeg'))

        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=contents,
            config=types.GenerateContentConfig(
                max_output_tokens=8000,
            ),
        )

        analysis = response.text.strip()
        print(f"[EDIT] Motion tracking result: {analysis[:300]}")
        return analysis

    except Exception as e:
        print(f"[WARN] Gemini motion tracking failed: {e}")
        return ''
    finally:
        for _, fp in frame_paths:
            try:
                os.remove(fp)
            except Exception:
                pass


CLAUDE_EDIT_SYSTEM = """You are an expert Remotion video effects engineer. You write complete React/TypeScript components that render visual effects on top of source video.

You ALWAYS generate a full Remotion component. Think critically about what the user wants and make it happen.

If video analysis data is provided, USE IT to accurately position effects relative to actual content in the video (faces, hands, objects, etc.).

## USING MOTION TRAJECTORY DATA
When you receive motion trajectory data (multiple positions over time), you MUST animate the effect to follow the object's path using interpolate() keyframes.

Example trajectory from Gemini:
  "Frame at 0.0s: right hand at 25% left, 60% top
   Frame at 0.5s: right hand at 40% left, 55% top
   Frame at 1.0s: right hand at 55% left, 50% top
   Frame at 1.5s: right hand at 70% left, 52% top"

Convert each position to frame numbers and use interpolate():
```
const { fps, durationInFrames, width, height } = useVideoConfig();
// Convert trajectory timestamps to frame-based keyframes
const xPos = interpolate(frame, [0*fps, 0.5*fps, 1*fps, 1.5*fps], [0.25*width, 0.40*width, 0.55*width, 0.70*width], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
const yPos = interpolate(frame, [0*fps, 0.5*fps, 1*fps, 1.5*fps], [0.60*height, 0.55*height, 0.50*height, 0.52*height], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
// Position the effect at (xPos, yPos) using transform: translate or left/top
```

RULES for motion-tracked effects:
- Convert ALL trajectory points to interpolate() keyframes — do NOT skip any
- Use width/height multipliers (percentage-based) so it scales to any resolution
- Position the effect's CENTER at the tracked point (offset by half the effect's size)
- Add natural trailing motion: secondary elements slightly delayed (e.g., fire trail, glow afterimage)
- For particle effects (fire, sparkles), emit from the tracked position each frame
- Extrapolate with 'clamp' on both ends so the effect stays at first/last position beyond the data range

## COMPONENT RULES
- Component name: GeneratedEffect
- Props: { sourceVideo: string }
- Import from 'remotion': useCurrentFrame, useVideoConfig, interpolate, spring, OffthreadVideo, Easing, AbsoluteFill
- MUST render sourceVideo as background: <OffthreadVideo src={sourceVideo} style={{width:'100%',height:'100%',objectFit:'cover'}} />
- Add effects on TOP of the video using absolutely positioned layers
- All styles MUST be inline objects (no CSS imports, no styled-components)
- Use useCurrentFrame() for frame number (animation driver)
- Use useVideoConfig() for { fps, durationInFrames, width, height }
- Use interpolate(value, [inputRange], [outputRange], {extrapolateRight:'clamp'}) for smooth value mapping
- CRITICAL: interpolate() inputRange MUST be strictly monotonically increasing (e.g. [0, 30, 60, 90], NEVER [100, 50, 0])
- Use spring({frame, fps, config:{damping:N, stiffness:N, mass:N}}) for bouncy/physics motion
- For deterministic randomness, use a seeded pseudo-random: seed a value from particle index, NEVER use Math.random()

## WHEN TO USE CANVAS vs CSS
DECISION TREE — follow this strictly:

**USE CANVAS 2D** for:
- Fire, flames, fireballs — particle simulation with physics
- Smoke, fog, mist — soft fluid particles
- Rain, snow — mass particle systems with depth
- Sparks, embers, confetti — flying particle debris
- Melting, dripping, lava — fluid simulation
- Lightning, electricity — branching procedural lines
- Explosions, shockwaves — radial particle bursts
- Any effect requiring 50+ individual animated elements
- Any effect that needs to look ORGANIC and NATURAL

**USE CSS/HTML** for:
- Text overlays — styled divs with text-shadow, gradient fills
- Zoom, pan, shake, tilt — CSS transform on a wrapper div
- Color grading, vignette — CSS filter, gradients, overlays
- Borders, frames — simple positioned divs
- Glow effects on text/borders — box-shadow stacks
- Glitch/VHS — CSS transforms + blend modes

**COMBINE BOTH** when request has multiple parts:
- "text with fire" → CSS text + Canvas fire particles rising from text position
- "zoom with rain" → CSS transform zoom wrapper + Canvas rain on top
- "neon text with sparks" → CSS neon text-shadow + Canvas spark particles

## CANVAS 2D RENDERING PATTERN
Use a <canvas> element with a React ref. Draw every frame based on useCurrentFrame().

```typescript
const canvasRef = React.useRef<HTMLCanvasElement>(null);
const frame = useCurrentFrame();
const { width, height, fps, durationInFrames } = useVideoConfig();

React.useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);

  // --- DRAW YOUR EFFECT HERE ---
  // Use 'frame' as the time driver
  // Use 'width' and 'height' for positioning

}, [frame, width, height]);

// In JSX:
<canvas ref={canvasRef} width={width} height={height}
  style={{position:'absolute', top:0, left:0, width:'100%', height:'100%'}} />
```

CRITICAL CANVAS RULES:
- ctx.clearRect(0,0,width,height) at the START of every frame
- Use ctx.globalCompositeOperation = 'lighter' for ALL light effects (fire, glow, sparks) — this is the Canvas equivalent of mix-blend-mode:'screen' and makes light effects ADD together naturally
- Use ctx.globalAlpha for transparency
- Use ctx.shadowBlur + ctx.shadowColor for glow on every particle
- Use createRadialGradient() for soft, organic particles — NEVER just fillRect
- ALWAYS vary particle size, opacity, speed, and lifetime for depth

## SEEDED RANDOM — DETERMINISTIC RANDOMNESS FOR PARTICLES
NEVER use Math.random() — it produces different results each frame. Use this seeded PRNG:

```typescript
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
// Usage: seededRandom(particleIndex * 1000 + 1) gives a stable random 0-1 for each particle
// For properties that vary: seededRandom(i * 1000 + 1) for x, seededRandom(i * 1000 + 2) for y, etc.
```

## FIRE / FLAMES — CANVAS PARTICLE SYSTEM
Fire MUST use Canvas 2D with 200+ particles simulating heat physics. NEVER use CSS divs for fire.

```typescript
// Inside the useEffect, after clearRect:
ctx.globalCompositeOperation = 'lighter'; // additive blending = realistic light

const PARTICLE_COUNT = 250;
const t = frame / fps; // time in seconds

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const seed1 = seededRandom(i * 1000 + 1);
  const seed2 = seededRandom(i * 1000 + 2);
  const seed3 = seededRandom(i * 1000 + 3);
  const seed4 = seededRandom(i * 1000 + 4);

  // Particle lifecycle: each particle loops with its own period
  const period = 0.8 + seed1 * 1.5; // 0.8-2.3s lifecycle
  const phase = seed2 * period; // offset so they don't sync
  const life = ((t + phase) % period) / period; // 0→1 over lifecycle

  // Position: spawn near base, rise upward, drift sideways
  const spawnX = width * (0.3 + seed3 * 0.4); // spread across fire width
  const drift = Math.sin(t * 2 + seed4 * 6.28) * 30 * seed2; // sideways turbulence
  const x = spawnX + drift + (seed4 - 0.5) * 60;
  const y = height * 0.7 - life * height * (0.25 + seed1 * 0.2); // rise from bottom

  // Size: starts medium, grows slightly, shrinks at end
  const baseSize = 8 + seed3 * 25;
  const sizeLife = life < 0.3 ? life / 0.3 : life < 0.7 ? 1 : 1 - (life - 0.7) / 0.3;
  const size = baseSize * sizeLife;

  // Color: white-hot core → yellow → orange → red → transparent (by life)
  const r = 255;
  const g = Math.floor(255 - life * 200);
  const b = Math.floor(80 - life * 80);
  const alpha = (1 - life) * (0.6 + seed2 * 0.4);

  // Draw soft radial gradient particle
  const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
  grad.addColorStop(0, `rgba(${r},${Math.min(255, g+50)},${Math.min(255, b+30)},${alpha})`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.6})`);
  grad.addColorStop(1, `rgba(${r},${Math.max(0, g-50)},0,0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

// Glow layer: large soft circle at fire base
ctx.globalCompositeOperation = 'lighter';
const baseGlow = ctx.createRadialGradient(width*0.5, height*0.7, 0, width*0.5, height*0.7, width*0.4);
baseGlow.addColorStop(0, 'rgba(255,150,50,0.15)');
baseGlow.addColorStop(0.5, 'rgba(255,80,20,0.08)');
baseGlow.addColorStop(1, 'rgba(255,30,0,0)');
ctx.fillStyle = baseGlow;
ctx.fillRect(0, 0, width, height);
```

FIRE RULES:
- 200+ particles minimum for full fire, 100+ for small flames on text
- Color gradient: white core → yellow → orange → red → transparent over lifetime
- Particles RISE (y decreases over life), DRIFT sideways (sin wave turbulence), GROW then SHRINK
- ctx.globalCompositeOperation = 'lighter' — this makes overlapping particles glow brighter at centers
- Add EMBER SPARKS: 30-50 tiny (2-5px) bright yellow particles that rise faster and higher with erratic horizontal drift
- Add SMOKE: 20-30 large (40-80px) dark gray particles (rgba(100,100,100,0.05-0.1)) rising above the flames with heavy size growth
- For fire ON TEXT: spawn particles from the text's bounding box (top edge for flames rising, bottom for drips)
- shadowBlur: 15-25, shadowColor matching particle color — adds soft glow around each particle

## MELTING / DRIPPING — CANVAS FLUID SIMULATION
Melting uses drip particles that stretch downward with gravity physics.

```typescript
// Drip particles: spawn along bottom edge of text, fall with acceleration
const DRIP_COUNT = 40;
for (let i = 0; i < DRIP_COUNT; i++) {
  const seed1 = seededRandom(i * 2000 + 1);
  const seed2 = seededRandom(i * 2000 + 2);
  const seed3 = seededRandom(i * 2000 + 3);

  // Each drip starts at a different time (staggered)
  const startDelay = seed1 * durationInFrames * 0.5;
  const dripFrame = frame - startDelay;
  if (dripFrame < 0) continue;

  const dripT = dripFrame / durationInFrames; // 0→1 progress

  // Spawn position: along text bottom edge
  const spawnX = textLeft + seed2 * textWidth;
  const spawnY = textBottom;

  // Gravity: accelerate downward. y = 0.5 * g * t^2
  const gravity = height * 0.8;
  const x = spawnX + Math.sin(dripT * 3 + seed3 * 6) * 5; // slight wobble
  const y = spawnY + gravity * dripT * dripT;

  // Drip shape: elongated vertically, stretches as it falls
  const dripWidth = 4 + seed3 * 8;
  const dripHeight = 10 + dripT * 30; // stretches over time

  // Color: molten — match text gradient (orange/yellow/white-hot)
  const alpha = Math.max(0, 1 - dripT * 1.5);

  const grad = ctx.createLinearGradient(x, y - dripHeight/2, x, y + dripHeight/2);
  grad.addColorStop(0, `rgba(255,200,50,${alpha * 0.3})`); // thin top
  grad.addColorStop(0.4, `rgba(255,150,30,${alpha})`);       // thick middle
  grad.addColorStop(1, `rgba(255,80,0,${alpha * 0.5})`);     // tapered bottom

  ctx.fillStyle = grad;
  ctx.shadowBlur = 8;
  ctx.shadowColor = `rgba(255,100,0,${alpha * 0.5})`;
  ctx.beginPath();
  // Rounded drip shape
  ctx.ellipse(x, y, dripWidth/2, dripHeight/2, 0, 0, Math.PI * 2);
  ctx.fill();
}
```

MELTING RULES:
- 30-50 drip particles, staggered start times so they don't all drip at once
- Each drip accelerates downward (gravity), slight horizontal wobble
- Drips stretch vertically as they fall (increasing height)
- Color matches the source element (molten metal for fire text, etc.)
- Add pooling: where drips land, draw small spreading puddles (wide, flat ellipses)
- Drips should also have glow (shadowBlur) matching their color

## SMOKE — CANVAS SOFT PARTICLES
```typescript
ctx.globalCompositeOperation = 'screen';
const SMOKE_COUNT = 40;
for (let i = 0; i < SMOKE_COUNT; i++) {
  const seed1 = seededRandom(i * 3000 + 1);
  const life = ((t + seed1 * 3) % (2 + seed1 * 2)) / (2 + seed1 * 2);
  const x = width * (0.3 + seed1 * 0.4) + Math.sin(t + i) * 40;
  const y = height * 0.5 - life * height * 0.4;
  const size = 40 + life * 120; // grows as it rises
  const alpha = (1 - life) * 0.08; // very faint
  const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
  grad.addColorStop(0, `rgba(180,180,200,${alpha})`);
  grad.addColorStop(1, 'rgba(100,100,120,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}
```

## RAIN — CANVAS MASS PARTICLES WITH DEPTH
```typescript
ctx.globalCompositeOperation = 'lighter';
const layers = [{count:200, speed:25, len:22, w:1.5, alpha:0.6}, {count:150, speed:18, len:16, w:1, alpha:0.35}, {count:100, speed:12, len:10, w:0.7, alpha:0.15}]; // front, mid, back
const angle = 0.1; // slight diagonal
layers.forEach((layer, li) => {
  for (let i = 0; i < layer.count; i++) {
    const sx = seededRandom(i*500+li*10000+1);
    const sy = seededRandom(i*500+li*10000+2);
    const x = (sx * width * 1.2 - width * 0.1 + frame * Math.sin(angle) * layer.speed * 0.3) % (width * 1.2) - width * 0.1;
    const y = (sy * height * 1.3 + frame * layer.speed) % (height * 1.3) - height * 0.15;
    ctx.strokeStyle = `rgba(180,210,255,${layer.alpha})`;
    ctx.lineWidth = layer.w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(angle) * layer.len, y + Math.cos(angle) * layer.len);
    ctx.stroke();
  }
});
```

## SPARKLES / STARS — CANVAS TWINKLE
```typescript
ctx.globalCompositeOperation = 'lighter';
for (let i = 0; i < 60; i++) {
  const sx = seededRandom(i*400+1) * width;
  const sy = seededRandom(i*400+2) * height;
  const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.1 * (1 + seededRandom(i*400+3)) + i);
  const size = (3 + seededRandom(i*400+4) * 8) * twinkle;
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#fff';
  ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.9})`;
  // 4-pointed star
  ctx.beginPath();
  ctx.moveTo(sx, sy - size); ctx.lineTo(sx + size*0.3, sy);
  ctx.lineTo(sx, sy + size); ctx.lineTo(sx - size*0.3, sy);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx - size, sy); ctx.lineTo(sx, sy + size*0.3);
  ctx.lineTo(sx + size, sy); ctx.lineTo(sx, sy - size*0.3);
  ctx.closePath(); ctx.fill();
}
```

## COMBINED EFFECTS — LAYERING CANVAS + CSS
When the user requests multiple effects (e.g. "text with fire and melting"):
1. Render OffthreadVideo as the base layer
2. Canvas layer(s) for particles/fire/smoke/melting — use SINGLE canvas, draw all particle systems in order (back to front)
3. CSS layer for text on top — styled div with text-shadow, gradient fill
4. IMPORTANT: Pass text position info to canvas so particles know where to spawn. Calculate text bounds from font size and text length, then use those coordinates in canvas particle spawning.

Stagger timing:
- Text appears: frames 0 → fps*0.5 (spring entrance)
- Fire ignites: starts at frame fps*0.3, ramps up over fps*0.5
- Melting begins: starts at frame fps*0.8, accelerates
- Smoke rises: starts at frame fps*0.5, continuous

## TEXT STYLING (CSS — NOT CANVAS)
Keep text as HTML/CSS for sharp, crisp rendering with advanced styling:
- fontWeight: 900, fontFamily: 'Impact, Arial Black, sans-serif'
- Size: width*0.08 to width*0.15 (BIG and readable)
- MINIMUM 4 text-shadow layers with increasing blur
- Gradient fill: background with linear-gradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'
- Entrance: spring() with translateY + blur + opacity
- For "fire text": gradient from white center to orange/red edges, massive orange/red text-shadow glow stack

## CAMERA EFFECTS (CSS TRANSFORMS — TIKTOK ZOOM STYLES)
ALL zoom effects wrap the ENTIRE content (video + overlays) in a transform div. Use transformOrigin to target the focal point.

Slow/Cinematic Zoom (default):
```
const scale = interpolate(frame, [0, durationInFrames], [1, 1.3], {extrapolateRight:'clamp', easing: Easing.bezier(0.25,0.1,0.25,1)});
// transformOrigin at focal point from Gemini vision data
```

Face Zoom (TikTok reaction style — zooms into face):
```
// Gemini provides face position (faceX%, faceY%)
const faceScale = interpolate(frame, [0, fps*0.8, fps*1.2, durationInFrames], [1, 2.2, 2.2, 1], {extrapolateRight:'clamp'});
// transformOrigin: `${faceX}% ${faceY}%`
// Add vignette at max zoom: radial-gradient(ellipse, transparent 50%, rgba(0,0,0,0.4))
```

Crash Zoom (sudden dramatic — TikTok meme/punchline style):
```
const crashAt = fps * 0.5; // when the zoom hits
const t = Math.max(0, frame - crashAt);
const crashScale = t <= 0 ? 1 : interpolate(t, [0, 4, 6, fps], [1, 2.5, 2.3, 2.3], {extrapolateRight:'clamp'});
// Impact shake: decaying sin/cos
const decay = Math.exp(-t * 0.3);
const shakeX = t > 0 ? Math.sin(t * 15) * 8 * decay : 0;
const shakeY = t > 0 ? Math.cos(t * 12) * 6 * decay : 0;
// White flash frame at crash: 0.3 opacity for 2 frames
// Motion blur during the 4-frame zoom: filter blur(2px)
```

Body Zoom (follows person — uses motion tracking data):
```
// Animate BOTH scale AND transformOrigin using Gemini trajectory
const bodyX = interpolate(frame, [0*fps, 0.5*fps, 1*fps, ...], [50, 45, 40, ...], {extrapolateRight:'clamp'});
const bodyY = interpolate(frame, [0*fps, 0.5*fps, 1*fps, ...], [50, 48, 52, ...], {extrapolateRight:'clamp'});
const scale = interpolate(frame, [0, durationInFrames*0.3, durationInFrames], [1, 1.8, 1.8], {extrapolateRight:'clamp'});
// transform: scale(N), transformOrigin: `${bodyX}% ${bodyY}%`
```

Zoom In-Then-Out (dramatic reveal):
```
const mid = durationInFrames / 2;
const scale = interpolate(frame, [0, mid, durationInFrames], [1, 1.4, 1], {extrapolateRight:'clamp'});
```

VHS/Glitch:
```
// RGB split: 3 copies offset by 2-4px
// Scanlines: repeating-linear-gradient overlay
// Jitter: translateX via sin(frame*7.3+sin(frame*0.7)*10)*3
```

## LOTTIE ANIMATIONS — PROFESSIONAL MOTION GRAPHICS
You can use Lottie animations from LottieFiles for polished, professional effects. These are After Effects animations exported as JSON — they look MUCH better than hand-coded effects for things like:
- Animated stickers, emoji reactions, badges
- Professional text reveal/title animations
- Transition effects (wipe, dissolve, geometric)
- Decorative frames, borders, overlays
- Celebration effects (confetti bursts, party poppers)

To use Lottie, import and use it like this:
```typescript
import {Lottie, LottieAnimationData} from '@remotion/lottie';
import {staticFile} from 'remotion';

// Method 1: Load from URL (LottieFiles CDN)
const [animData, setAnimData] = React.useState<LottieAnimationData | null>(null);
React.useEffect(() => {
  fetch('https://lottie.host/ANIMATION_ID/FILENAME.json')
    .then(r => r.json())
    .then(data => setAnimData(data))
    .catch(() => {});
}, []);

// Render:
{animData && (
  <Lottie
    animationData={animData}
    style={{position:'absolute', width: 300, height: 300, top: '20%', left: '50%', transform: 'translateX(-50%)'}}
    playbackRate={1}
  />
)}
```

WHEN TO USE LOTTIE vs CANVAS:
- Lottie: stickers, badges, decorative overlays, title animations, celebration effects, UI elements
- Canvas: fire, smoke, rain, snow, particles, fluid effects, anything physics-based
- COMBINE both: Lottie animated sticker + Canvas particle trail behind it

POPULAR FREE LOTTIE URLs you can reference:
- Fire burst: https://lottie.host/2bc21e58-4c5a-4093-a498-4b72c1030067/mKOPPEVnXN.json
- Confetti celebration: https://lottie.host/0e30b3f2-2f2a-4e47-88c8-1e76a4bf42f7/o8RsPKmYpb.json
- Star sparkle: https://lottie.host/e2a6a38a-36c2-4510-9f3b-5a3df607eb9e/OOVAuoOcfV.json
- Heart burst: https://lottie.host/fa211a10-c2c8-4c87-b98f-3e3ded0e3a8b/JUOdOZJZAX.json
- Lightning: https://lottie.host/4db68bbd-31f6-4cd8-84eb-189572c9a8e4/21RkCilpZP.json
- Crown/badge: https://lottie.host/d6671c6a-0e90-4c86-aff3-40e429eea984/vB6MfGGxQK.json

NOTE: Lottie fetch is async. Always handle the loading state (render nothing until data loads). The Lottie component will auto-sync to Remotion's frame timeline.

## QUALITY STANDARDS — NON-NEGOTIABLE
You are a SENIOR VFX artist making content for VIRAL social media. Think Drake music video, not school project.

CANVAS EFFECTS:
- MINIMUM 150 particles for full-screen effects, 80+ for localized effects
- ALWAYS use ctx.globalCompositeOperation = 'lighter' for ANY light effect (fire, sparks, glow, neon)
- ALWAYS use createRadialGradient for soft particles — NEVER just fillStyle with a flat color
- ALWAYS vary: size (3x range), opacity (0.3-1.0), speed (2x range), lifetime between particles
- ALWAYS add secondary effects: fire needs embers+smoke, rain needs splashes, text needs glow
- ALWAYS add shadowBlur (10-25px) + shadowColor on bright particles for halo glow

TEXT:
- Minimum 4 text-shadow layers, fontWeight 900, size relative to width (width*0.08 to width*0.15)
- Gradient fill (WebkitBackgroundClip:'text') for premium look
- Spring entrance animation — never just pop in
- Every text overlay should feel like a professional TikTok caption

GENERAL:
- NEVER use plain rectangles/circles as visual effects — every particle needs gradient + glow
- Handle the FULL user request — if they say text + fire + melting, generate ALL THREE
- Add subtle ambient effects even when not asked — slight vignette on zooms, lens flare on bright effects
- Every effect should look like it belongs in a 10M+ views TikTok

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no explanation):
{
  "code": "import React from 'react';\\nimport {useCurrentFrame, useVideoConfig, interpolate, spring, OffthreadVideo, Easing, AbsoluteFill} from 'remotion';\\n\\ntype Props = {sourceVideo: string};\\n\\nexport const GeneratedEffect: React.FC<Props> = ({sourceVideo}) => {\\n  ...\\n};",
  "description": "brief description"
}"""


def _claude_decide_vision(user_prompt: str, api_key: str) -> dict:
    """Step 1: Claude decides if it needs video analysis from Gemini."""
    client = anthropic.Anthropic(api_key=api_key)
    # Use streaming to avoid timeout on Opus long-request requirement
    text = ''
    with client.messages.stream(
        model='claude-opus-4-20250514',
        max_tokens=300,
        system=CLAUDE_VISION_DECISION_PROMPT,
        messages=[{'role': 'user', 'content': f'Edit request: "{user_prompt}"'}],
    ) as stream:
        for chunk in stream.text_stream:
            text += chunk
    text = text.strip()
    if text.startswith('```'):
        text = '\n'.join(text.split('\n')[1:])
    if text.endswith('```'):
        text = '\n'.join(text.split('\n')[:-1])
    return json.loads(text.strip())


def interpret_edit_with_claude(user_prompt: str, segment_duration: float,
                                video_path: str = None, timestamp: float = 0) -> dict:
    """Two-step flow:
    1. Claude decides if it needs video analysis (spatial info from Gemini)
    2. If yes, Gemini analyzes the frame and provides context
    3. Claude generates the Remotion component with full context
    """
    if not ANTHROPIC_AVAILABLE:
        raise Exception('Anthropic SDK not available - cannot generate effects')

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise Exception('ANTHROPIC_API_KEY not set')

    # Step 1: Claude decides if video analysis is needed (and whether to track motion)
    video_context = ''
    try:
        decision = _claude_decide_vision(user_prompt, api_key)
        needs_vision = decision.get('needs_vision', False)
        tracking_mode = decision.get('tracking_mode', 'static')
        vision_prompt = decision.get('vision_prompt', '')

        print(f"[EDIT] Vision needed: {needs_vision}, mode: {tracking_mode}")
        if needs_vision and vision_prompt:
            print(f"[EDIT] Vision question: {vision_prompt[:120]}")

        # Step 2: If needed, ask Gemini to analyze the video
        if needs_vision and vision_prompt and video_path:
            if tracking_mode == 'motion':
                # Multi-frame tracking: extract frames across the segment and track object
                video_context = analyze_video_motion_with_gemini(
                    video_path, timestamp, segment_duration, vision_prompt
                )
            else:
                # Single-frame static analysis (face position, layout, etc.)
                video_context = analyze_frame_with_gemini(video_path, timestamp, vision_prompt)

            if video_context:
                print(f"[EDIT] Got video context ({tracking_mode}): {video_context[:200]}")
            else:
                print(f"[EDIT] Gemini vision returned empty, proceeding without context")

    except Exception as e:
        print(f"[WARN] Vision decision failed ({e}), proceeding without video analysis")

    # Step 3: Claude generates Remotion code with full context
    user_message = f'Edit request: "{user_prompt}"\nVideo segment duration: {segment_duration} seconds'
    if video_context:
        if tracking_mode == 'motion':
            user_message += (
                f'\n\nMotion trajectory (from Gemini multi-frame tracking):\n{video_context}'
                f'\n\nUse these positions as interpolate() keyframes to animate the effect '
                f'along the object\'s path. Convert each timestamp to frame number (timestamp * fps).'
            )
        else:
            user_message += f'\n\nVideo analysis (from Gemini vision):\n{video_context}'

    client = anthropic.Anthropic(api_key=api_key)
    # Use streaming — required for Opus with high max_tokens
    text = ''
    with client.messages.stream(
        model='claude-opus-4-20250514',
        max_tokens=32000,
        system=CLAUDE_EDIT_SYSTEM,
        messages=[{'role': 'user', 'content': user_message}],
    ) as stream:
        for chunk in stream.text_stream:
            text += chunk
    text = text.strip()
    # Strip markdown fences if present
    if text.startswith('```'):
        text = '\n'.join(text.split('\n')[1:])
    if text.endswith('```'):
        text = '\n'.join(text.split('\n')[:-1])
    text = text.strip()

    parsed = json.loads(text)

    if not parsed.get('code'):
        raise Exception('Claude did not generate component code')

    print(f"[EDIT] Claude generated {len(parsed['code'])} chars of Remotion code")
    print(f"[EDIT] Description: {parsed.get('description', '')[:120]}")
    return parsed


def render_with_remotion(params: dict, duration: float, source_path: str = None,
                         width: int = 1080, height: int = 1920) -> str:
    """Send Claude-generated Remotion code to the render service."""
    payload = {
        'code': params['code'],
        'duration_seconds': duration,
        'fps': 30,
        'width': width,
        'height': height,
    }
    if source_path:
        payload['source_video_path'] = source_path

    print(f"[EDIT] Calling Remotion /render-custom: {len(params['code'])} chars, duration={duration}s")
    resp = http_requests.post(f"{REMOTION_URL}/render-custom", json=payload, timeout=180)

    if resp.status_code != 200:
        raise Exception(f"Remotion render failed: {resp.json().get('error', resp.text)}")

    result = resp.json()
    print(f"[EDIT] Remotion rendered in {result.get('duration_ms', '?')}ms -> {result['overlay_path']}")
    return result['overlay_path']


def get_video_dimensions(video_path: str) -> tuple:
    """Get width and height of a video file using ffmpeg."""
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return (1080, 1920)  # default
    import subprocess
    try:
        cmd = [
            ffmpeg, '-i', video_path,
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=10, encoding='utf-8', errors='replace')
        # Parse "720x1280" from stderr
        import re
        match = re.search(r'(\d{3,4})x(\d{3,4})', result.stderr)
        if match:
            w, h = int(match.group(1)), int(match.group(2))
            print(f"[EDIT] Source video dimensions: {w}x{h}")
            return (w, h)
    except Exception as e:
        print(f"[WARN] Could not detect video dimensions: {e}")
    return (1080, 1920)


def extract_video_segment(source_path: str, start_time: float, end_time: float) -> str:
    """Extract a segment of the source video for overlay compositing."""
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        raise Exception('ffmpeg not available')

    segment_name = f"seg_{secrets.token_hex(6)}_{int(time.time())}.mp4"
    segment_path = os.path.join(UPLOAD_FOLDER, segment_name)
    duration = end_time - start_time

    import subprocess
    cmd = [
        ffmpeg, '-y',
        '-ss', str(start_time),
        '-i', source_path,
        '-t', str(duration),
        '-c', 'copy',
        '-avoid_negative_ts', '1',
        segment_path,
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=30, encoding='utf-8', errors='replace')
    if result.returncode != 0:
        raise Exception(f"Segment extraction failed: {result.stderr[:200]}")

    return segment_path


# ──────────────────────────────────────────────────────────────
# SHARED HELPER: Resolve source video from request
# ──────────────────────────────────────────────────────────────

def _resolve_source_video(req):
    """Resolve source video from a Flask request.
    Accepts 'video' multipart file OR 'video_filename' form field.
    Returns (video_path, source_filename).
    Raises ValueError/FileNotFoundError on failure.
    """
    if 'video' in req.files:
        video = req.files['video']
        raw_name = secure_filename(video.filename or 'video.mp4')
        source_filename = f"src_{secrets.token_hex(6)}_{raw_name}"
        video_path = os.path.join(UPLOAD_FOLDER, source_filename)
        video.save(video_path)
        return video_path, source_filename
    elif req.form.get('video_filename'):
        source_filename = secure_filename(req.form['video_filename'])
        video_path = os.path.join(UPLOAD_FOLDER, source_filename)
        if not os.path.exists(video_path):
            raise FileNotFoundError('Referenced video not found on server')
        return video_path, source_filename
    else:
        raise ValueError('No video provided (upload file or pass video_filename)')


# ──────────────────────────────────────────────────────────────
# QUICK TOOLS — Full-video editing features
# ──────────────────────────────────────────────────────────────

# --- Color Grading Presets ---
COLOR_PRESETS = {
    'cinematic_warm': (
        'eq=contrast=1.1:brightness=0.02:saturation=0.9,'
        'colorbalance=rs=0.1:gs=0.05:bs=-0.05:rm=0.08:gm=0.02:bm=-0.03,'
        'unsharp=5:5:0.5'
    ),
    'cold_blue': (
        'eq=contrast=1.15:saturation=0.85,'
        'colorbalance=rs=-0.08:gs=-0.02:bs=0.12:rm=-0.05:gm=0.0:bm=0.08'
    ),
    'vintage': (
        'eq=contrast=0.95:brightness=0.03:saturation=0.7,'
        'colorbalance=rs=0.12:gs=0.05:bs=-0.08,'
        'noise=alls=8:allf=t+u,'
        'gblur=sigma=0.3'
    ),
    'high_contrast': (
        'eq=contrast=1.35:brightness=-0.02:saturation=1.1,'
        'unsharp=5:5:1.0'
    ),
    'vibrant': (
        'eq=contrast=1.1:saturation=1.5:brightness=0.02,'
        'colorbalance=rs=0.05:gs=0.05:bs=0.05,'
        'unsharp=5:5:0.8'
    ),
}


@app.route('/api/tools/colorgrade', methods=['POST'])
def tool_colorgrade():
    """Apply color grading preset to full video via ffmpeg."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    preset = request.form.get('preset', 'cinematic_warm')
    intensity = float(request.form.get('intensity', 1.0))
    intensity = max(0.0, min(1.0, intensity))

    if preset not in COLOR_PRESETS:
        return jsonify({'error': f'Unknown preset. Options: {list(COLOR_PRESETS.keys())}'}), 400

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg not available'}), 500

    task_id = f"colorgrade_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)
    filter_chain = COLOR_PRESETS[preset]

    try:
        if intensity < 1.0:
            filter_str = (
                f"[0:v]split[orig][copy];"
                f"[copy]{filter_chain}[graded];"
                f"[orig][graded]blend=all_mode=normal:all_opacity={intensity}"
            )
            cmd = [ffmpeg, '-y', '-i', video_path,
                   '-filter_complex', filter_str,
                   '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                   '-c:a', 'copy', '-movflags', '+faststart', output_path]
        else:
            cmd = [ffmpeg, '-y', '-i', video_path,
                   '-vf', filter_chain,
                   '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                   '-c:a', 'copy', '-movflags', '+faststart', output_path]

        print(f"[TOOL] Color grade: preset={preset}, intensity={intensity}")
        result = subprocess.run(cmd, capture_output=True, timeout=120, encoding='utf-8', errors='replace')
        if result.returncode != 0:
            raise Exception(f"ffmpeg failed: {result.stderr[:300]}")

        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        serve_url = f"{backend_url}/api/video/serve/{result_filename}"
        print(f"[OK] Color grade complete: {serve_url}")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': serve_url, 'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'colorgrade',
            'description': f"Applied '{preset}' color grade at {int(intensity*100)}% intensity",
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Color grading failed: {str(e)}'}), 500


@app.route('/api/tools/silence-removal', methods=['POST'])
def tool_silence_removal():
    """Remove silent segments from video via ffmpeg silencedetect."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    threshold = float(request.form.get('threshold', -30))
    min_silence = float(request.form.get('min_silence_duration', 0.5))
    padding = 0.05

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg not available'}), 500

    task_id = f"silence_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        # Step 1: Detect silences
        detect_cmd = [ffmpeg, '-i', video_path,
                      '-af', f'silencedetect=noise={threshold}dB:d={min_silence}',
                      '-f', 'null', '-']
        detect_result = subprocess.run(detect_cmd, capture_output=True, timeout=120, encoding='utf-8', errors='replace')

        import re as _re
        silence_ranges = []
        current_start = None
        for line in detect_result.stderr.split('\n'):
            start_match = _re.search(r'silence_start:\s*([\d.]+)', line)
            end_match = _re.search(r'silence_end:\s*([\d.]+)', line)
            if start_match:
                current_start = float(start_match.group(1))
            if end_match and current_start is not None:
                silence_ranges.append((current_start, float(end_match.group(1))))
                current_start = None

        video_duration = _get_video_duration(ffmpeg, video_path)
        print(f"[TOOL] Silence removal: found {len(silence_ranges)} silences in {video_duration:.1f}s video")

        if not silence_ranges:
            # No silences found — return original
            import shutil
            shutil.copy2(video_path, output_path)
            backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
            return jsonify({
                'task_id': task_id, 'state': 'SUCCEEDED',
                'video_url': f"{backend_url}/api/video/serve/{result_filename}",
                'video_filename': result_filename,
                'source_filename': source_filename, 'tool': 'silence_removal',
                'description': 'No silences detected — video unchanged',
                'original_duration': video_duration, 'new_duration': video_duration,
                'silences_removed': 0, 'time_saved': 0,
            })

        # Step 2: Compute keep ranges
        keep_ranges = []
        cursor = 0.0
        for sil_start, sil_end in silence_ranges:
            keep_end = sil_start + padding
            if keep_end > cursor + 0.1:
                keep_ranges.append((cursor, keep_end))
            cursor = max(cursor, sil_end - padding)
        if cursor < video_duration:
            keep_ranges.append((cursor, video_duration))

        if not keep_ranges:
            return jsonify({'error': 'Video is entirely silent'}), 400

        # Step 3: Build ffmpeg trim+concat filter
        filter_parts = []
        for i, (start, end) in enumerate(keep_ranges):
            filter_parts.append(
                f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{i}];"
                f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS[a{i}];"
            )
        n = len(keep_ranges)
        v_inputs = ''.join(f'[v{i}]' for i in range(n))
        a_inputs = ''.join(f'[a{i}]' for i in range(n))
        filter_parts.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv];")
        filter_parts.append(f"{a_inputs}concat=n={n}:v=0:a=1[outa]")
        filter_str = ''.join(filter_parts)

        cmd = [ffmpeg, '-y', '-i', video_path,
               '-filter_complex', filter_str,
               '-map', '[outv]', '-map', '[outa]',
               '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
               '-c:a', 'aac', '-b:a', '128k',
               '-movflags', '+faststart', output_path]
        result = subprocess.run(cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

        # Fallback: video-only if audio concat fails
        if result.returncode != 0:
            print(f"[WARN] Silence removal with audio failed, trying video-only")
            filter_parts_v = []
            for i, (start, end) in enumerate(keep_ranges):
                filter_parts_v.append(
                    f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{i}];"
                )
            v_inputs = ''.join(f'[v{i}]' for i in range(n))
            filter_parts_v.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv]")
            filter_str_v = ''.join(filter_parts_v)
            cmd_v = [ffmpeg, '-y', '-i', video_path,
                     '-filter_complex', filter_str_v, '-map', '[outv]',
                     '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                     '-movflags', '+faststart', output_path]
            result = subprocess.run(cmd_v, capture_output=True, timeout=300, encoding='utf-8', errors='replace')
            if result.returncode != 0:
                raise Exception(f"ffmpeg concat failed: {result.stderr[:300]}")

        new_duration = _get_video_duration(ffmpeg, output_path)
        time_saved = video_duration - new_duration
        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        print(f"[OK] Silence removal: {video_duration:.1f}s -> {new_duration:.1f}s (saved {time_saved:.1f}s)")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'silence_removal',
            'description': f"Removed {len(silence_ranges)} silences. {video_duration:.1f}s -> {new_duration:.1f}s (saved {time_saved:.1f}s)",
            'original_duration': round(video_duration, 1),
            'new_duration': round(new_duration, 1),
            'silences_removed': len(silence_ranges),
            'time_saved': round(time_saved, 1),
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Silence removal failed: {str(e)}'}), 500


def _build_atempo_chain(speed: float) -> str:
    """Build chained atempo filters for speeds outside 0.5-2.0 range."""
    if abs(speed - 1.0) < 0.01:
        return 'atempo=1.0'
    parts = []
    remaining = speed
    while remaining > 2.0:
        parts.append('atempo=2.0')
        remaining /= 2.0
    while remaining < 0.5:
        parts.append('atempo=0.5')
        remaining /= 0.5
    parts.append(f'atempo={remaining:.3f}')
    return ','.join(parts)


@app.route('/api/tools/speed-ramp', methods=['POST'])
def tool_speed_ramp():
    """Apply speed changes via natural language prompt + Gemini + ffmpeg."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    prompt = (request.form.get('prompt') or '').strip()
    if not prompt:
        return jsonify({'error': 'Speed description prompt is required'}), 400

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg not available'}), 500

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or not GENAI_AVAILABLE:
        return jsonify({'error': 'Gemini API not available'}), 500

    task_id = f"speedramp_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        video_duration = _get_video_duration(ffmpeg, video_path)
        if video_duration <= 0:
            return jsonify({'error': 'Could not determine video duration'}), 400

        # Step 1: Gemini interprets the speed prompt
        client = genai.Client(api_key=api_key)
        speed_prompt = f"""The user wants to change the speed of their {video_duration:.1f}s video.
Their request: "{prompt}"

Return ONLY valid JSON with speed segments that cover the ENTIRE video from 0 to {video_duration:.1f}:
{{
  "segments": [
    {{"start": 0.0, "end": 3.0, "speed": 1.0}},
    {{"start": 3.0, "end": 5.0, "speed": 0.5}},
    {{"start": 5.0, "end": {video_duration:.1f}, "speed": 2.0}}
  ],
  "description": "brief description of speed changes"
}}

Rules:
- Segments must cover 0 to {video_duration:.1f} with no gaps or overlaps
- speed: 0.25=quarter, 0.5=slow-mo, 1.0=normal, 2.0=double, 4.0=4x
- Valid range: 0.25 to 4.0
- Minimum segment: 0.5 seconds
- "slow-mo" = 0.5, "speed up" = 2.0 unless specified otherwise"""

        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=[speed_prompt],
            config=types.GenerateContentConfig(max_output_tokens=2000),
        )
        text = response.text.strip()
        if text.startswith('```'):
            text = '\n'.join(text.split('\n')[1:])
        if text.endswith('```'):
            text = '\n'.join(text.split('\n')[:-1])
        parsed = json.loads(text.strip())
        segments = parsed.get('segments', [])
        description = parsed.get('description', '')

        if not segments:
            return jsonify({'error': 'Could not parse speed instructions'}), 400

        # Validate & clamp
        for seg in segments:
            seg['speed'] = max(0.25, min(4.0, seg['speed']))
            seg['start'] = max(0.0, seg['start'])
            seg['end'] = min(video_duration, seg['end'])

        print(f"[TOOL] Speed ramp: {len(segments)} segments — {description}")

        # Step 2: Build ffmpeg filter chain
        filter_parts = []
        for i, seg in enumerate(segments):
            pts_factor = 1.0 / seg['speed']
            atempo = _build_atempo_chain(seg['speed'])
            filter_parts.append(
                f"[0:v]trim=start={seg['start']:.3f}:end={seg['end']:.3f},"
                f"setpts={pts_factor:.3f}*(PTS-STARTPTS)[v{i}];"
            )
            filter_parts.append(
                f"[0:a]atrim=start={seg['start']:.3f}:end={seg['end']:.3f},"
                f"asetpts=PTS-STARTPTS,{atempo}[a{i}];"
            )

        n = len(segments)
        v_inputs = ''.join(f'[v{i}]' for i in range(n))
        a_inputs = ''.join(f'[a{i}]' for i in range(n))
        filter_parts.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv];")
        filter_parts.append(f"{a_inputs}concat=n={n}:v=0:a=1[outa]")
        filter_str = ''.join(filter_parts)

        cmd = [ffmpeg, '-y', '-i', video_path,
               '-filter_complex', filter_str,
               '-map', '[outv]', '-map', '[outa]',
               '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
               '-c:a', 'aac', '-b:a', '128k',
               '-movflags', '+faststart', output_path]
        result = subprocess.run(cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

        if result.returncode != 0:
            # Fallback: video-only
            print(f"[WARN] Speed ramp with audio failed, trying video-only")
            filter_parts_v = []
            for i, seg in enumerate(segments):
                pts_factor = 1.0 / seg['speed']
                filter_parts_v.append(
                    f"[0:v]trim=start={seg['start']:.3f}:end={seg['end']:.3f},"
                    f"setpts={pts_factor:.3f}*(PTS-STARTPTS)[v{i}];"
                )
            v_inputs = ''.join(f'[v{i}]' for i in range(n))
            filter_parts_v.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv]")
            cmd_v = [ffmpeg, '-y', '-i', video_path,
                     '-filter_complex', ''.join(filter_parts_v),
                     '-map', '[outv]',
                     '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                     '-movflags', '+faststart', output_path]
            result = subprocess.run(cmd_v, capture_output=True, timeout=300, encoding='utf-8', errors='replace')
            if result.returncode != 0:
                raise Exception(f"ffmpeg speed ramp failed: {result.stderr[:300]}")

        new_duration = _get_video_duration(ffmpeg, output_path)
        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        print(f"[OK] Speed ramp: {video_duration:.1f}s -> {new_duration:.1f}s")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'speed_ramp',
            'description': description,
            'original_duration': round(video_duration, 1),
            'new_duration': round(new_duration, 1),
            'segments': segments,
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Speed ramp failed: {str(e)}'}), 500


TRANSCRIPTION_PROMPT = """Transcribe ALL speech in this video with precise word-level timestamps.
Return ONLY valid JSON. No markdown, no explanation.

{
  "words": [
    {"word": "Hello", "start": 0.12, "end": 0.45},
    {"word": "world", "start": 0.48, "end": 0.82}
  ]
}

Rules:
- Every spoken word MUST be included
- Timestamps in seconds (float, 2 decimal places)
- start = when word begins, end = when word finishes
- Include filler words (um, uh, like)
- If no speech, return {"words": []}"""


@app.route('/api/tools/captions', methods=['POST'])
def tool_captions():
    """Auto-generate animated captions using Gemini transcription + Remotion."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    style = request.form.get('style', 'bold_centered')
    color = request.form.get('color', '#FFFFFF')
    position = request.form.get('position', 'bottom')
    font_size = int(request.form.get('font_size', 64))

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or not GENAI_AVAILABLE:
        return jsonify({'error': 'Gemini API not available'}), 500

    ffmpeg = _find_ffmpeg()
    task_id = f"captions_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        # Step 1: Transcribe with Gemini
        print(f"[TOOL] Captions: uploading video to Gemini for transcription...")
        client = genai.Client(api_key=api_key)

        # Determine MIME type
        ext = os.path.splitext(video_path)[1].lower()
        mime_map = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'}
        mime_type = mime_map.get(ext, 'video/mp4')

        with open(video_path, 'rb') as f:
            video_file = client.files.upload(file=f, config={'mime_type': mime_type})

        # Wait for Gemini processing
        process_start = time.time()
        while video_file.state == "PROCESSING":
            if time.time() - process_start > 120:
                raise Exception('Gemini video processing timeout')
            time.sleep(2)
            video_file = client.files.get(name=video_file.name)

        if video_file.state == "FAILED":
            raise Exception('Gemini video processing failed')

        # Transcribe with retry — Gemini occasionally returns empty on first attempt
        words = []
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model='gemini-3-flash-preview',
                    contents=[
                        types.Part.from_uri(file_uri=video_file.uri, mime_type=video_file.mime_type),
                        TRANSCRIPTION_PROMPT,
                    ],
                    config=types.GenerateContentConfig(max_output_tokens=16000),
                )

                text = response.text.strip()
                if text.startswith('```'):
                    text = '\n'.join(text.split('\n')[1:])
                if text.endswith('```'):
                    text = '\n'.join(text.split('\n')[:-1])
                try:
                    transcript = json.loads(text.strip())
                    words = transcript.get('words', [])
                except json.JSONDecodeError:
                    print(f"[TOOL] Captions: attempt {attempt+1} returned invalid JSON, retrying...")
                    words = []

                if words:
                    break
                print(f"[TOOL] Captions: attempt {attempt+1} returned 0 words, {'retrying...' if attempt < 2 else 'giving up'}")
            except Exception as retry_err:
                err_str = str(retry_err)
                if ('503' in err_str or 'UNAVAILABLE' in err_str) and attempt < 2:
                    print(f"[WARN] Captions: Gemini 503, retrying in {(attempt+1)*3}s...")
                    time.sleep((attempt + 1) * 3)
                else:
                    print(f"[WARN] Captions: Gemini failed ({err_str[:100]}), returning empty transcription")
                    break

        print(f"[TOOL] Captions: transcribed {len(words)} words")

        if not words:
            return jsonify({
                'task_id': task_id, 'state': 'SUCCEEDED',
                'video_url': f"{os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')}/api/video/serve/{source_filename}",
                'video_filename': source_filename,
                'source_filename': source_filename, 'tool': 'captions',
                'description': 'No speech detected in video',
                'word_count': 0,
            })

        # Step 2: Get video info
        video_duration = _get_video_duration(ffmpeg, video_path) if ffmpeg else 0
        if video_duration <= 0:
            video_duration = words[-1]['end'] + 1.0
        src_width, src_height = get_video_dimensions(video_path)

        # Step 3: Serve source video for Remotion
        src_serve_filename = os.path.basename(video_path)
        src_serve_url = f"http://localhost:{os.getenv('PORT', 5000)}/api/video/serve/{src_serve_filename}"

        # Step 4: Render with Remotion CaptionOverlay
        payload = {
            'template': 'captions',
            'props': {
                'words': words,
                'style': style,
                'fontSize': font_size,
                'color': color,
                'position': position,
            },
            'duration_seconds': video_duration,
            'fps': 30,
            'width': src_width,
            'height': src_height,
            'source_video_path': src_serve_url,
        }

        print(f"[TOOL] Captions: rendering with Remotion ({len(words)} words, {video_duration:.1f}s, style={style})")
        resp = http_requests.post(f"{REMOTION_URL}/render", json=payload, timeout=600)
        if resp.status_code != 200:
            raise Exception(f"Remotion render failed: {resp.json().get('error', resp.text)}")

        rendered_path = resp.json()['overlay_path']

        # Move to uploads
        import shutil
        shutil.move(rendered_path, output_path)

        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        print(f"[OK] Captions complete: {len(words)} words, style={style}")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'captions',
            'description': f"Added {style} captions ({len(words)} words transcribed)",
            'word_count': len(words),
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Captions failed: {str(e)}'}), 500


@app.route('/api/tools/autozoom', methods=['POST'])
def tool_autozoom():
    """Smart auto-zoom cuts — detect emphasis moments and add dynamic zooms."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    intensity = request.form.get('intensity', 'medium')
    zoom_scales = {'subtle': 1.10, 'medium': 1.15, 'strong': 1.25}
    zoom_scale = zoom_scales.get(intensity, 1.15)

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or not GENAI_AVAILABLE:
        return jsonify({'error': 'Gemini API not available'}), 500

    ffmpeg = _find_ffmpeg()
    task_id = f"autozoom_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        video_duration = _get_video_duration(ffmpeg, video_path) if ffmpeg else 0
        if video_duration <= 0:
            return jsonify({'error': 'Could not determine video duration'}), 400

        # Step 1: Gemini analyzes for face + emphasis moments
        print(f"[TOOL] Auto-zoom: uploading video to Gemini for analysis...")
        client = genai.Client(api_key=api_key)

        ext = os.path.splitext(video_path)[1].lower()
        mime_map = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'}
        mime_type = mime_map.get(ext, 'video/mp4')

        with open(video_path, 'rb') as f:
            video_file = client.files.upload(file=f, config={'mime_type': mime_type})

        process_start = time.time()
        while video_file.state == "PROCESSING":
            if time.time() - process_start > 120:
                raise Exception('Gemini video processing timeout')
            time.sleep(2)
            video_file = client.files.get(name=video_file.name)

        autozoom_prompt = f"""Analyze this {video_duration:.1f}s talking-head video.
Find the speaker's face position and moments where they emphasize something (louder voice, gestures, key points).

Return ONLY valid JSON:
{{
  "face_position": {{"x": 50, "y": 35}},
  "emphasis_moments": [
    {{"time": 1.2, "intensity": 0.8}},
    {{"time": 3.5, "intensity": 0.6}}
  ]
}}

Rules:
- x/y are percentages (0-100) for average face center
- intensity 0.0-1.0 (how strong the emphasis)
- Include emphasis moments every 2-4 seconds for a dynamic feel
- Minimum 3 moments for videos over 5 seconds
- If no clear face, use {{"x": 50, "y": 40}}"""

        face_pos = {'x': 50, 'y': 40}
        moments = []
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model='gemini-3-flash-preview',
                    contents=[
                        types.Part.from_uri(file_uri=video_file.uri, mime_type=video_file.mime_type),
                        autozoom_prompt,
                    ],
                    config=types.GenerateContentConfig(max_output_tokens=4000),
                )

                text = response.text.strip()
                if text.startswith('```'):
                    text = '\n'.join(text.split('\n')[1:])
                if text.endswith('```'):
                    text = '\n'.join(text.split('\n')[:-1])
                analysis = json.loads(text.strip())

                face_pos = analysis.get('face_position', {'x': 50, 'y': 40})
                moments = analysis.get('emphasis_moments', [])
                break
            except json.JSONDecodeError:
                print(f"[WARN] Auto-zoom: Gemini JSON parse failed, using center focus fallback")
                break
            except Exception as retry_err:
                err_str = str(retry_err)
                if ('503' in err_str or 'UNAVAILABLE' in err_str) and attempt < 2:
                    print(f"[WARN] Auto-zoom: Gemini 503, retrying in {(attempt+1)*3}s...")
                    time.sleep((attempt + 1) * 3)
                else:
                    print(f"[WARN] Auto-zoom: Gemini failed ({err_str[:100]}), using center focus fallback")
                    break

        print(f"[TOOL] Auto-zoom: face at ({face_pos['x']}%, {face_pos['y']}%), {len(moments)} emphasis moments")

        if not moments:
            return jsonify({'error': 'No emphasis moments detected'}), 400

        # Filter moments: min 1.5s apart
        filtered = [moments[0]]
        for m in moments[1:]:
            if m['time'] - filtered[-1]['time'] >= 1.5:
                filtered.append(m)
        moments = filtered

        # Step 2: Render with Remotion AutoZoomEffect
        src_width, src_height = get_video_dimensions(video_path)
        src_serve_filename = os.path.basename(video_path)
        src_serve_url = f"http://localhost:{os.getenv('PORT', 5000)}/api/video/serve/{src_serve_filename}"

        payload = {
            'template': 'autozoom',
            'props': {
                'moments': moments,
                'facePosition': face_pos,
                'zoomScale': zoom_scale,
            },
            'duration_seconds': video_duration,
            'fps': 30,
            'width': src_width,
            'height': src_height,
            'source_video_path': src_serve_url,
        }

        print(f"[TOOL] Auto-zoom: rendering with Remotion ({len(moments)} zoom points)")
        resp = http_requests.post(f"{REMOTION_URL}/render", json=payload, timeout=600)
        if resp.status_code != 200:
            raise Exception(f"Remotion render failed: {resp.json().get('error', resp.text)}")

        rendered_path = resp.json()['overlay_path']
        import shutil
        shutil.move(rendered_path, output_path)

        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        print(f"[OK] Auto-zoom complete: {len(moments)} zoom cuts")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'autozoom',
            'description': f"Added {len(moments)} dynamic zoom cuts ({intensity})",
            'zoom_count': len(moments),
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Auto-zoom failed: {str(e)}'}), 500


# ──────────────────────────────────────────────────────────────
# TOOL 6: Voice Enhancement & Noise Reduction (pure ffmpeg)
# ──────────────────────────────────────────────────────────────

@app.route('/api/tools/voice-enhance', methods=['POST'])
def tool_voice_enhance():
    """Clean up audio: noise reduction, voice boost, compression — video stream untouched."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    preset = request.form.get('preset', 'clean')

    VOICE_PRESETS = {
        'clean': 'afftdn=nf=-25,highpass=f=80,lowpass=f=12000,dynaudnorm',
        'boost_voice': 'afftdn=nf=-20,equalizer=f=250:t=q:w=1:g=3,equalizer=f=2500:t=q:w=1:g=4,compand=attacks=0.3:decays=0.8:points=-80/-900|-45/-15|-27/-9|0/-7|20/-7:gain=5,dynaudnorm',
        'studio': 'afftdn=nf=-30,highpass=f=60,lowpass=f=14000,equalizer=f=200:t=q:w=2:g=2,equalizer=f=3000:t=q:w=1:g=3,compand=attacks=0.2:decays=0.5:points=-80/-900|-45/-15|-27/-9|0/-7|20/-7:gain=6,alimiter=limit=0.95,dynaudnorm',
        'denoise_heavy': 'afftdn=nf=-15,highpass=f=100,lowpass=f=10000,dynaudnorm',
    }
    af_chain = VOICE_PRESETS.get(preset, VOICE_PRESETS['clean'])

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg not available'}), 500

    task_id = f"voicefix_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        cmd = [ffmpeg, '-y', '-i', video_path,
               '-af', af_chain,
               '-c:v', 'copy',
               '-c:a', 'aac', '-b:a', '128k',
               '-movflags', '+faststart', output_path]
        result = subprocess.run(cmd, capture_output=True, timeout=120, encoding='utf-8', errors='replace')
        if result.returncode != 0:
            raise Exception(f"ffmpeg voice enhance failed: {result.stderr[:300]}")

        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        preset_labels = {'clean': 'Clean', 'boost_voice': 'Voice Boost', 'studio': 'Studio Polish', 'denoise_heavy': 'Heavy Denoise'}
        print(f"[OK] Voice enhance ({preset}) complete")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'voice_enhance',
            'description': f"Audio enhanced — {preset_labels.get(preset, preset)} preset applied",
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Voice enhancement failed: {str(e)}'}), 500


# ──────────────────────────────────────────────────────────────
# TOOL 7: Highlights / Scene Selection (Gemini + ffmpeg)
# ──────────────────────────────────────────────────────────────

@app.route('/api/tools/highlights', methods=['POST'])
def tool_highlights():
    """AI-powered highlight extraction — picks the best moments for a short clip."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    target_duration = int(request.form.get('target_duration', 30))

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or not GENAI_AVAILABLE:
        return jsonify({'error': 'Gemini API not available'}), 500

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg not available'}), 500

    task_id = f"highlights_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        video_duration = _get_video_duration(ffmpeg, video_path)
        if video_duration <= 0:
            return jsonify({'error': 'Could not determine video duration'}), 400

        if video_duration <= target_duration:
            import shutil
            shutil.copy2(video_path, output_path)
            backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
            return jsonify({
                'task_id': task_id, 'state': 'SUCCEEDED',
                'video_url': f"{backend_url}/api/video/serve/{result_filename}",
                'video_filename': result_filename,
                'source_filename': source_filename, 'tool': 'highlights',
                'description': f'Video already shorter than {target_duration}s — unchanged',
                'original_duration': round(video_duration, 1),
                'new_duration': round(video_duration, 1),
                'highlights_count': 0,
            })

        # Step 1: Gemini analysis
        print(f"[TOOL] Highlights: uploading {video_duration:.1f}s video to Gemini...")
        client = genai.Client(api_key=api_key)
        ext = os.path.splitext(video_path)[1].lower()
        mime_map = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'}
        mime_type = mime_map.get(ext, 'video/mp4')

        with open(video_path, 'rb') as f:
            video_file = client.files.upload(file=f, config={'mime_type': mime_type})

        process_start = time.time()
        while video_file.state == "PROCESSING":
            if time.time() - process_start > 120:
                raise Exception('Gemini video processing timeout')
            time.sleep(2)
            video_file = client.files.get(name=video_file.name)

        highlights_prompt = f"""Analyze this {video_duration:.1f}s video and identify the most engaging, interesting, or high-energy moments suitable for a short social media clip.

Return ONLY valid JSON:
{{
  "highlights": [
    {{"start": 2.1, "end": 5.8, "score": 0.95, "reason": "energetic moment with gesture"}},
    {{"start": 12.0, "end": 16.5, "score": 0.80, "reason": "key point being made"}},
    {{"start": 25.3, "end": 29.1, "score": 0.70, "reason": "funny reaction"}}
  ]
}}

Rules:
- score: 0.0-1.0 (how engaging/interesting the moment is)
- Each highlight should be 2-8 seconds long
- Include at least 5-10 candidate highlights for a {video_duration:.0f}s video
- Prefer moments with: strong emotions, key statements, visual action, humor, surprise
- Timestamps in seconds (float, 1 decimal place)
- Segments must not overlap
- Include the video opening if it has a strong hook"""

        highlights = []
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model='gemini-3-flash-preview',
                    contents=[
                        types.Part.from_uri(file_uri=video_file.uri, mime_type=video_file.mime_type),
                        highlights_prompt,
                    ],
                    config=types.GenerateContentConfig(max_output_tokens=4000),
                )

                text = response.text.strip()
                if text.startswith('```'):
                    text = '\n'.join(text.split('\n')[1:])
                if text.endswith('```'):
                    text = '\n'.join(text.split('\n')[:-1])
                analysis = json.loads(text.strip())
                highlights = analysis.get('highlights', [])
                break
            except json.JSONDecodeError:
                print(f"[WARN] Highlights: Gemini JSON parse failed, using fallback")
                break
            except Exception as retry_err:
                err_str = str(retry_err)
                if ('503' in err_str or 'UNAVAILABLE' in err_str) and attempt < 2:
                    print(f"[WARN] Highlights: Gemini 503, retrying in {(attempt+1)*3}s...")
                    time.sleep((attempt + 1) * 3)
                else:
                    print(f"[WARN] Highlights: Gemini failed ({err_str[:100]}), using fallback")
                    break

        if not highlights:
            # Fallback: no AI highlights available, return the whole video unchanged
            import shutil
            shutil.copy2(video_path, output_path)
            backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
            return jsonify({
                'task_id': task_id, 'state': 'SUCCEEDED',
                'video_url': f"{backend_url}/api/video/serve/{result_filename}",
                'video_filename': result_filename,
                'source_filename': source_filename, 'tool': 'highlights',
                'description': 'Could not detect highlights — returning original video',
                'original_duration': round(video_duration, 1),
                'new_duration': round(video_duration, 1),
                'highlights_count': 0,
            })

        # Step 2: Select highlights up to target_duration
        highlights.sort(key=lambda h: h.get('score', 0), reverse=True)
        selected = []
        total_selected = 0.0
        for h in highlights:
            seg_dur = h['end'] - h['start']
            if seg_dur < 0.5:
                continue
            # Check overlap with already selected
            overlap = False
            for s in selected:
                if h['start'] < s['end'] and h['end'] > s['start']:
                    overlap = True
                    break
            if overlap:
                continue
            if total_selected + seg_dur > target_duration * 1.1:
                continue
            selected.append(h)
            total_selected += seg_dur
            if total_selected >= target_duration:
                break

        if not selected:
            raise Exception('Could not select any highlight segments')

        # Sort chronologically
        selected.sort(key=lambda h: h['start'])
        print(f"[TOOL] Highlights: selected {len(selected)} segments ({total_selected:.1f}s)")

        # Step 3: Build ffmpeg concat filter
        filter_parts = []
        for i, h in enumerate(selected):
            filter_parts.append(
                f"[0:v]trim=start={h['start']:.3f}:end={h['end']:.3f},setpts=PTS-STARTPTS[v{i}];"
                f"[0:a]atrim=start={h['start']:.3f}:end={h['end']:.3f},asetpts=PTS-STARTPTS[a{i}];"
            )
        n = len(selected)
        v_inputs = ''.join(f'[v{i}]' for i in range(n))
        a_inputs = ''.join(f'[a{i}]' for i in range(n))
        filter_parts.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv];")
        filter_parts.append(f"{a_inputs}concat=n={n}:v=0:a=1[outa]")
        filter_str = ''.join(filter_parts)

        cmd = [ffmpeg, '-y', '-i', video_path,
               '-filter_complex', filter_str,
               '-map', '[outv]', '-map', '[outa]',
               '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
               '-c:a', 'aac', '-b:a', '128k',
               '-movflags', '+faststart', output_path]
        result = subprocess.run(cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

        # Fallback: video-only if audio concat fails
        if result.returncode != 0:
            print(f"[WARN] Highlights with audio failed, trying video-only")
            filter_parts_v = []
            for i, h in enumerate(selected):
                filter_parts_v.append(
                    f"[0:v]trim=start={h['start']:.3f}:end={h['end']:.3f},setpts=PTS-STARTPTS[v{i}];"
                )
            v_inputs = ''.join(f'[v{i}]' for i in range(n))
            filter_parts_v.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv]")
            filter_str_v = ''.join(filter_parts_v)
            cmd_v = [ffmpeg, '-y', '-i', video_path,
                     '-filter_complex', filter_str_v, '-map', '[outv]',
                     '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                     '-movflags', '+faststart', output_path]
            result = subprocess.run(cmd_v, capture_output=True, timeout=300, encoding='utf-8', errors='replace')
            if result.returncode != 0:
                raise Exception(f"ffmpeg highlights concat failed: {result.stderr[:300]}")

        new_duration = _get_video_duration(ffmpeg, output_path)
        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        print(f"[OK] Highlights: {video_duration:.1f}s -> {new_duration:.1f}s ({len(selected)} clips)")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'highlights',
            'description': f"Extracted {len(selected)} highlights. {video_duration:.1f}s -> {new_duration:.1f}s",
            'original_duration': round(video_duration, 1),
            'new_duration': round(new_duration, 1),
            'highlights_count': len(selected),
            'highlights': [{'start': h['start'], 'end': h['end'], 'reason': h.get('reason', '')} for h in selected],
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Highlights extraction failed: {str(e)}'}), 500


# ──────────────────────────────────────────────────────────────
# TOOL 8: Smart Cut v2 (Gemini + silence detect + ffmpeg)
# ──────────────────────────────────────────────────────────────

@app.route('/api/tools/smartcut', methods=['POST'])
def tool_smartcut():
    """AI-powered smart cut — removes silences AND low-energy/boring moments."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    aggressiveness = request.form.get('aggressiveness', 'medium')

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or not GENAI_AVAILABLE:
        return jsonify({'error': 'Gemini API not available'}), 500

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg not available'}), 500

    task_id = f"smartcut_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        video_duration = _get_video_duration(ffmpeg, video_path)
        if video_duration <= 0:
            return jsonify({'error': 'Could not determine video duration'}), 400

        # Step 1: Detect silences via ffmpeg
        silence_thresholds = {'light': -30, 'medium': -30, 'aggressive': -25}
        silence_min_dur = {'light': 1.0, 'medium': 0.5, 'aggressive': 0.3}
        threshold = silence_thresholds.get(aggressiveness, -30)
        min_dur = silence_min_dur.get(aggressiveness, 0.5)

        detect_cmd = [ffmpeg, '-i', video_path,
                      '-af', f'silencedetect=noise={threshold}dB:d={min_dur}',
                      '-f', 'null', '-']
        detect_result = subprocess.run(detect_cmd, capture_output=True, timeout=120, encoding='utf-8', errors='replace')

        silence_ranges = []
        current_start = None
        for line in detect_result.stderr.split('\n'):
            start_match = re.search(r'silence_start:\s*([\d.]+)', line)
            end_match = re.search(r'silence_end:\s*([\d.]+)', line)
            if start_match:
                current_start = float(start_match.group(1))
            if end_match and current_start is not None:
                silence_ranges.append((current_start, float(end_match.group(1))))
                current_start = None

        print(f"[TOOL] Smart Cut: {len(silence_ranges)} silences detected")

        # Step 2: Gemini analysis for low-energy moments
        print(f"[TOOL] Smart Cut: uploading {video_duration:.1f}s video to Gemini...")
        client = genai.Client(api_key=api_key)
        ext = os.path.splitext(video_path)[1].lower()
        mime_map = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'}
        mime_type = mime_map.get(ext, 'video/mp4')

        with open(video_path, 'rb') as f:
            video_file = client.files.upload(file=f, config={'mime_type': mime_type})

        process_start = time.time()
        while video_file.state == "PROCESSING":
            if time.time() - process_start > 120:
                raise Exception('Gemini video processing timeout')
            time.sleep(2)
            video_file = client.files.get(name=video_file.name)

        smartcut_prompt = f"""Analyze this {video_duration:.1f}s video and identify boring, low-energy, or redundant segments that should be cut for a tighter, more engaging edit.

Return ONLY valid JSON:
{{
  "cut_segments": [
    {{"start": 5.2, "end": 7.8, "reason": "dead air, no movement or speech"}},
    {{"start": 15.0, "end": 17.5, "reason": "repetitive content, already said this"}},
    {{"start": 28.1, "end": 30.0, "reason": "looking away, fumbling"}}
  ]
}}

Rules:
- Only mark segments that are clearly unengaging (don't cut good content)
- Each segment should be at least 0.5 seconds
- Reasons help the user understand what was cut
- Do NOT cut: transitions, establishing shots (unless very long), punchlines, key statements
- Timestamps in seconds (float, 1 decimal place)"""

        gemini_cuts = []
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model='gemini-3-flash-preview',
                    contents=[
                        types.Part.from_uri(file_uri=video_file.uri, mime_type=video_file.mime_type),
                        smartcut_prompt,
                    ],
                    config=types.GenerateContentConfig(max_output_tokens=4000),
                )

                text = response.text.strip()
                if text.startswith('```'):
                    text = '\n'.join(text.split('\n')[1:])
                if text.endswith('```'):
                    text = '\n'.join(text.split('\n')[:-1])

                analysis = json.loads(text.strip())
                gemini_cuts = analysis.get('cut_segments', [])
                break
            except json.JSONDecodeError:
                print(f"[WARN] Smart Cut: Gemini JSON parse failed, using silence-only")
                break
            except Exception as retry_err:
                err_str = str(retry_err)
                if ('503' in err_str or 'UNAVAILABLE' in err_str) and attempt < 2:
                    print(f"[WARN] Smart Cut: Gemini 503, retrying in {(attempt+1)*3}s...")
                    time.sleep((attempt + 1) * 3)
                else:
                    print(f"[WARN] Smart Cut: Gemini failed ({err_str[:100]}), using silence-only")
                    break

        print(f"[TOOL] Smart Cut: Gemini identified {len(gemini_cuts)} low-energy segments")

        # Step 3: Merge silence ranges + Gemini cut ranges
        all_remove = []
        for s, e in silence_ranges:
            all_remove.append((s, e))
        for seg in gemini_cuts:
            all_remove.append((seg['start'], seg['end']))

        # Sort and merge overlapping ranges
        all_remove.sort(key=lambda r: r[0])
        merged_remove = []
        for start, end in all_remove:
            if merged_remove and start <= merged_remove[-1][1] + 0.1:
                merged_remove[-1] = (merged_remove[-1][0], max(merged_remove[-1][1], end))
            else:
                merged_remove.append((start, end))

        if not merged_remove:
            import shutil
            shutil.copy2(video_path, output_path)
            backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
            return jsonify({
                'task_id': task_id, 'state': 'SUCCEEDED',
                'video_url': f"{backend_url}/api/video/serve/{result_filename}",
                'video_filename': result_filename,
                'source_filename': source_filename, 'tool': 'smartcut',
                'description': 'No segments to cut — video unchanged',
                'original_duration': round(video_duration, 1),
                'new_duration': round(video_duration, 1),
                'cuts_made': 0, 'time_saved': 0,
            })

        # Step 4: Compute keep ranges with padding
        padding = 0.05
        keep_ranges = []
        cursor = 0.0
        for rm_start, rm_end in merged_remove:
            keep_end = rm_start + padding
            if keep_end > cursor + 0.1:
                keep_ranges.append((cursor, keep_end))
            cursor = max(cursor, rm_end - padding)
        if cursor < video_duration:
            keep_ranges.append((cursor, video_duration))

        if not keep_ranges:
            return jsonify({'error': 'Smart cut would remove entire video'}), 400

        # Step 5: Build ffmpeg concat filter
        filter_parts = []
        for i, (start, end) in enumerate(keep_ranges):
            filter_parts.append(
                f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{i}];"
                f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS[a{i}];"
            )
        n = len(keep_ranges)
        v_inputs = ''.join(f'[v{i}]' for i in range(n))
        a_inputs = ''.join(f'[a{i}]' for i in range(n))
        filter_parts.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv];")
        filter_parts.append(f"{a_inputs}concat=n={n}:v=0:a=1[outa]")
        filter_str = ''.join(filter_parts)

        cmd = [ffmpeg, '-y', '-i', video_path,
               '-filter_complex', filter_str,
               '-map', '[outv]', '-map', '[outa]',
               '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
               '-c:a', 'aac', '-b:a', '128k',
               '-movflags', '+faststart', output_path]
        result = subprocess.run(cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

        # Fallback: video-only
        if result.returncode != 0:
            print(f"[WARN] Smart cut with audio failed, trying video-only")
            filter_parts_v = []
            for i, (start, end) in enumerate(keep_ranges):
                filter_parts_v.append(
                    f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{i}];"
                )
            v_inputs = ''.join(f'[v{i}]' for i in range(n))
            filter_parts_v.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv]")
            filter_str_v = ''.join(filter_parts_v)
            cmd_v = [ffmpeg, '-y', '-i', video_path,
                     '-filter_complex', filter_str_v, '-map', '[outv]',
                     '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                     '-movflags', '+faststart', output_path]
            result = subprocess.run(cmd_v, capture_output=True, timeout=300, encoding='utf-8', errors='replace')
            if result.returncode != 0:
                raise Exception(f"ffmpeg smart cut concat failed: {result.stderr[:300]}")

        new_duration = _get_video_duration(ffmpeg, output_path)
        time_saved = video_duration - new_duration
        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        total_cuts = len(merged_remove)
        print(f"[OK] Smart Cut: {video_duration:.1f}s -> {new_duration:.1f}s ({total_cuts} cuts, saved {time_saved:.1f}s)")

        # Build cuts detail for frontend
        cuts_detail = []
        for seg in gemini_cuts:
            cuts_detail.append({'start': seg['start'], 'end': seg['end'], 'reason': seg.get('reason', 'low-energy')})
        for s, e in silence_ranges:
            cuts_detail.append({'start': s, 'end': e, 'reason': 'silence'})

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'smartcut',
            'description': f"Smart cut ({aggressiveness}): {video_duration:.1f}s -> {new_duration:.1f}s. {total_cuts} cuts, saved {time_saved:.1f}s",
            'original_duration': round(video_duration, 1),
            'new_duration': round(new_duration, 1),
            'cuts_made': total_cuts,
            'time_saved': round(time_saved, 1),
            'cuts': cuts_detail,
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Smart cut failed: {str(e)}'}), 500


# ──────────────────────────────────────────────────────────────
# TOOL 9: Auto Reframe & Smart Resizing (Gemini + ffmpeg)
# ──────────────────────────────────────────────────────────────

@app.route('/api/tools/reframe', methods=['POST'])
def tool_reframe():
    """AI-powered aspect ratio conversion — keeps subject centered via Gemini scene analysis."""
    try:
        video_path, source_filename = _resolve_source_video(request)
    except (ValueError, FileNotFoundError) as e:
        return jsonify({'error': str(e)}), 400

    target_ratio = request.form.get('target_ratio', '9:16')

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or not GENAI_AVAILABLE:
        return jsonify({'error': 'Gemini API not available'}), 500

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return jsonify({'error': 'ffmpeg not available'}), 500

    task_id = f"reframe_{secrets.token_hex(8)}_{int(time.time())}"
    result_filename = f"{task_id}.mp4"
    output_path = os.path.join(UPLOAD_FOLDER, result_filename)

    try:
        video_duration = _get_video_duration(ffmpeg, video_path)
        if video_duration <= 0:
            return jsonify({'error': 'Could not determine video duration'}), 400

        src_w, src_h = get_video_dimensions(video_path)

        # Parse target ratio
        ratio_map = {'9:16': (9, 16), '1:1': (1, 1), '16:9': (16, 9), '4:5': (4, 5)}
        ratio = ratio_map.get(target_ratio, (9, 16))
        target_aspect = ratio[0] / ratio[1]
        source_aspect = src_w / src_h

        # Compute output dimensions (even numbers required by libx264)
        if target_aspect < source_aspect:
            # Target is taller — crop width
            out_h = src_h
            out_w = int(src_h * target_aspect)
        else:
            # Target is wider — crop height
            out_w = src_w
            out_h = int(src_w / target_aspect)
        out_w = out_w - (out_w % 2)
        out_h = out_h - (out_h % 2)

        # Step 1: Gemini scene analysis for subject tracking
        print(f"[TOOL] Reframe: uploading {video_duration:.1f}s video to Gemini ({src_w}x{src_h} -> {target_ratio})...")
        client = genai.Client(api_key=api_key)
        ext = os.path.splitext(video_path)[1].lower()
        mime_map = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'}
        mime_type = mime_map.get(ext, 'video/mp4')

        with open(video_path, 'rb') as f:
            video_file = client.files.upload(file=f, config={'mime_type': mime_type})

        process_start = time.time()
        while video_file.state == "PROCESSING":
            if time.time() - process_start > 120:
                raise Exception('Gemini video processing timeout')
            time.sleep(2)
            video_file = client.files.get(name=video_file.name)

        reframe_prompt = f"""Analyze this video and identify scenes/shots. For each scene, determine where the main subject/person is positioned.

Return ONLY valid JSON:
{{
  "scenes": [
    {{"start": 0.0, "end": 3.5, "focus_x": 50, "focus_y": 40}},
    {{"start": 3.5, "end": 8.2, "focus_x": 60, "focus_y": 35}}
  ]
}}

Rules:
- focus_x/focus_y are percentages (0-100) for the main subject center
- Group consecutive frames with similar subject position into one scene
- Minimum scene duration: 0.5 seconds
- If multiple people, track the speaking/most prominent one
- Cover the entire video duration ({video_duration:.1f}s)"""

        scenes = []
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model='gemini-3-flash-preview',
                    contents=[
                        types.Part.from_uri(file_uri=video_file.uri, mime_type=video_file.mime_type),
                        reframe_prompt,
                    ],
                    config=types.GenerateContentConfig(max_output_tokens=4000),
                )
                text = response.text.strip()
                if text.startswith('```'):
                    text = '\n'.join(text.split('\n')[1:])
                if text.endswith('```'):
                    text = '\n'.join(text.split('\n')[:-1])
                analysis = json.loads(text.strip())
                scenes = analysis.get('scenes', [])
                break
            except json.JSONDecodeError:
                print(f"[WARN] Reframe: Gemini JSON parse failed, using center crop fallback")
                break
            except Exception as retry_err:
                err_str = str(retry_err)
                if ('503' in err_str or 'UNAVAILABLE' in err_str) and attempt < 2:
                    print(f"[WARN] Reframe: Gemini 503, retrying in {(attempt+1)*3}s...")
                    time.sleep((attempt + 1) * 3)
                else:
                    print(f"[WARN] Reframe: Gemini failed ({err_str[:100]}), using center crop fallback")
                    break

        if not scenes:
            # Fallback: simple center crop
            scenes = [{'start': 0.0, 'end': video_duration, 'focus_x': 50, 'focus_y': 50}]

        print(f"[TOOL] Reframe: {len(scenes)} scenes detected")

        # Step 2: Build ffmpeg filter with per-scene crop
        if len(scenes) == 1:
            # Single scene — simple crop
            s = scenes[0]
            fx = s.get('focus_x', 50) / 100.0
            fy = s.get('focus_y', 50) / 100.0
            crop_x = max(0, min(int(fx * src_w - out_w / 2), src_w - out_w))
            crop_y = max(0, min(int(fy * src_h - out_h / 2), src_h - out_h))

            cmd = [ffmpeg, '-y', '-i', video_path,
                   '-vf', f'crop={out_w}:{out_h}:{crop_x}:{crop_y}',
                   '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                   '-c:a', 'aac', '-b:a', '128k',
                   '-movflags', '+faststart', output_path]
            result = subprocess.run(cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')
            if result.returncode != 0:
                raise Exception(f"ffmpeg reframe failed: {result.stderr[:300]}")
        else:
            # Multi-scene: trim + crop per scene, then concat
            filter_parts = []
            for i, s in enumerate(scenes):
                fx = s.get('focus_x', 50) / 100.0
                fy = s.get('focus_y', 50) / 100.0
                crop_x = max(0, min(int(fx * src_w - out_w / 2), src_w - out_w))
                crop_y = max(0, min(int(fy * src_h - out_h / 2), src_h - out_h))
                filter_parts.append(
                    f"[0:v]trim=start={s['start']:.3f}:end={s['end']:.3f},setpts=PTS-STARTPTS,"
                    f"crop={out_w}:{out_h}:{crop_x}:{crop_y}[v{i}];"
                    f"[0:a]atrim=start={s['start']:.3f}:end={s['end']:.3f},asetpts=PTS-STARTPTS[a{i}];"
                )
            n = len(scenes)
            v_inputs = ''.join(f'[v{i}]' for i in range(n))
            a_inputs = ''.join(f'[a{i}]' for i in range(n))
            filter_parts.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv];")
            filter_parts.append(f"{a_inputs}concat=n={n}:v=0:a=1[outa]")
            filter_str = ''.join(filter_parts)

            cmd = [ffmpeg, '-y', '-i', video_path,
                   '-filter_complex', filter_str,
                   '-map', '[outv]', '-map', '[outa]',
                   '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                   '-c:a', 'aac', '-b:a', '128k',
                   '-movflags', '+faststart', output_path]
            result = subprocess.run(cmd, capture_output=True, timeout=300, encoding='utf-8', errors='replace')

            # Fallback: video-only
            if result.returncode != 0:
                print(f"[WARN] Reframe with audio failed, trying video-only")
                filter_parts_v = []
                for i, s in enumerate(scenes):
                    fx = s.get('focus_x', 50) / 100.0
                    fy = s.get('focus_y', 50) / 100.0
                    crop_x = max(0, min(int(fx * src_w - out_w / 2), src_w - out_w))
                    crop_y = max(0, min(int(fy * src_h - out_h / 2), src_h - out_h))
                    filter_parts_v.append(
                        f"[0:v]trim=start={s['start']:.3f}:end={s['end']:.3f},setpts=PTS-STARTPTS,"
                        f"crop={out_w}:{out_h}:{crop_x}:{crop_y}[v{i}];"
                    )
                v_inputs = ''.join(f'[v{i}]' for i in range(n))
                filter_parts_v.append(f"{v_inputs}concat=n={n}:v=1:a=0[outv]")
                filter_str_v = ''.join(filter_parts_v)
                cmd_v = [ffmpeg, '-y', '-i', video_path,
                         '-filter_complex', filter_str_v, '-map', '[outv]',
                         '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '23',
                         '-movflags', '+faststart', output_path]
                result = subprocess.run(cmd_v, capture_output=True, timeout=300, encoding='utf-8', errors='replace')
                if result.returncode != 0:
                    raise Exception(f"ffmpeg reframe concat failed: {result.stderr[:300]}")

        backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
        print(f"[OK] Reframe: {src_w}x{src_h} -> {out_w}x{out_h} ({target_ratio}), {len(scenes)} scenes")

        return jsonify({
            'task_id': task_id, 'state': 'SUCCEEDED',
            'video_url': f"{backend_url}/api/video/serve/{result_filename}",
            'video_filename': result_filename,
            'source_filename': source_filename, 'tool': 'reframe',
            'description': f"Reframed to {target_ratio} ({out_w}x{out_h}) with AI subject tracking",
            'target_ratio': target_ratio,
            'original_dimensions': f"{src_w}x{src_h}",
            'output_dimensions': f"{out_w}x{out_h}",
        })
    except Exception as e:
        traceback.print_exc()
        if os.path.exists(output_path):
            try: os.remove(output_path)
            except: pass
        return jsonify({'error': f'Reframe failed: {str(e)}'}), 500


@app.route('/api/veo/edit', methods=['POST'])
def veo_edit():
    """AI video edit via Claude + Remotion.

    Routes all edits through Claude (interpret) → Remotion (render) → ffmpeg (composite).
    Returns synchronously — no polling needed.

    Accepts EITHER:
      - 'video' multipart file (first iteration — uploads from device)
      - 'video_filename' form field (subsequent iterations / Try Again — references server file)
    """
    try:
        timestamp = float(request.form.get('timestamp', 0))
        prompt = (request.form.get('prompt') or '').strip()
        duration_seconds = int(request.form.get('duration_seconds', 5))

        if not prompt:
            return jsonify({'error': 'Edit prompt is required'}), 400

        # Resolve source video — either uploaded file or server-side reference
        source_filename = None

        if 'video' in request.files:
            video = request.files['video']
            raw_name = secure_filename(video.filename or 'video.mp4')
            source_filename = f"src_{secrets.token_hex(6)}_{raw_name}"
            video_path = os.path.join(UPLOAD_FOLDER, source_filename)
            video.save(video_path)
        elif request.form.get('video_filename'):
            source_filename = secure_filename(request.form['video_filename'])
            video_path = os.path.join(UPLOAD_FOLDER, source_filename)
            if not os.path.exists(video_path):
                return jsonify({'error': 'Referenced video not found on server'}), 404
        else:
            return jsonify({'error': 'No video provided (upload file or pass video_filename)'}), 400

        # Snap duration to reasonable range
        duration_seconds = max(2, min(duration_seconds, 15))

        # Step 1: Claude interprets the edit request
        print(f"[EDIT] User prompt: '{prompt}' | duration={duration_seconds}s")
        edit_params = interpret_edit_with_claude(
            prompt, duration_seconds,
            video_path=video_path, timestamp=timestamp,
        )

        task_id = f"edit_{secrets.token_hex(8)}_{int(time.time())}"
        start_time = time.time()

        # Detect source video dimensions so Remotion output matches
        src_width, src_height = get_video_dimensions(video_path)

        # Extract source segment for compositing
        end_time_ts = timestamp + duration_seconds
        segment_path = None

        try:
            # Extract source segment, pass HTTP URL to Remotion (it can't read file:// paths)
            segment_path = extract_video_segment(video_path, timestamp, end_time_ts)
            segment_filename = os.path.basename(segment_path)
            segment_url = f"http://localhost:{os.getenv('PORT', 5000)}/api/video/serve/{segment_filename}"
            result_path = render_with_remotion(
                edit_params, duration_seconds, source_path=segment_url,
                width=src_width, height=src_height,
            )

            # Move result to uploads with predictable name
            result_filename = f"edit_{task_id}.mp4"
            final_path = os.path.join(UPLOAD_FOLDER, result_filename)
            if result_path != final_path:
                import shutil
                shutil.move(result_path, final_path)

            # Clean up temp segment
            if segment_path and os.path.exists(segment_path):
                try:
                    os.remove(segment_path)
                except Exception:
                    pass

            backend_url = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000')
            serve_url = f"{backend_url}/api/video/serve/{result_filename}"
            elapsed = time.time() - start_time

            print(f"[OK] Edit complete in {elapsed:.1f}s: {serve_url}")

            # Also store in veo_tasks for status endpoint compatibility
            veo_tasks[task_id] = {
                'state': 'SUCCEEDED',
                'prompt': prompt,
                'created_at': start_time,
                'video_url': serve_url,
                'video_filename': result_filename,
                'source_filename': source_filename,
                'error_message': None,
                'edit_type': 'remotion',
                'description': edit_params.get('description', ''),
            }

            return jsonify({
                'task_id': task_id,
                'state': 'SUCCEEDED',
                'video_url': serve_url,
                'video_filename': result_filename,
                'source_filename': source_filename,
                'edit_type': 'remotion',
                'description': edit_params.get('description', ''),
            })

        except Exception as edit_err:
            print(f"[ERR] Edit pipeline failed: {edit_err}")
            traceback.print_exc()
            # Clean up temp files
            if segment_path and os.path.exists(segment_path):
                try:
                    os.remove(segment_path)
                except Exception:
                    pass
            return jsonify({
                'error': f'Edit failed: {str(edit_err)}',
                'task_id': task_id,
                'state': 'FAILED',
            }), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"\n[*] Crescio AI - Content Coach API v1.0.0")
    print(f"[>] Upload folder   : {UPLOAD_FOLDER}")
    print(f"[>] Google API Key  : {bool(os.getenv('GOOGLE_API_KEY'))}")
    print(f"[>] Anthropic Key   : {bool(os.getenv('ANTHROPIC_API_KEY'))}")
    print(f"[>] Gemini ready    : {GENAI_AVAILABLE}")
    print(f"[>] Claude ready    : {ANTHROPIC_AVAILABLE}")
    print(f"[>] ffmpeg ready    : {FFMPEG_AVAILABLE}")
    print(f"[>] Remotion URL    : {REMOTION_URL}")
    print(f"[>] Port            : {port}\n")
    app.run(host='0.0.0.0', port=port, debug=True)