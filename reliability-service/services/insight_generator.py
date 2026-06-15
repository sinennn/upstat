from analysis.failure_analysis import describe_failures
from analysis.latency_analysis import describe_latency
from analysis.trend_analysis import describe_trend
from ml.feature_builder import build_features
from models.insight import Insight
from repositories.insight_repository import save_insight
from repositories.insight_sender import report_insight
from repositories.monitor_repository import get_recent_checks
from services.groq_renderer import render_insight_narrative
from services.risk_scorer import calculate_risk_score
from services.severity_classifier import risk_classifier
from services.ml_anomaly_detector import MLAnomalyDetector


def generate_insight(monitor_id: str) -> Insight:
    checks = get_recent_checks(monitor_id)
    features = build_features(checks)
    risk_score = calculate_risk_score(
        failed_checks=features["failed_checks"],
        total_checks=features["total_checks"],
        average_response_time=features["average_response_time"],
    )
    severity = risk_classifier(risk_score)
    
    
    ml_detector = MLAnomalyDetector(monitor_id)
    ml_result = ml_detector.predict_anomaly(checks)
    anomaly_detected = ml_result["is_anomaly"]
    signals = [
        signal
        for signal in (
            describe_failures(features),
            describe_latency(features),
            describe_trend(features),
        )
        if signal
    ]

    human_readable = None
    try:
        preliminary_insight = Insight(
            monitor_id=monitor_id,
            risk_score=risk_score,
            anomaly_detected=anomaly_detected,
            severity=severity,
            summary=", ".join(signals) if signals else "no reliability issues detected",
            recommended_action=_recommended_action(severity, anomaly_detected),
        )
        human_readable = render_insight_narrative(preliminary_insight)
    except Exception:
        # If narrative generation fails, continue with the standard insight payload.
        human_readable = None

    insight = Insight(
        monitor_id=monitor_id,
        risk_score=risk_score,
        anomaly_detected=anomaly_detected,
        severity=severity,
        summary=", ".join(signals) if signals else "no reliability issues detected",
        recommended_action=_recommended_action(severity, anomaly_detected),
        human_readable=human_readable,
    )

    saved_insight = save_insight(insight)
    report_insight(saved_insight)
    return saved_insight


def _recommended_action(severity: str, anomaly_detected: bool) -> str:
    if severity in {"critical", "high"} or anomaly_detected:
        return "investigate recent failures and latency spikes"

    if severity == "medium":
        return "monitor closely and review recent deploys"

    return "no action needed"
