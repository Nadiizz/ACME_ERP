from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission
import secrets
import string
from datetime import timedelta
from django.utils import timezone


class ACMEUser(AbstractUser):
    """Extended user model for ACME ERP with MFA support"""
    
    groups = models.ManyToManyField(
        Group,
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name='acmeuser_set',
        related_query_name='acmeuser'
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name='acmeuser_set',
        related_query_name='acmeuser'
    )
    
    email = models.EmailField(unique=True)
    mfa_enabled = models.BooleanField(default=False)
    mfa_method = models.CharField(
        max_length=20,
        choices=[
            ('email', 'Email'),
            ('sms', 'SMS'),
        ],
        default='email'
    )
    mfa_verified = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    
    # Audit fields
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    failed_login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.username} ({self.email})"
    
    class Meta:
        verbose_name = "ACME User"
        verbose_name_plural = "ACME Users"
        ordering = ['-created_at']


class MFAToken(models.Model):
    """MFA verification tokens"""
    
    user = models.ForeignKey(ACMEUser, on_delete=models.CASCADE, related_name='mfa_tokens')
    token = models.CharField(max_length=6, unique=True)
    token_type = models.CharField(
        max_length=20,
        choices=[
            ('email', 'Email'),
            ('sms', 'SMS'),
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    attempt_count = models.IntegerField(default=0)
    
    def is_valid(self):
        """Check if token is still valid"""
        return (
            not self.is_used and 
            self.attempt_count < 3 and
            timezone.now() < self.expires_at
        )
    
    def mark_as_used(self):
        """Mark token as used"""
        self.is_used = True
        self.used_at = timezone.now()
        self.save()
    
    @staticmethod
    def generate_token(length=6):
        """Generate a random numeric token"""
        return ''.join(secrets.choice(string.digits) for _ in range(length))
    
    @staticmethod
    def create_for_user(user, token_type='email'):
        """Create a new MFA token for a user"""
        token = MFAToken.generate_token()
        expires_at = timezone.now() + timedelta(minutes=15)
        
        return MFAToken.objects.create(
            user=user,
            token=token,
            token_type=token_type,
            expires_at=expires_at
        )
    
    def __str__(self):
        return f"MFA Token for {self.user.username}"
    
    class Meta:
        verbose_name = "MFA Token"
        verbose_name_plural = "MFA Tokens"
        ordering = ['-created_at']
