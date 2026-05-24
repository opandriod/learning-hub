import os
import time
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH, override=True)

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_MINCONN = int(os.getenv("DB_MINCONN", "1"))
DB_MAXCONN = int(os.getenv("DB_MAXCONN", "8"))
DB_CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))

_db_pool = None


class PooledConnection:
    """Small wrapper so existing code can keep calling conn.close().

    In this project many routes call get_db_connection() and then conn.close().
    With pooling, close() should return the connection to the pool instead of
    closing the TCP/SSL connection. This removes repeated Supabase SSL handshakes
    and makes local/deployed requests feel much faster.
    """

    def __init__(self, raw_conn):
        self._raw_conn = raw_conn
        self._closed_to_pool = False

    def __getattr__(self, name):
        return getattr(self._raw_conn, name)

    def close(self):
        global _db_pool
        if self._closed_to_pool:
            return
        self._closed_to_pool = True
        try:
            # Make sure unfinished failed transactions do not poison the next user.
            if not self._raw_conn.closed:
                try:
                    self._raw_conn.rollback()
                except Exception:
                    pass
            if _db_pool is not None:
                _db_pool.putconn(self._raw_conn)
            else:
                self._raw_conn.close()
        except Exception:
            try:
                self._raw_conn.close()
            except Exception:
                pass


def _create_pool():
    return pool.ThreadedConnectionPool(
        minconn=DB_MINCONN,
        maxconn=DB_MAXCONN,
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT,
        sslmode="require",
        connect_timeout=DB_CONNECT_TIMEOUT,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        application_name="learning_hub_backend",
    )


def get_db_connection():
    global _db_pool
    if _db_pool is None:
        _db_pool = _create_pool()

    # Retry once if the pool gives a stale/broken connection.
    last_error = None
    for _ in range(2):
        raw = None
        try:
            raw = _db_pool.getconn()
            with raw.cursor() as cur:
                cur.execute("SELECT 1")
            return PooledConnection(raw)
        except Exception as exc:
            last_error = exc
            if raw is not None:
                try:
                    _db_pool.putconn(raw, close=True)
                except Exception:
                    pass
            time.sleep(0.15)

    # Recreate the pool if both attempts failed.
    try:
        _db_pool.closeall()
    except Exception:
        pass
    _db_pool = _create_pool()
    raw = _db_pool.getconn()
    return PooledConnection(raw)
