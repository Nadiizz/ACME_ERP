// Settings Page Logic

document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  loadUserProfile();
  setupEventListeners();
});

async function checkAuthentication() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    window.location.href = '/login';
  }
}

async function loadUserProfile() {
  const token = localStorage.getItem('access_token');
  try {
    const response = await fetch('/api/auth/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const user = await response.json();
      document.getElementById('userName').textContent = user.username;
      document.getElementById('settingsUsername').value = user.username;
      document.getElementById('settingsEmail').value = user.email;
      document.getElementById('settingsFullName').value = `${user.first_name} ${user.last_name}`.trim();
      document.getElementById('currentMfaEmail').textContent = user.email;

      // Actualizar estado MFA
      updateMfaStatus(user.mfa_enabled, user.mfa_method);
    } else if (response.status === 401) {
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Error cargando perfil:', error);
  }
}

function updateMfaStatus(mfaEnabled, mfaMethod = 'email') {
  const mfaCard = document.getElementById('mfaCard');
  const mfaActivationForm = document.getElementById('mfaActivationForm');
  const mfaEnabledView = document.getElementById('mfaEnabledView');
  const mfaIcon = document.getElementById('mfaIcon');
  const mfaStatusText = document.getElementById('mfaStatusText');
  const currentMfaMethod = document.getElementById('currentMfaMethod');

  if (mfaEnabled) {
    mfaIcon.textContent = '🔒';
    mfaStatusText.textContent = '✓ Habilitado';
    mfaStatusText.className = 'status-text enabled';
    mfaActivationForm.classList.add('hidden');
    mfaEnabledView.classList.remove('hidden');
    currentMfaMethod.textContent = mfaMethod === 'email' ? '📧 Email' : '📱 SMS';
  } else {
    mfaIcon.textContent = '🔓';
    mfaStatusText.textContent = '✗ Deshabilitado';
    mfaStatusText.className = 'status-text disabled';
    mfaActivationForm.classList.remove('hidden');
    mfaEnabledView.classList.add('hidden');
  }
}

function setupEventListeners() {
  // MFA Buttons
  document.getElementById('enableMfaBtn').addEventListener('click', handleRequestMfaActivation);
  document.getElementById('confirmMfaBtn').addEventListener('click', handleConfirmMfaActivation);
  document.getElementById('cancelMfaBtn').addEventListener('click', handleCancelMfa);
  document.getElementById('resendCodeBtn').addEventListener('click', handleRequestMfaActivation);
  document.getElementById('disableMfaBtn').addEventListener('click', handleDisableMfa);

  // Other buttons
  document.getElementById('updateNameBtn').addEventListener('click', handleUpdateName);
  document.getElementById('changePasswordBtn').addEventListener('click', handleChangePassword);
  document.getElementById('logoutAllBtn').addEventListener('click', handleLogoutAll);
  document.getElementById('deleteAccountBtn').addEventListener('click', handleDeleteAccount);

  // Logout button
  document.querySelector('.btn-logout').addEventListener('click', logout);

  // MFA Verification Code input
  document.getElementById('mfaVerificationCode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
  });

  // Auto-focus next step
  document.getElementById('mfaVerificationCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.getElementById('mfaVerificationCode').value.length === 6) {
      handleConfirmMfaActivation();
    }
  });

  // Get client IP (client-side workaround)
  getClientIp();
}

