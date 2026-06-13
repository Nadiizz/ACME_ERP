#!/usr/bin/env python
"""Create MFA test user"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'acme_project.settings')
django.setup()

from authentication.models import ACMEUser

# Crear usuario con MFA
try:
    user = ACMEUser.objects.get(username='mfauser')
    print(f'✓ Usuario existente: {user.username}')
except ACMEUser.DoesNotExist:
    user = ACMEUser.objects.create_user(
        username='mfauser',
        email='mfauser@acmeerp.com',
        password='MFATest123!',
        mfa_enabled=True,
        mfa_method='email',
        first_name='MFA',
        last_name='Test'
    )
    print(f'✓ Usuario creado: {user.username} con MFA habilitado')

# Verificar
print(f'  - Email: {user.email}')
print(f'  - MFA: {"Habilitado" if user.mfa_enabled else "Deshabilitado"}')
print(f'  - Método: {user.mfa_method}')
print(f'\n✓ Credenciales de prueba:')
print(f'  Usuario: mfauser')
print(f'  Contraseña: MFATest123!')
