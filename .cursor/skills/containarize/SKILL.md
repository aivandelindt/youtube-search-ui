---
name: containerize
description: Use for containerizing applications and creating docker-compose setups
---

# Docker Deployment

Expert guidance for containerizing Python applications with Docker and orchestrating multi-service setups with docker-compose.

## Core Patterns

### ✅ MUST Follow

- **Use multi-stage builds** - Separate build and runtime stages for smaller images
- **Run as non-root user** - Create and use a dedicated user for security
- **Use health checks** - Define health check endpoints for container monitoring
- **Pin versions** - Use specific version tags, never use `latest`
- **Minimize layers** - Combine RUN commands to reduce image size
- **Use .dockerignore** - Exclude unnecessary files from build context

### ❌ NEVER Do

- **Use latest tag** - Always pin specific versions for reproducibility
- **Copy secrets** - Never include credentials in images; use environment variables
- **Run as root** - Security risk; always create a non-root user
- **Skip health checks** - Health checks are essential for production
- **Include dev dependencies** - Keep production images lean
- **Hardcode configuration** - Use environment variables for configuration

## Multi-Stage Dockerfile for FastAPI

### Production-Ready Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# Build stage
FROM python:3.11-slim as builder

# Set working directory
WORKDIR /build

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Runtime stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/home/appuser/.local/bin:$PATH \
    APP_HOME=/app

# Install runtime dependencies only
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && \
    useradd -r -g appuser -d /home/appuser -s /sbin/nologin appuser && \
    mkdir -p /home/appuser/.local && \
    chown -R appuser:appuser /home/appuser

# Set working directory
WORKDIR $APP_HOME

# Copy Python dependencies from builder
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser ./app ./app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)" || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Development Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

# Copy application code
COPY ./app ./app

# Expose port
EXPOSE 8000

# Run with auto-reload for development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

## docker-compose Setup

### Production docker-compose.yml

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  db:
    image: postgres:16-alpine
    container_name: api_database
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-apiuser}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Database password required}
      POSTGRES_DB: ${DB_NAME:-apidb}
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=en_US.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-apiuser} -d ${DB_NAME:-apidb}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # FastAPI Application
  api:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        PYTHON_VERSION: 3.11
    container_name: api_server
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER:-apiuser}:${DB_PASSWORD}@db:5432/${DB_NAME:-apidb}
      SECRET_KEY: ${SECRET_KEY:?Secret key required}
      ENVIRONMENT: ${ENVIRONMENT:-production}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-http://localhost:3000}
    ports:
      - "8000:8000"
    networks:
      - app_network
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "python", "-c", "import requests; requests.get('http://localhost:8000/health', timeout=5)"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

  # Nginx Reverse Proxy (Optional)
  nginx:
    image: nginx:1.25-alpine
    container_name: api_nginx
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local

networks:
  app_network:
    driver: bridge
```

### Development docker-compose.override.yml

```yaml
version: '3.9'

services:
  db:
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: devpassword

  api:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./app:/app/app
      - ./tests:/app/tests
    environment:
      DATABASE_URL: postgresql+asyncpg://apiuser:devpassword@db:5432/apidb
      SECRET_KEY: dev-secret-key-not-for-production
      ENVIRONMENT: development
      LOG_LEVEL: debug
      RELOAD: "true"
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    ports:
      - "8000:8000"
      - "5678:5678"  # Debug port

  # PgAdmin for database management (dev only)
  pgadmin:
    image: dpage/pgadmin4:8
    container_name: api_pgadmin
    restart: unless-stopped
    depends_on:
      - db
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "5050:80"
    networks:
      - app_network
    volumes:
      - pgadmin_data:/var/lib/pgadmin

volumes:
  pgadmin_data:
    driver: local
```

## .dockerignore File

```dockerignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.venv
pip-log.txt
pip-delete-this-directory.txt
.pytest_cache/
.coverage
htmlcov/
*.cover
.hypothesis/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Git
.git/
.gitignore
.gitattributes

# Docker
Dockerfile*
docker-compose*.yml
.dockerignore

# Documentation
*.md
docs/
LICENSE
README*

# CI/CD
.github/
.gitlab-ci.yml
.travis.yml

