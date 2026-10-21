"""Display the held-out training report without retraining the model."""

import json

from .train import EVALUATION_PATH


if __name__ == "__main__":
    print(json.dumps(json.loads(EVALUATION_PATH.read_text(encoding="utf-8")), indent=2))
