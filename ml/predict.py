import joblib
import pandas as pd

model = joblib.load("ml/models/risk_model.pkl")

def predict_risk(
    complaint_type,
    severity,
    status,
    ward_id,
    locality_id
):

    sample = pd.DataFrame(
        [[
            complaint_type,
            severity,
            status,
            ward_id,
            locality_id
        ]],
        columns=[
            "complaint_type",
            "severity",
            "status",
            "ward_id",
            "locality_id"
        ]
    )

    prediction = model.predict(sample)[0]

    return prediction