@echo off
REM Script de configuración rápida para ACME ERP
REM Run: setup.bat desde c:\srv\acme-erp\

echo.
echo ╔════════════════════════════════════════════════╗
echo ║     ACME ERP - Setup Script                    ║
echo ║     Sistema de Gestión de Ferretería          ║
echo ╚════════════════════════════════════════════════╝
echo.

echo [1/4] Configurando Backend (Django)...
cd backend

if not exist venv (
    echo Creando entorno virtual...
    python -m venv venv
) else (
    echo Entorno virtual ya existe
)

echo Activando entorno virtual...
call venv\Scripts\activate.bat

echo Instalando dependencias de Python...
pip install -q -r requirements.txt
pip install -q djangorestframework-simplejwt

if not exist .env (
    echo Creando archivo .env desde .env.example...
    copy .env.example .env
    echo ⚠️  Actualiza .env con tus credenciales de PostgreSQL
)

echo.
echo [2/4] Migraciones de base de datos...
python manage.py makemigrations
python manage.py migrate

echo.
echo [3/4] Configurando Frontend (Express)...
cd ..\frontend

echo Instalando dependencias de Node...
call npm install -q

if not exist .env (
    echo Creando archivo .env desde .env.example...
    copy .env.example .env
)

echo.
echo [4/4] Verificando conexión a PostgreSQL...
cd ..\backend

echo.
echo ╔════════════════════════════════════════════════╗
echo ║     ✅ Configuración completada                ║
echo ╚════════════════════════════════════════════════╝
echo.
echo Próximos pasos:
echo.
echo 1. Backend (Django):
echo    cd backend
echo    .\venv\Scripts\activate.bat
echo    python manage.py createsuperuser
echo    python manage.py runserver 0.0.0.0:8000
echo.
echo 2. Frontend (Express) - En otra terminal:
echo    cd frontend
echo    npm start
echo.
echo 3. Accede a: http://localhost:3000
echo.
pause
