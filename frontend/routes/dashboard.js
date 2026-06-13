const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Middleware para verificar autenticación
const isAuthenticated = (req, res, next) => {
  const token = req.session?.access_token;
  
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  try {
    const decoded = jwt.decode(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Home del dashboard
router.get('/home', isAuthenticated, (req, res) => {
  res.json({
    message: 'Bienvenido al Dashboard de ACME ERP',
    user: req.user,
    modules: [
      'Inventario',
      'Ventas',
      'Facturación',
      'Reportes'
    ]
  });
});

module.exports = router;
