#!/usr/bin/env bash
# Run the theories backend on 127.0.0.1:8766 in the poc-backend conda env.
set -euo pipefail
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate poc-backend
cd "$(dirname "$0")/.."
exec python -m uvicorn app.main:app --host 127.0.0.1 --port "${THEORIES_PORT:-8766}" --reload
