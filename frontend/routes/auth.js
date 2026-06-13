const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Middleware para verificar token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '') || 
                req.session?.access_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  
  try {
    const decoded = jwt.decode(token);
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Registro
router.post('/register', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/register/`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: 'Error en registro' }
    );
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login/`, req.body);
    
    // Si se requiere MFA
    if (response.data.mfa_required) {
      req.session.mfa_required = true;
      req.session.username = req.body.username;
      return res.json(response.data);
    }
    
    // Si login exitoso (sin MFA)
    req.session.access_token = response.data.access;
    req.session.refresh_token = response.data.refresh;
    req.session.user = response.data.user;
    
    res.json({
      success: true,
      user: response.data.user,
      access: response.data.access
    });
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: 'Error en login' }
    );
  }
});

// Verificar MFA
router.post('/verify-mfa', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/verify-mfa/`, req.body);
    
    req.session.access_token = response.data.access;
    req.session.refresh_token = response.data.refresh;
    req.session.user = response.data.user;
    req.session.mfa_required = false;
    
    res.json({
      success: true,
      user: response.data.user,
      access: response.data.access
    });
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: 'Error verificando MFA' }
    );
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error en logout' });
    }
    res.json({ message: 'Logout exitoso' });
  });
});

// Obtener perfil del usuario
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/auth/profile/`, {
      headers: { 'Authorization': `Bearer ${req.token}` }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: 'Error obteniendo perfil' }
    );
  }
});

// Solicitar activación de MFA
router.post('/request-mfa-activation', verifyToken, async (req, res) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/auth/request-mfa-activation/`,
      req.body,
      { headers: { 'Authorization': `Bearer ${req.token}` } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: 'Error solicitando MFA' }
    );
  }
});

// Confirmar activación de MFA
router.post('/confirm-mfa-activation', verifyToken, async (req, res) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/auth/confirm-mfa-activation/`,
      req.body,
      { headers: { 'Authorization': `Bearer ${req.token}` } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: 'Error confirmando MFA' }
    );
  }
});

module.exports = router;
