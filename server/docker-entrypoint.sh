#!/bin/sh
set -eu

python manage.py migrate --noinput
python manage.py seed_cars
exec gunicorn djangoproj.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --timeout 60
