import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score
)

df = pd.read_csv(
    "data/raw/jalwatch_complaints_final_50000.csv"
)

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

pred = model.predict(X_test)

print("Accuracy :", accuracy_score(y_test, pred))
print("Precision:", precision_score(y_test, pred))
print("Recall   :", recall_score(y_test, pred))
print("F1 Score :", f1_score(y_test, pred))