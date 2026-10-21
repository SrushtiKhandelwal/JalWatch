import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score


df = pd.read_csv(
    "data/raw/jalwatch_complaints_final_50000.csv"
)

# Required columns
df = df[
    [
        "complaint_type",
        "severity",
        "status",
        "ward_id",
        "locality_id",
        "incident_risk_label"
    ]
]

# Encode text columns
for col in [
    "complaint_type",
    "severity",
    "status",
    "ward_id",
    "locality_id"
]:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col])

X = df.drop("incident_risk_label", axis=1)
y = df["incident_risk_label"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

predictions = model.predict(X_test)

print("Accuracy:",
      accuracy_score(y_test, predictions))

joblib.dump(
    model,
    "ml/models/risk_model.pkl"
)

print("Model Saved Successfully!")