#!/usr/bin/env bash
set -o errexit

# Render build — run from backend/ (rootDir)
cd "$(dirname "$0")"

pip install --upgrade pip
# CPU-only PyTorch — avoids huge CUDA wheels and build timeouts on Render free tier
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

python manage.py collectstatic --noinput
python manage.py migrate --noinput

# Seed shock history once (no Celery on free tier — backtest runs at deploy)
python manage.py shell -c "
from shock_predictor.models import ShockEvent
raise SystemExit(0 if ShockEvent.objects.exists() else 1)
" 2>/dev/null || python manage.py backtest_shocks --fast --skip-newsapi --threshold 100 --indices nifty,banknifty
