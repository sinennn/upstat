from datetime import datetime, timedelta

from models.monitor import MonitorCheck


def get_recent_checks(monitor_id: str) -> list[MonitorCheck]:
    now = datetime.utcnow()

    return [
        MonitorCheck(monitor_id, True, 420, 200, now - timedelta(minutes=9)),
        MonitorCheck(monitor_id, True, 510, 200, now - timedelta(minutes=8)),
        MonitorCheck(monitor_id, True, 640, 200, now - timedelta(minutes=7)),
        MonitorCheck(monitor_id, False, 1200, 503, now - timedelta(minutes=6)),
        MonitorCheck(monitor_id, True, 780, 200, now - timedelta(minutes=5)),
        MonitorCheck(monitor_id, False, 1400, 504, now - timedelta(minutes=4)),
        MonitorCheck(monitor_id, True, 690, 200, now - timedelta(minutes=3)),
        MonitorCheck(monitor_id, True, 720, 200, now - timedelta(minutes=2)),
        MonitorCheck(monitor_id, False, 1550, 500, now - timedelta(minutes=1)),
        MonitorCheck(monitor_id, True, 830, 200, now),
    ]

