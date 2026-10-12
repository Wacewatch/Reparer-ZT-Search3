"""Small durable local store for source settings and proxy health."""

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.environ.get("ZT_DATA_DIR", Path(__file__).parent / ".data"))
DB_PATH = DATA_DIR / "state.sqlite3"


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=5)
    connection.execute("PRAGMA busy_timeout = 5000")
    connection.execute(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )
    connection.execute(
        "CREATE TABLE IF NOT EXISTS proxies (url TEXT PRIMARY KEY, last_ok REAL NOT NULL)"
    )
    return connection


def get_setting(key: str, default: Any = None) -> Any:
    with _connect() as connection:
        row = connection.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
    return json.loads(row[0]) if row else default


def save_setting(key: str, value: Any) -> None:
    encoded = json.dumps(value, ensure_ascii=False)
    with _connect() as connection:
        connection.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, encoded),
        )


def get_proxies(fresh_after: float | None = None) -> list[str]:
    with _connect() as connection:
        if fresh_after is None:
            rows = connection.execute(
                "SELECT url FROM proxies ORDER BY last_ok DESC LIMIT 500"
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT url FROM proxies WHERE last_ok > ? "
                "ORDER BY last_ok DESC LIMIT 500",
                (fresh_after,),
            ).fetchall()
    return [row[0] for row in rows]


def save_proxies(urls: list[str], last_ok: float) -> None:
    with _connect() as connection:
        connection.executemany(
            "INSERT INTO proxies (url, last_ok) VALUES (?, ?) "
            "ON CONFLICT(url) DO UPDATE SET last_ok = excluded.last_ok",
            [(url, last_ok) for url in urls],
        )
