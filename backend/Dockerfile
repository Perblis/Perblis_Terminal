# Backend image for Railway (api + worker share this image; the service's
# start command selects gunicorn vs db_worker). GDAL/GEOS are required by
# GeoDjango/PostGIS.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=settings.prod

RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils libproj-dev gdal-bin libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# uv for fast, reproducible installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Default to the API; the worker service overrides this with `db_worker`.
CMD ["/bin/sh", "-c", "gunicorn wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3"]
