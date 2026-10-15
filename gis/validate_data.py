from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_FOLDER = PROJECT_ROOT / "data" / "raw"

def main():
    csv_files = list(RAW_FOLDER.glob("*.csv"))

    if not csv_files:
        print("No CSV files found in data/raw/")
        print(f"Please copy your datasets into: {RAW_FOLDER}")
        return

    for file_path in sorted(csv_files):
        print("\n" + "=" * 60)
        print(f"Dataset: {file_path.name}")

        try:
            df = pd.read_csv(file_path)

            print(f"Rows: {len(df)}")
            print(f"Columns: {len(df.columns)}")
            print("\nColumn names:")
            print(df.columns.tolist())

            print("\nMissing values per column:")
            print(df.isna().sum().to_string())

            print(f"\nDuplicate full rows: {df.duplicated().sum()}")

        except Exception as error:
            print(f"Could not read this file: {error}")

if __name__ == "__main__":
    main()