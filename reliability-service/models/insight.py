from dataclasses import dataclass


@dataclass(frozen=True)
class Insight:
    monitor_id: str
    risk_score: int
    anomaly_detected: bool
    severity: str
    summary: str
    recommended_action: str

    def to_dict(self) -> dict:
        return {
            "monitor_id": self.monitor_id,
            "risk_score": self.risk_score,
            "anomaly_detected": self.anomaly_detected,
            "severity": self.severity,
            "summary": self.summary,
            "recommended_action": self.recommended_action,
        }

