import os
import pickle
import logging
from pathlib import Path
import numpy as np

logger = logging.getLogger(__name__)


class MLAnomalyDetector:
    """
    Load pre-trained anomaly detection model and use it for predictions at inference time.
    Called during insight generation to detect if recent checks are anomalous.
    
    Usage:
        detector = MLAnomalyDetector("monitor-id")
        result = detector.predict_anomaly(list_of_checks)
        # result = {"is_anomaly": bool, "anomaly_score": float (0-1)}
    """
    
    def __init__(self, monitor_id: str):
        self.monitor_id = monitor_id
        self.model = None
        self.transformer = None
        self._load_model()
    
    def _load_model(self):
        """Load model and transformer from disk, if they exist."""
        model_dir = Path("ml/models")
        model_path = model_dir / f"{self.monitor_id}_anomaly_model.pkl"
        transformer_path = model_dir / f"{self.monitor_id}_transformer.pkl"
        
        if not model_path.exists() or not transformer_path.exists():
            logger.warning(
                f"No trained model found for monitor {self.monitor_id}. "
                f"Run: python train_anomaly_model.py {self.monitor_id}"
            )
            return False
        
        try:
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
            with open(transformer_path, "rb") as f:
                self.transformer = pickle.load(f)
            logger.info(f"Loaded anomaly model for {self.monitor_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def predict_anomaly(self, checks: list) -> dict:
        """
        Predict if recent checks indicate an anomaly.
        
        Args:
            checks: list of check dicts from Go backend with keys:
                - responseTimeMs
                - status ("up" or "down")
                - statusCode
                - attempts
        
        Returns:
            {
                "is_anomaly": bool,
                "anomaly_score": float (0-1, where 1 = highly anomalous)
            }
        """
        # Fallback if model not loaded
        if self.model is None or self.transformer is None:
            logger.debug(f"Model not available for {self.monitor_id}, returning neutral prediction")
            return {"is_anomaly": False, "anomaly_score": 0.0}
        
        if not checks:
            logger.warning("No checks provided for anomaly detection")
            return {"is_anomaly": False, "anomaly_score": 0.0}
        
        try:
            # Transform checks to feature matrix
            feature_matrix = self.transformer.transform(checks)
            
            # Get prediction and score for the most recent check (last row)
            recent_check_features = feature_matrix[-1:]
            
            # Prediction: -1 = anomaly, 1 = normal
            prediction = self.model.predict(recent_check_features)[0]
            
            # Anomaly score: lower = more anomalous
            score = self.model.predict_proba(recent_check_features)[0]
            
            # Convert to 0-1 scale where 1 = highly anomalous
            # Isolation Forest scores range roughly from -0.3 to 0.0
            # We normalize: 0.0 -> 0.0 (normal), -0.3 -> 1.0 (anomalous)
            anomaly_score = max(0.0, min(1.0, -score / 0.3))
            
            is_anomaly = prediction == -1
            
            logger.debug(
                f"Monitor {self.monitor_id}: "
                f"prediction={prediction}, raw_score={score:.3f}, normalized_score={anomaly_score:.3f}"
            )
            
            return {
                "is_anomaly": is_anomaly,
                "anomaly_score": float(anomaly_score)
            }
        
        except Exception as e:
            logger.error(f"Prediction failed for {self.monitor_id}: {e}")
            return {"is_anomaly": False, "anomaly_score": 0.0}
