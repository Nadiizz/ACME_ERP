// Dashboard Authentication Check
const BACKEND_URL = 'http://localhost:8000';
const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  loadUserProfile();
  setupLogout();
});

function checkAuthentication() {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    // Redirect to login if not authenticated
    window.location.href = '/login';
    return;
  }
}

function loadUserProfile() {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    return;
  }
  
  // Get user info from frontend API (which forwards to backend)
  fetch(`${API_URL}/auth/profile`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })
  .then(response => {
    if (response.status === 401) {
      // Token expired
      logout();
      return null;
    }
    return response.json();
  })
  .then(data => {
    if (data && data.username) {
      document.getElementById('userName').textContent = `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.username;
      document.getElementById('welcomeMsg').textContent = `¡Bienvenido, ${data.first_name || data.username}!`;
      
      document.getElementById('userInfo').innerHTML = `
        <ul>
          <li><strong>Usuario:</strong> ${data.username}</li>
          <li><strong>Email:</strong> ${data.email}</li>
          <li><strong>Nombre Completo:</strong> ${data.first_name || ''} ${data.last_name || ''}</li>
          <li><strong>MFA Habilitado:</strong> ${data.mfa_enabled ? '✓ Sí' : '✗ No'}</li>
          <li><strong>Estado:</strong> ${data.is_active ? 'Activo' : 'Inactivo'}</li>
        </ul>
      `;
    }
  })
  .catch(error => {
    console.error('Error loading profile:', error);
    document.getElementById('userInfo').innerHTML = '<p>Error al cargar la información</p>';
  });
}

function setupLogout() {
  const logoutBtn = document.querySelector('.btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('temp_token');
  sessionStorage.removeItem('username');
  window.location.href = '/login';
}
