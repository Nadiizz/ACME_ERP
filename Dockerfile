# Multi-stage build para ACME ERP
FROM python:3.13-slim as backend

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código backend
COPY backend/ .

# Crear usuario no-root
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python manage.py check || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "acme_project.wsgi:application"]



FROM node:18-alpine as frontend

WORKDIR /app

# Copiar package files
COPY frontend/package*.json .
RUN npm ci --only=production

# Copiar código frontend
COPY frontend/ .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]
