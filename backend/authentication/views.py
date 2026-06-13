from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from .models import ACMEUser, MFAToken
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    MFAVerifySerializer, EnableMFASerializer
)


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user"""
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'user': UserSerializer(user).data,
            'message': 'Usuario registrado exitosamente. Inicia sesión para continuar.'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Login and request MFA code"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # Verificar si la cuenta está bloqueada
        if user.locked_until and timezone.now() < user.locked_until:
            return Response({
                'error': 'Cuenta bloqueada. Intenta de nuevo más tarde.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Si MFA está habilitado
        if user.mfa_enabled:
            # Generar token MFA
            mfa_token = MFAToken.create_for_user(user, token_type=user.mfa_method)
            
            # Enviar por email (por ahora solo email)
            try:
                send_mail(
                    subject='Código de verificación ACME ERP',
                    message=f'Tu código de verificación es: {mfa_token.token}\n\nEste código expira en 15 minutos.',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as e:
                print(f"Error enviando email: {e}")
            
            return Response({
                'message': 'Se ha enviado un código de verificación a tu email',
                'mfa_required': True,
                'username': user.username,
            }, status=status.HTTP_200_OK)
        
        # Si MFA no está habilitado, generar tokens JWT
        refresh = RefreshToken.for_user(user)
        user.failed_login_attempts = 0
        user.save()
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_mfa(request):
    """Verify MFA token and generate JWT"""
    username = request.data.get('username')
    token = request.data.get('token')
    
    if not username or not token:
        return Response({
            'error': 'Username y token son requeridos'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = ACMEUser.objects.get(username=username)
    except ACMEUser.DoesNotExist:
        return Response({
            'error': 'Usuario no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Buscar token MFA válido
    mfa_token = MFAToken.objects.filter(
        user=user,
        token=token
    ).first()
    
    if not mfa_token:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 3:
            user.locked_until = timezone.now() + timedelta(minutes=30)
        user.save()
        
        return Response({
            'error': 'Código de verificación inválido'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    if not mfa_token.is_valid():
        return Response({
            'error': 'Código expirado o ya utilizado'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Marcar token como usado
    mfa_token.mark_as_used()
    
    # Generar JWT
    refresh = RefreshToken.for_user(user)
    user.failed_login_attempts = 0
    user.mfa_verified = True
    user.save()
    
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
        'message': 'Autenticación exitosa'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    """Get current user profile"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout user"""
    try:
        refresh_token = request.data.get("refresh")
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({
            'message': 'Logout exitoso'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enable_mfa(request):
    """Enable MFA for user"""
    serializer = EnableMFASerializer(data=request.data)
    if serializer.is_valid():
        user = request.user
        user.mfa_method = serializer.validated_data['mfa_method']
        if serializer.validated_data.get('phone_number'):
            user.phone_number = serializer.validated_data['phone_number']
        user.mfa_enabled = True
        user.save()
        
        return Response({
            'message': 'MFA habilitado correctamente',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_data(request):
    """Get user data for frontend"""
    return Response({
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'mfa_enabled': request.user.mfa_enabled,
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_mfa_activation(request):
    """Request MFA activation - sends verification email"""
    user = request.user
    
    # Si ya tiene MFA habilitado
    if user.mfa_enabled:
        return Response({
            'error': 'MFA ya está habilitado para tu cuenta'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Generar token de verificación
    mfa_token = MFAToken.create_for_user(user, token_type='email')
    
    try:
        # Enviar email con código de verificación
        send_mail(
            subject='Verificación de Email - Activar MFA en ACME ERP',
            message=f'''
Hola {user.first_name or user.username},

Para completar la activación de autenticación de dos factores (MFA) en tu cuenta ACME ERP, 
ingresa el siguiente código de verificación:

    {mfa_token.token}

Este código es válido por 15 minutos.

Si no solicitaste activar MFA, ignora este mensaje.

---
ACME ERP - Sistema de Gestión Empresarial
            ''',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        
        return Response({
            'message': f'Se ha enviado un código de verificación a {user.email}',
            'email': user.email,
            'mfa_token_id': mfa_token.id
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error enviando email: {e}")
        mfa_token.delete()
        return Response({
            'error': 'Error al enviar email de verificación'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_mfa_activation(request):
    """Confirm MFA activation with verification code"""
    user = request.user
    token = request.data.get('token', '').strip()
    mfa_method = request.data.get('mfa_method', 'email')
    
    if not token or len(token) != 6 or not token.isdigit():
        return Response({
            'error': 'Código inválido. Debe ser de 6 dígitos'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if user.mfa_enabled:
        return Response({
            'error': 'MFA ya está habilitado para tu cuenta'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Buscar token de verificación
    mfa_token = MFAToken.objects.filter(
        user=user,
        token=token,
        token_type='email',
        is_used=False
    ).first()
    
    if not mfa_token:
        return Response({
            'error': 'Código de verificación inválido'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Validar que no esté expirado
    if not mfa_token.is_valid():
        return Response({
            'error': 'Código expirado. Solicita uno nuevo'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Marcar token como usado y activar MFA
    mfa_token.mark_as_used()
    user.mfa_enabled = True
    user.mfa_method = mfa_method
    user.mfa_verified = True
    user.save()
    
    return Response({
        'message': 'MFA activado correctamente',
        'user': UserSerializer(user).data
    }, status=status.HTTP_200_OK)
