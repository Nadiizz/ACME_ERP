from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import ACMEUser, MFAToken


@admin.register(ACMEUser)
class ACMEUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'mfa_enabled', 'mfa_verified', 'failed_login_attempts', 'created_at']
    list_filter = ['mfa_enabled', 'mfa_verified', 'created_at', 'mfa_method']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    readonly_fields = ['last_login', 'created_at', 'updated_at', 'failed_login_attempts']
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email', 'phone_number')}),
        ('MFA Settings', {'fields': ('mfa_enabled', 'mfa_method', 'mfa_verified')}),
        ('Security', {
            'fields': ('failed_login_attempts', 'locked_until', 'last_login_ip'),
            'classes': ('collapse',)
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
        ('Important dates', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )


@admin.register(MFAToken)
class MFATokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'token_type', 'is_used', 'attempt_count', 'created_at', 'expires_at']
    list_filter = ['token_type', 'is_used', 'created_at']
    search_fields = ['user__username', 'token']
    readonly_fields = ['token', 'created_at', 'used_at']
    
    fieldsets = (
        ('Token Info', {'fields': ('user', 'token', 'token_type')}),
        ('Status', {'fields': ('is_used', 'attempt_count', 'used_at')}),
        ('Timing', {'fields': ('created_at', 'expires_at')}),
    )
