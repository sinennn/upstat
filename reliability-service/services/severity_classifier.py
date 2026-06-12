
def risk_classifier(risk_score: int) -> str:
    if risk_score >= 81:
       return "critical"
   
    if risk_score >= 61:
        return "high"
    
    if risk_score >= 31:
       return "medium"
   
    return "low"

