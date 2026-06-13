// Authentication Logic

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const mfaForm = document.getElementById('mfaForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  if (mfaForm) {
    mfaForm.addEventListener('submit', handleMFA);
  }
});

async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    showMessage('Por favor ingresa usuario y contraseña', 'error');
    return;
  }
  
  showLoading(true);
  
  try {
    console.log('Enviando login para:', username);
    
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    console.log('Respuesta del servidor:', response.status, data);
    
    if (response.ok) {
      if (data.mfa_required) {
        // Guardar username para MFA
        sessionStorage.setItem('username', username);
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('mfaForm').classList.remove('hidden');
        showMessage('Se ha enviado un código de verificación a tu email', 'info');
      } else if (data.access) {
        // Login exitoso sin MFA
        localStorage.setItem('access_token', data.access);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        showMessage('¡Autenticación exitosa!', 'success');
        console.log('Redirigiendo a dashboard...');
        setTimeout(() => window.location.href = '/dashboard', 1000);
      } else {
        showMessage('Error: No se recibió token', 'error');
      }
    } else {
      showMessage(data.error || data.message || 'Error en login', 'error');
    }
  } catch (error) {
    console.error('Error en login:', error);
    showMessage('Error de conexión con el servidor', 'error');
  } finally {
    showLoading(false);
  }
}

async function handleMFA(e) {
  e.preventDefault();
  
  const username = sessionStorage.getItem('username');
  const mfaToken = document.getElementById('mfaToken').value.trim();
  
  if (!mfaToken || mfaToken.length !== 6 || isNaN(mfaToken)) {
    showMessage('El código debe ser 6 dígitos', 'error');
    return;
  }
  
  showLoading(true);
  
  try {
    console.log('Verificando MFA para:', username);
    
    const response = await fetch('/api/auth/verify-mfa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, token: mfaToken })
    });
    
    const data = await response.json();
    console.log('Respuesta MFA:', response.status, data);
    
    if (response.ok) {
      if (data.access) {
        localStorage.setItem('access_token', data.access);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        showMessage('¡Autenticación completada!', 'success');
        sessionStorage.removeItem('username');
        setTimeout(() => window.location.href = '/dashboard', 1000);
      } else {
        showMessage('Error: No se recibió token', 'error');
      }
    } else {
      showMessage(data.error || data.message || 'Código inválido', 'error');
    }
  } catch (error) {
    console.error('Error en MFA:', error);
    showMessage('Error al verificar código', 'error');
  } finally {
    showLoading(false);
  }
}

function backToLogin() {
  document.getElementById('mfaForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('messageBox').classList.add('hidden');
  document.getElementById('mfaToken').value = '';
}

function showLoading(show) {
  const btn = document.querySelector('.form-login:not(.hidden) .btn-primary, .form-mfa:not(.hidden) .btn-primary');
  const loader = document.getElementById('loadingState');
  
  if (show) {
    if (loader) loader.classList.remove('hidden');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Procesando...';
    }
  } else {
    if (loader) loader.classList.add('hidden');
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Iniciar Sesión';
    }
  }
}

function showMessage(msg, type) {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = msg;
    messageBox.className = `alert alert-${type}`;
    messageBox.classList.remove('hidden');
    
    // Auto-hide error messages after 5 seconds
    if (type === 'error') {
      setTimeout(() => messageBox.classList.add('hidden'), 5000);
    }
  }
}
