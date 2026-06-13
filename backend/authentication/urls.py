from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('verify-mfa/', views.verify_mfa, name='verify_mfa'),
    path('profile/', views.profile, name='profile'),
    path('logout/', views.logout, name='logout'),
    path('enable-mfa/', views.enable_mfa, name='enable_mfa'),
    path('user-data/', views.user_data, name='user_data'),
    path('request-mfa-activation/', views.request_mfa_activation, name='request_mfa_activation'),
    path('confirm-mfa-activation/', views.confirm_mfa_activation, name='confirm_mfa_activation'),
]
