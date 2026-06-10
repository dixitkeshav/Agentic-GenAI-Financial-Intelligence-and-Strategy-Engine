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
