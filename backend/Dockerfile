FROM python:3.14-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.11.6 /uv /uvx /bin/

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app app

FROM base AS production-dependencies

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM base AS development

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY --chown=app:app . .
RUN mkdir -p /data/media /data/static && chown -R app:app /data

ENV DJANGO_DEBUG=true \
    DJANGO_MEDIA_ROOT=/data/media

USER 10001:10001
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM python:3.14-slim AS production

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_MEDIA_ROOT=/data/media \
    DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 \
    HOME=/tmp

WORKDIR /app

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app app \
    && mkdir -p /data/media /data/static \
    && chown -R app:app /data/media /data/static

COPY --from=production-dependencies --chown=app:app /opt/venv /opt/venv
COPY --chown=app:app . .

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD ["python", "-c", "from urllib.request import urlopen; response = urlopen('http://127.0.0.1:8000/api/v1/health/', timeout=2); exit(0 if response.status == 200 else 1)"]

CMD ["gunicorn", "--bind=0.0.0.0:8000", "--workers=2", "--error-logfile=-", "config.wsgi:application"]
