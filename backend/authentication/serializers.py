from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import ACMEUser, MFAToken
import re


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = ACMEUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'mfa_enabled', 'mfa_method', 'is_active']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=12)
    password_confirm = serializers.CharField(write_only=True, min_length=12)
    email = serializers.EmailField()
    
    class Meta:
        model = ACMEUser
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
    
    def validate_password(self, value):
        # Validar complejidad de contraseña
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError("La contraseña debe contener al menos una mayúscula")
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError("La contraseña debe contener al menos una minúscula")
        if not re.search(r'[0-9]', value):
            raise serializers.ValidationError("La contraseña debe contener al menos un número")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', value):
            raise serializers.ValidationError("La contraseña debe contener al menos un carácter especial")
        return value
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Las contraseñas no coinciden")
        
        # Validar que el email no exista
        if ACMEUser.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError("Este email ya está registrado")
        
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        user = ACMEUser.objects.create_user(**validated_data)
        user.set_password(password)
        user.mfa_enabled = True  # MFA habilitado por defecto
        user.save()
        
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError("Credenciales inválidas")
        data['user'] = user
        return data


class MFAVerifySerializer(serializers.Serializer):
    token = serializers.CharField(max_length=6, min_length=6)
    
    def validate_token(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("El token debe contener solo dígitos")
        return value


class EnableMFASerializer(serializers.Serializer):
    mfa_method = serializers.ChoiceField(choices=['email', 'sms'])
    phone_number = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        if data['mfa_method'] == 'sms' and not data.get('phone_number'):
            raise serializers.ValidationError("Se requiere número de teléfono para SMS")
        return data
