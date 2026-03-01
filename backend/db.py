"""
Database layer for TikTok Viral Coach
PostgreSQL with connection pooling. Falls back to in-memory dicts if DATABASE_URL not set.
"""

import os
import time
import hashlib
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta

DATABASE_URL = os.getenv('DATABASE_URL')

# ── In-memory fallback (dev only) ──────────────────────────
_memory_store = {
    'otp': {},       # contact -> {otp, mode, expires_at}
    'users': {},     # user_id -> {contact, contact_type, created_at, last_login}
    'sessions': {},  # token -> {user_id, contact, created_at, expires_at}
}

# ── PostgreSQL pool ────────────────────────────────────────
_pool = None

def _use_db():
    return _pool is not None


def init_db():
    """Initialize PostgreSQL connection pool and create tables."""
    global _pool
    if not DATABASE_URL:
        print("[DB] No DATABASE_URL — using in-memory storage (dev only)")
        return False

    try:
        import psycopg2
        from psycopg2 import pool as pg_pool
        _pool = pg_pool.ThreadedConnectionPool(2, 10, DATABASE_URL)

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        contact TEXT UNIQUE NOT NULL,
                        contact_type TEXT NOT NULL DEFAULT 'email',
                        created_at TIMESTAMP DEFAULT NOW(),
                        last_login TIMESTAMP DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS sessions (
                        token TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id),
                        created_at TIMESTAMP DEFAULT NOW(),
                        expires_at TIMESTAMP NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_sessions_user
                        ON sessions(user_id);
                    CREATE INDEX IF NOT EXISTS idx_sessions_expires
                        ON sessions(expires_at);

                    CREATE TABLE IF NOT EXISTS otp_codes (
                        contact TEXT PRIMARY KEY,
                        otp TEXT NOT NULL,
                        mode TEXT NOT NULL DEFAULT 'email',
                        expires_at TIMESTAMP NOT NULL
                    );
                """)
            conn.commit()
        print("[DB] PostgreSQL connected — tables ready")
        return True
    except Exception as e:
        print(f"[DB-ERR] PostgreSQL init failed: {e}")
        print("[DB] Falling back to in-memory storage")
        _pool = None
        return False


@contextmanager
def get_conn():
    """Get a connection from the pool, auto-return on exit."""
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


# ── OTP Operations ─────────────────────────────────────────

def store_otp(contact, otp, mode, expiry_seconds):
    """Store OTP for a contact. Upserts if exists."""
    if _use_db():
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO otp_codes (contact, otp, mode, expires_at)
                    VALUES (%s, %s, %s, NOW() + INTERVAL '%s seconds')
                    ON CONFLICT (contact)
                    DO UPDATE SET otp = %s, mode = %s,
                                 expires_at = NOW() + INTERVAL '%s seconds'
                """, (contact, otp, mode, expiry_seconds,
                      otp, mode, expiry_seconds))
            conn.commit()
    else:
        _memory_store['otp'][contact] = {
            'otp': otp,
            'mode': mode,
            'expires_at': time.time() + expiry_seconds,
        }


def verify_otp_code(contact, otp):
    """Check OTP. Returns (success, error_message)."""
    if _use_db():
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT otp, expires_at FROM otp_codes WHERE contact = %s",
                    (contact,)
                )
                row = cur.fetchone()
                if not row:
                    return False, 'No OTP found. Please request a new code.'
                stored_otp, expires_at = row
                if datetime.utcnow() > expires_at:
                    cur.execute("DELETE FROM otp_codes WHERE contact = %s", (contact,))
                    conn.commit()
                    return False, 'Code expired. Please request a new one.'
                if stored_otp != otp:
                    return False, 'Incorrect code. Please try again.'
                # Valid — delete used OTP
                cur.execute("DELETE FROM otp_codes WHERE contact = %s", (contact,))
                conn.commit()
                return True, None
    else:
        record = _memory_store['otp'].get(contact)
        if not record:
            return False, 'No OTP found. Please request a new code.'
        if time.time() > record['expires_at']:
            del _memory_store['otp'][contact]
            return False, 'Code expired. Please request a new one.'
        if record['otp'] != otp:
            return False, 'Incorrect code. Please try again.'
        del _memory_store['otp'][contact]
        return True, None


# ── User Operations ────────────────────────────────────────

def upsert_user(user_id, contact, mode):
    """Create user on first login, update last_login on subsequent logins."""
    if _use_db():
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO users (id, contact, contact_type, last_login)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET last_login = NOW()
                """, (user_id, contact, mode))
            conn.commit()
    else:
        _memory_store['users'][user_id] = {
            'contact': contact,
            'contact_type': mode,
            'created_at': _memory_store['users'].get(user_id, {}).get('created_at', time.time()),
            'last_login': time.time(),
        }


# ── Session Operations ─────────────────────────────────────

def create_session(token, user_id, expiry_hours):
    """Store a new session."""
    if _use_db():
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO sessions (token, user_id, created_at, expires_at)
                    VALUES (%s, %s, NOW(), NOW() + INTERVAL '%s hours')
                """, (token, user_id, expiry_hours))
            conn.commit()
    else:
        _memory_store['sessions'][token] = {
            'user_id': user_id,
            'created_at': time.time(),
            'expires_at': time.time() + (expiry_hours * 3600),
        }


def get_session(token):
    """Get session if valid and not expired. Returns dict or None."""
    if _use_db():
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT s.user_id, u.contact, s.created_at
                    FROM sessions s JOIN users u ON s.user_id = u.id
                    WHERE s.token = %s AND s.expires_at > NOW()
                """, (token,))
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    'user_id': row[0],
                    'contact': row[1],
                    'created_at': row[2].timestamp() if hasattr(row[2], 'timestamp') else row[2],
                }
    else:
        session = _memory_store['sessions'].get(token)
        if not session:
            return None
        if time.time() > session['expires_at']:
            del _memory_store['sessions'][token]
            return None
        # Look up contact from users
        user = _memory_store['users'].get(session['user_id'], {})
        return {
            'user_id': session['user_id'],
            'contact': user.get('contact', ''),
            'created_at': session['created_at'],
        }


# ── Health Check ───────────────────────────────────────────

def check_db_health():
    """Returns True if database is connected and responding."""
    if not _use_db():
        return False
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False


# ── Cleanup ────────────────────────────────────────────────

def start_cleanup_thread():
    """Background thread to clean expired OTPs and sessions every hour."""
    def _cleanup():
        while True:
            time.sleep(3600)
            try:
                if _use_db():
                    with get_conn() as conn:
                        with conn.cursor() as cur:
                            cur.execute("DELETE FROM otp_codes WHERE expires_at < NOW()")
                            cur.execute("DELETE FROM sessions WHERE expires_at < NOW()")
                        conn.commit()
                    print("[CLEANUP] Expired OTPs and sessions removed")
                else:
                    now = time.time()
                    expired_otps = [k for k, v in _memory_store['otp'].items() if now > v['expires_at']]
                    for k in expired_otps:
                        del _memory_store['otp'][k]
                    expired_sessions = [k for k, v in _memory_store['sessions'].items() if now > v['expires_at']]
                    for k in expired_sessions:
                        del _memory_store['sessions'][k]
                    if expired_otps or expired_sessions:
                        print(f"[CLEANUP] Removed {len(expired_otps)} OTPs, {len(expired_sessions)} sessions")
            except Exception as e:
                print(f"[CLEANUP-ERR] {e}")

    t = threading.Thread(target=_cleanup, daemon=True)
    t.start()
