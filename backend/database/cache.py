import sqlite3, json, time
from config import DB_PATH, TTL_HOURS

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scan_cache (
                text_hash   TEXT PRIMARY KEY,
                result_json TEXT NOT NULL,
                created_at  REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS provenance_log (
                text_hash   TEXT PRIMARY KEY,
                platforms   TEXT NOT NULL,
                created_at  REAL NOT NULL
            )
        """)
        conn.commit()

def cache_get(h: str) -> dict | None:
    """Return cached result if it exists and is within TTL, else None."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT result_json, created_at FROM scan_cache WHERE text_hash = ?", (h,)
        ).fetchone()
    if not row:
        return None
    age_hours = (time.time() - row["created_at"]) / 3600
    if age_hours > TTL_HOURS:
        return None
    return json.loads(row["result_json"])

def cache_set(h: str, data: dict):
    """Insert or replace a cache entry."""
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO scan_cache (text_hash, result_json, created_at) VALUES (?,?,?)",
            (h, json.dumps(data), time.time())
        )
        conn.commit()