# Environment
.env
.env.*
*.env

# Logs
logs/
*.log

# Database
*.db
*.sqlite
*.sqlite3

# OS
.DS_Store
Thumbs.db

# Tests
tests/
test_*.py
*_test.py

# Build artifacts
dist/
build/
*.egg-info/
```

## Health Check Implementation

### app/routes/health.py

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict
import time
from ..database import get_db

router = APIRouter(tags=["health"])

@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Health check endpoint"
)
async def health_check() -> Dict[str, str]:
    """
    Basic health check endpoint.
    Returns 200 if service is running.
    """
    return {
        "status": "healthy",
        "service": "api",
        "timestamp": time.time()
    }

@router.get(
    "/health/ready",
    status_code=status.HTTP_200_OK,
    summary="Readiness check endpoint"
)
async def readiness_check(
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """
    Readiness check that verifies database connectivity.
    Returns 200 if service is ready to accept traffic.
    """
    try:
        # Check database connection
        result = await db.execute(text("SELECT 1"))
        result.scalar()

        return {
            "status": "ready",
            "database": "connected",
            "timestamp": time.time()
        }
    except Exception as e:
        return {
            "status": "not ready",
            "database": "disconnected",
            "error": str(e),
            "timestamp": time.time()
        }

@router.get(
    "/health/live",
    status_code=status.HTTP_200_OK,
    summary="Liveness check endpoint"
)
async def liveness_check() -> Dict[str, str]:
    """
    Liveness check to verify the application is running.
    Used by container orchestrators to restart unhealthy containers.
    """
    return {
        "status": "alive",
        "timestamp": time.time()
    }
```

## Docker Commands Cheat Sheet

```bash
# Build image
docker build -t api-service:1.0.0 .

# Build with specific Dockerfile
docker build -f Dockerfile.dev -t api-service:dev .

# Run container
docker run -d -p 8000:8000 --name api api-service:1.0.0

# Run with environment variables
docker run -d -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e SECRET_KEY=secret \
  --name api api-service:1.0.0

# docker-compose commands
docker-compose up -d                 # Start services in background
docker-compose up --build            # Rebuild and start
docker-compose down                  # Stop and remove containers
docker-compose down -v               # Also remove volumes
docker-compose logs -f api           # Follow logs for api service
docker-compose ps                    # List running services
docker-compose exec api bash         # Execute bash in api container
docker-compose restart api           # Restart api service

# View logs
docker logs -f api                   # Follow logs
docker logs --tail 100 api           # Last 100 lines

# Execute commands in container
docker exec -it api bash             # Interactive bash
docker exec api python manage.py migrate  # Run command

# Inspect container
docker inspect api                   # Full container details
docker stats api                     # Resource usage

# Cleanup
docker system prune -a               # Remove all unused images
docker volume prune                  # Remove unused volumes
```

## Environment Variables Template

### .env.example

```bash
# Database Configuration
DB_USER=apiuser
DB_PASSWORD=changeme
DB_NAME=apidb
DB_HOST=db
DB_PORT=5432
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Application Configuration
SECRET_KEY=your-secret-key-min-32-characters-long
ENVIRONMENT=production
LOG_LEVEL=info
DEBUG=false

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Security
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# External Services
REDIS_URL=redis://redis:6379/0
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

## Production Considerations

### Security Checklist

- ✅ Use non-root user in containers
- ✅ Pin all image versions
- ✅ Scan images for vulnerabilities
- ✅ Use secrets management (Docker Secrets, Vault)
- ✅ Enable read-only root filesystem when possible
- ✅ Limit container resources (memory, CPU)
- ✅ Use private registries for images
- ✅ Enable Docker Content Trust

### Performance Optimization

```yaml
# Resource limits in docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Logging Configuration

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Best Practices Summary

1. **Use multi-stage builds** to minimize image size
2. **Run as non-root user** for security
3. **Implement health checks** for all services
4. **Pin specific versions** for reproducibility
5. **Use .dockerignore** to reduce build context
6. **Set resource limits** to prevent resource exhaustion
7. **Use environment variables** for configuration
8. **Enable health checks** in docker-compose
9. **Separate dev and prod configurations** with override files
10. **Monitor container logs** and metrics in production