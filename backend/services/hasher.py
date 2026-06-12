import hashlib

def make_hash(text: str) -> str:
    """SHA-256 hash of normalised text — used as cache key."""
    return hashlib.sha256(text.strip().lower().encode()).hexdigest()