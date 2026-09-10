// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs   = require('fs');

const app = express();

const { router: authRoutes, authenticateToken } = require('./auth');
const importRoutes = require('./db/import');
const propertyRoutes = require('./db/property');
const heatRoutes = require('./db/heat');
const electricityRoutes = require('./db/electricity');
const waterRoutes = require('./db/water');

// ── Security & middleware ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // allow inline scripts in the frontend
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// ── Serve frontend static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Public routes (no auth needed) ───────────────────────────────────────────
app.use('/auth', authRoutes);

// ── Protected API routes ──────────────────────────────────────────────────────
app.use('/property',     authenticateToken, propertyRoutes);
app.use('/heat',         authenticateToken, heatRoutes);
app.use('/electricity',  authenticateToken, electricityRoutes);
app.use('/water',        authenticateToken, waterRoutes);
app.use('/import',       authenticateToken, importRoutes);

// ── GET /api/instructions ─────────────────────────────────────────────────────
app.get('/api/instructions', (req, res) => {
  const filePath = path.join(__dirname, '../instructions.md');
  if (!fs.existsSync(filePath)) {
    return res.json({ content: '# Ohjeet\n\nOhjetiedostoa ei löydy. Luo tiedosto `instructions.md` sovelluksen juurikansioon.' });
  }
  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ content });
});

// ── Fallback: serve index.html for all other GET requests ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 2992;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
