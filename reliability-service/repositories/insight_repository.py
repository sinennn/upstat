from models.insight import Insight

_insights: list[Insight] = []


def save_insight(insight: Insight) -> Insight:
    _insights.append(insight)
    return insight


def list_insights() -> list[Insight]:
    return _insights

