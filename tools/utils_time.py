from datetime import datetime
from zoneinfo import ZoneInfo


TZ = ZoneInfo("Europe/Vienna")


def now_local_iso() -> str:
    """
    ISO timestamp in local Vienna time with timezone offset.
    Example: 2026-03-12T10:27:14+01:00
    """
    return datetime.now(TZ).isoformat(timespec="seconds")


def now_local_human() -> str:
    """
    Human readable timestamp for logs or UI.
    Example: 12.03.2026 10:27
    """
    d = datetime.now(TZ)
    return d.strftime("%d.%m.%Y %H:%M")
