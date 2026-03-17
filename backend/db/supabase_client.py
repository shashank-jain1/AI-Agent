"""
Supabase admin client — uses SERVICE_ROLE_KEY to bypass Row Level Security.
Never expose this client or key to any frontend/client code.
"""
import os
from functools import lru_cache
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
        )
    return create_client(url, key)


# Singleton instance for convenience
supabase: Client = None  # initialized lazily via get_supabase_client()


def get_db() -> Client:
    """Returns the shared Supabase admin client."""
    global supabase
    if supabase is None:
        supabase = get_supabase_client()
    return supabase
