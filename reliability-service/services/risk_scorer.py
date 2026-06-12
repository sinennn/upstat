
def calculate_risk_score(
    failed_checks: int,
    total_checks: int,
    average_response_time: int,
) -> int:
    if total_checks == 0:
        return 0

    failure_rate = failed_checks / total_checks

    score = failure_rate * 70

    if average_response_time > 1000:
        score = score + 30

    elif average_response_time > 500:
        score = score + 15

    if score > 100:
        score = 100

    return int(score)
