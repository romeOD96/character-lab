from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


OUTPUT_DIR = Path("outputs")


def export_to_json(data: Any) -> str:
    """
    Saves generation results to a timestamped JSON file.
    """
    OUTPUT_DIR.mkdir(exist_ok=True)

    filename = OUTPUT_DIR / f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return str(filename)
