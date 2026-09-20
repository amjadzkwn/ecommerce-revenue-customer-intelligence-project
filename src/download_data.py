"""Download and extract the public Olist dataset from Kaggle.

No Kaggle API key is required for this public dataset endpoint.
"""

from __future__ import annotations

import shutil
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.kaggle.com/api/v1/datasets/download/olistbr/brazilian-ecommerce"
ARCHIVE = ROOT / "source_data" / "olist_brazilian_ecommerce.zip"
RAW = ROOT / "data" / "raw"


def main() -> None:
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    print("Downloading the Olist public dataset from Kaggle...")
    with urllib.request.urlopen(URL, timeout=120) as response, ARCHIVE.open("wb") as target:
        shutil.copyfileobj(response, target)
    with zipfile.ZipFile(ARCHIVE) as bundle:
        bundle.extractall(RAW)
    print(f"Extracted {len(list(RAW.glob('*.csv')))} CSV files into {RAW}")


if __name__ == "__main__":
    main()
