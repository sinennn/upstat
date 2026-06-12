def describe_failures(features: dict) -> str | None:
    if features["consecutive_failures"] >= 2:
        return "multiple consecutive checks failed"

    if features["failure_rate"] >= 0.2:
        return "failure rate is elevated"

    return None

