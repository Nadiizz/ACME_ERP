# ACME ERP - Sistema de Gestión para Ferretería y Distribuidora de Energía

Sistema ERP desarrollado con Django (Backend) + Express (Frontend) + PostgreSQL, implementando autenticación multifactor por email y compliance con leyes OIV chilenas.

## Características

- ✅ Portal de login con autenticación JWT
- ✅ MFA (Autenticación multifactor) por email
- ✅ Base de datos PostgreSQL
- ✅ API RESTful con Django REST Framework
- ✅ Frontend con Express.js
- ✅ Gestión de usuarios y roles
- ✅ Seguridad avanzada (Helmet, CORS, Rate Limiting)
- ✅ Encriptación de datos

## Requisitos Previos

- **Python 3.13+**
- **Node.js 18+**
- **PostgreSQL 12+**
- **Git**

## Estructura del Proyecto

```
/srv/acme-erp/
├── backend/                 # Django Backend
│   ├── acme_project/       # Configuración del proyecto
│   ├── authentication/     # App de autenticación
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/               # Express Frontend
│   ├── routes/            # Rutas de la API
│   ├── public/            # Archivos estáticos
│   ├── package.json
│   ├── server.js
│   └── .env.example
├── docs/                  # Documentación
└── .gitignore
```

## Instalación y Configuración

### 1. Clonar el Repositorio

```bash
cd /srv/acme-erp
git init
git config user.email "tu@email.com"
git config user.name "Tu Nombre"
```

### 2. Configurar Backend (Django)

#### Crear Entorno Virtual
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # En PowerShell
```

#### Instalar Dependencias
```bash
pip install -r requirements.txt
pip install djangorestframework-simplejwt
```

#### Configurar Base de Datos
1. Crear archivo `.env` desde `.env.example`:
```bash
copy .env.example .env
```

2. Editar `.env` con tus credenciales de PostgreSQL:
```env
DB_NAME=acme_erp
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_PORT=5432
```

#### Ejecutar Migraciones
```bash
python manage.py makemigrations
python manage.py migrate
```

#### Crear Superusuario
```bash
python manage.py createsuperuser
```

#### Iniciar Servidor Django
```bash
python manage.py runserver 0.0.0.0:8000
```

**Backend disponible en:** `http://localhost:8000`

---

### 3. Configurar Frontend (Express)

#### Instalar Dependencias
```bash
cd ../frontend
npm install
```

#### Configurar Variables de Entorno
```bash
copy .env.example .env
```

Editar `.env`:
```env
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:8000
SESSION_SECRET=your-session-secret-change-in-production
```

#### Instalar Nodemon (opcional, para desarrollo)
```bash
npm install -D nodemon
```

#### Iniciar Servidor Express
```bash
npm start    # Producción
npm run dev  # Desarrollo (con Nodemon)
```

**Frontend disponible en:** `http://localhost:3000`

---

## Configuración de PostgreSQL

### En Windows (con psql)

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE acme_erp;

# Crear usuario
CREATE USER acme_user WITH PASSWORD 'tu_contraseña';

# Otorgar permisos
ALTER ROLE acme_user SET client_encoding TO 'utf8';
ALTER ROLE acme_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE acme_user SET default_transaction_deferrable TO on;
ALTER ROLE acme_user SET timezone TO 'America/Santiago';
GRANT ALL PRIVILEGES ON DATABASE acme_erp TO acme_user;

# Salir
\q
```

---

## Uso del Sistema

### 1. Acceder al Portal

1. Ir a `http://localhost:3000`
2. Hacer clic en "Inicia Sesión"

### 2. Crear Cuenta (Registro)

```
Usuario: user_demo
Contraseña: SecurePass123!
Email: demo@acmeerp.com
```

**Requisitos de contraseña:**
- Mínimo 12 caracteres
- Al menos una mayúscula
- Al menos una minúscula
- Al menos un número
- Al menos un carácter especial (!@#$%^&*)

### 3. Autenticación con MFA

1. Ingresar credenciales
2. Se enviará código a tu email (en consola de Django durante desarrollo)
3. Ingresar código de 6 dígitos
4. Acceso concedido al Dashboard

---

## Endpoints de la API

### Autenticación
- `POST /api/auth/register/` - Registro de usuarios
- `POST /api/auth/login/` - Iniciar sesión
- `POST /api/auth/verify-mfa/` - Verificar código MFA
- `POST /api/auth/logout/` - Cerrar sesión
- `GET /api/auth/profile/` - Perfil del usuario (requiere token)

### Dashboard
- `GET /api/dashboard/home` - Home del dashboard

---

## Variables de Entorno

### Backend (.env)
```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
DB_NAME=acme_erp
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:3000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Frontend (.env)
```env
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:8000
SESSION_SECRET=your-session-secret
```

---

## Flujo de Autenticación

```
┌─────────┐
│ Usuario │
└────┬────┘
     │
     ├─── POST /api/auth/login ───────► Backend
     │                                     │
     │                                     ├─ Verificar credenciales
     │                                     │
     │◄─── Respuesta + MFA requerido ────┤
     │
     ├─── POST /api/auth/verify-mfa ────► Backend
     │                                     │
     │                                     ├─ Enviar código por email
     │                                     │
     ├─ Recibe código por email
     │
     ├─── POST /api/auth/verify-mfa ────► Backend
     │     (con código)                    │
     │                                     ├─ Generar JWT
     │                                     │
     │◄─── JWT + Refresh Token ──────────┤
     │
     └─── Acceso a Dashboard ───────────► Frontend
```

---

## Seguridad Implementada

### Backend
- ✅ Validación de contraseñas fuerte
- ✅ Hash de contraseñas con PBKDF2
- ✅ JWT con expiración (1 hora)
- ✅ Rate limiting en intentos de login
- ✅ Bloqueo de cuenta tras fallos repetidos
- ✅ MFA por email
- ✅ CORS configurado
- ✅ CSRF protection

### Frontend
- ✅ Helmet.js para headers de seguridad
- ✅ Rate limiting
- ✅ Cookies HttpOnly
- ✅ HTTPS en producción
- ✅ Session security

---

## Troubleshooting

### Error: "psycopg2: connection refused"
```bash
# Verificar que PostgreSQL está ejecutándose
psql -U postgres -c "SELECT 1"
```

### Error: "Port 3000 already in use"
```bash
# Cambiar puerto en frontend/.env
PORT=3001
```

### Error: "No such table: authentication_acmeuuser"
```bash
# Ejecutar migraciones
python manage.py migrate
```

---

## Desarrollo Futuro

- [ ] Módulo de Inventario
- [ ] Módulo de Ventas
- [ ] Módulo de Facturación
- [ ] Reportes y Análisis
- [ ] Integración con AWS RDS
- [ ] Backup automático a S3
- [ ] Dashboard administrativo
- [ ] Sistema de roles y permisos avanzado

---

## Contribuciones

Este es un proyecto académico. Para contribuciones:
1. Crear una rama (`git checkout -b feature/mejora`)
2. Commit de cambios (`git commit -m 'Agregar mejora'`)
3. Push a la rama (`git push origin feature/mejora`)
4. Abrir Pull Request

---

## Licencia

Proyecto propietario de ACME Limitada © 2026

---

## Soporte

Para reportar issues o solicitar ayuda:
- Crear un issue en el repositorio
- Contactar al equipo de desarrollo

---

**Última actualización:** 12 de Junio, 2026