async function handleRequestMfaActivation() {
  const token = localStorage.getItem('access_token');
  const mfaMethod = document.querySelector('input[name="mfaMethod"]:checked').value;

  showLoading(true, 'enableMfaBtn');

  try {
    const response = await fetch('/api/auth/request-mfa-activation/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ mfa_method: mfaMethod })
    });

    const data = await response.json();

    if (response.ok) {
      // Ocultar sección de request
      document.getElementById('mfaRequestSection').style.display = 'none';
      
      // Mostrar sección de verificación
      document.getElementById('mfaVerificationStep').style.display = 'block';
      document.getElementById('verificationEmail').textContent = `Se ha enviado un código a ${data.email}`;
      
      showMessage('✓ Código enviado a tu email. Verifica tu bandeja de entrada.', 'success');
      
      // Guardar el email para referencia
      sessionStorage.setItem('mfa_email', data.email);
      
    } else {
      showMessage(data.error || 'Error al solicitar MFA', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('Error de conexión', 'error');
  } finally {
    showLoading(false, 'enableMfaBtn');
  }
}

async function handleConfirmMfaActivation() {
  const token = localStorage.getItem('access_token');
  const verificationCode = document.getElementById('mfaVerificationCode').value.trim();
  const mfaMethod = document.querySelector('input[name="mfaMethod"]:checked').value;

  if (!verificationCode || verificationCode.length !== 6 || isNaN(verificationCode)) {
    showMessage('El código debe ser de 6 dígitos', 'error');
    return;
  }

  showLoading(true, 'confirmMfaBtn');

  try {
    const response = await fetch('/api/auth/confirm-mfa-activation/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        token: verificationCode,
        mfa_method: mfaMethod
      })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('✓ MFA activado correctamente', 'success');
      
      // Actualizar vista
      updateMfaStatus(true, mfaMethod);
      
      // Limpiar formulario
      document.getElementById('mfaVerificationCode').value = '';
      document.getElementById('mfaVerificationStep').style.display = 'none';
      document.getElementById('mfaRequestSection').style.display = 'block';
      
      // Limpiar sesión
      sessionStorage.removeItem('mfa_email');
      
      setTimeout(() => {
        loadUserProfile();
      }, 1500);
      
    } else {
      showMessage(data.error || 'Código inválido', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('Error al verificar código', 'error');
  } finally {
    showLoading(false, 'confirmMfaBtn');
  }
}

function handleCancelMfa() {
  document.getElementById('mfaVerificationCode').value = '';
  document.getElementById('mfaVerificationStep').style.display = 'none';
  document.getElementById('mfaRequestSection').style.display = 'block';
}

function handleDisableMfa() {
  if (confirm('¿Estás seguro? Disminuirá la seguridad de tu cuenta.')) {
    // TODO: Implementar endpoint para deshabilitar MFA
    showMessage('Funcionalidad pendiente', 'info');
  }
}

async function handleUpdateName() {
  const token = localStorage.getItem('access_token');
  const fullName = document.getElementById('settingsFullName').value.trim();

  if (!fullName) {
    showMessage('Ingresa tu nombre completo', 'error');
    return;
  }

  const [firstName, ...lastName] = fullName.split(' ');

  showLoading(true, 'updateNameBtn');

  try {
    // TODO: Implementar endpoint para actualizar nombre
    showMessage('Funcionalidad pendiente', 'info');
  } finally {
    showLoading(false, 'updateNameBtn');
  }
}

function handleChangePassword() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showMessage('Completa todos los campos', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage('Las contraseñas no coinciden', 'error');
    return;
  }

  if (newPassword.length < 12) {
    showMessage('La contraseña debe tener mínimo 12 caracteres', 'error');
    return;
  }

  // TODO: Implementar endpoint para cambiar contraseña
  showMessage('Funcionalidad pendiente', 'info');
}

function handleLogoutAll() {
  if (confirm('¿Estás seguro? Cerrarás todas las sesiones.')) {
    // TODO: Implementar endpoint para logout de todas las sesiones
    showMessage('Funcionalidad pendiente', 'info');
  }
}

function handleDeleteAccount() {
  if (confirm('⚠️ ¿ESTÁS COMPLETAMENTE SEGURO? Esta acción no se puede deshacer. Se eliminarán todos tus datos.')) {
    // TODO: Implementar endpoint para eliminar cuenta
    showMessage('Funcionalidad pendiente', 'info');
  }
}

function logout() {
  if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(() => {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    });
  }
}

function showLoading(show, buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  if (show) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = '⏳ Procesando...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Confirmar';
  }
}

function showMessage(msg, type) {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    messageBox.textContent = msg;
    messageBox.className = `alert alert-${type}`;
    messageBox.classList.remove('hidden');

    if (type === 'error') {
      setTimeout(() => messageBox.classList.add('hidden'), 5000);
    }
  }
}

function getClientIp() {
  // Workaround: usar un servicio externo (solo en desarrollo)
  fetch('https://api.ipify.org?format=json')
    .then(response => response.json())
    .then(data => {
      document.getElementById('currentIp').textContent = data.ip;
    })
    .catch(() => {
      document.getElementById('currentIp').textContent = 'No disponible';
    });
}
