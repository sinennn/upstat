from models.monitor import MonitorCheck


def build_features(checks: list[MonitorCheck]) -> dict:
    total_checks = len(checks)
    failed_checks = sum(1 for check in checks if not check.success)
    response_times = [check.response_time_ms for check in checks]
    average_response_time = int(sum(response_times) / total_checks) if total_checks else 0
    latest_response_time = response_times[-1] if response_times else 0
    consecutive_failures = 0

    for check in reversed(checks):
        if check.success:
            break
        consecutive_failures += 1

    return {
        "total_checks": total_checks,
        "failed_checks": failed_checks,
        "failure_rate": failed_checks / total_checks if total_checks else 0,
        "average_response_time": average_response_time,
        "latest_response_time": latest_response_time,
        "consecutive_failures": consecutive_failures,
    }

