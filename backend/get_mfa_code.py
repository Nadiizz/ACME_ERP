#!/usr/bin/env python
"""Get MFA code for testing"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'acme_project.settings')
django.setup()

from authentication.models import MFAToken, ACMEUser

user = ACMEUser.objects.get(username='mfauser')
token = MFAToken.objects.filter(user=user, is_used=False).order_by('-created_at').first()

if token:
    print(f'✓ Código MFA válido: {token.token}')
    print(f'  Expira: {token.expires_at}')
    print(f'  Usuario: {user.username}')
else:
    print('✗ No hay token MFA válido')
