def describe_trend(features: dict) -> str | None:
    if features["latest_response_time"] > features["average_response_time"]:
        return "latency trend is moving upward"

    return None

