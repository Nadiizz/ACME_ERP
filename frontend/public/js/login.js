// Login Management
const BACKEND_URL = 'http://localhost:8000';
const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
  // Show login form on load
  document.getElementById('loginForm').classList.remove('hidden');
  
  // Login form submission
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      showLoading(true);
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        showError(data.error || 'Error en el login');
        return;
      }
      
      // Si se requiere MFA
      if (data.mfa_required) {
        sessionStorage.setItem('temp_token', data.temp_token || '');
        showMFAForm();
        return;
      }
      
      // Login exitoso
      if (data.success && data.access) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error de conexión con el servidor');
    } finally {
      showLoading(false);
    }
  });
  
  // MFA form submission
  document.getElementById('mfaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mfaToken = document.getElementById('mfaToken').value;
    const username = sessionStorage.getItem('username') || '';
    
    try {
      showLoading(true);
      const response = await fetch(`${API_URL}/auth/verify-mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          username,
          mfa_token: mfaToken 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        showError(data.error || 'Error al verificar MFA');
        return;
      }
      
      // MFA verificado
      if (data.success && data.access) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('user', JSON.stringify(data.user));
        sessionStorage.removeItem('temp_token');
        sessionStorage.removeItem('username');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error al verificar el código MFA');
    } finally {
      showLoading(false);
    }
  });
});

function showMFAForm() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('mfaForm').classList.remove('hidden');
}

function backToLogin() {
  document.getElementById('mfaForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('loginForm').reset();
  sessionStorage.removeItem('temp_token');
}

function showError(message) {
  // Create alert
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-error';
  alertDiv.textContent = message;
  
  const container = document.querySelector('.login-container');
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => alertDiv.remove(), 5000);
}

function showLoading(show) {
  const btn = document.activeElement;
  if (show) {
    btn.disabled = true;
    btn.textContent = 'Procesando...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.id === 'loginBtn' ? 'Iniciar Sesión' : 'Verificar';
  }
}
