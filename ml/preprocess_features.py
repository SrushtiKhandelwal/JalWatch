import pandas as pd

df = pd.read_csv("data/raw/jalwatch_complaints_final_50000.csv")

print("Dataset Shape:")
print(df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nFirst 5 Rows:")
print(df.head())