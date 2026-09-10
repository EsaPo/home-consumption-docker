// auth.js
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
require('./db/users'); // ensure users table is created
const db = require('./db/dbconfig');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const BCRYPT_ROUNDS = 12;

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Liian monta yritystä. Yritä 15 minuutin kuluttua.' }
});

// ── Middleware: verify JWT ────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Kirjautuminen vaaditaan.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Istunto vanhentunut. Kirjaudu uudelleen.' });
    req.user = user;
    next();
  });
}

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Kaikki kentät ovat pakollisia.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Salasanan tulee olla vähintään 8 merkkiä.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Virheellinen sähköpostiosoite.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Check if this is the first user → make them admin
    db.get('SELECT COUNT(*) as count FROM users', [], async (countErr, row) => {
      if (countErr) return res.status(500).json({ error: 'Palvelinvirhe.' });

      const isAdmin = row.count === 0 ? 1 : 0;

      db.run(
        'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
        [name.trim(), email.toLowerCase().trim(), passwordHash, isAdmin],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(409).json({ error: 'Sähköpostiosoite on jo käytössä.' });
            }
            return res.status(500).json({ error: 'Rekisteröinti epäonnistui.' });
          }

          const token = jwt.sign(
            { id: this.lastID, email: email.toLowerCase().trim(), name: name.trim(), is_admin: isAdmin },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.status(201).json({
            message: isAdmin ? 'Rekisteröinti onnistui! Olet sovelluksen ensimmäinen käyttäjä ja pääkäyttäjä.' : 'Rekisteröinti onnistui!',
            token,
            user: { id: this.lastID, name: name.trim(), email: email.toLowerCase().trim(), is_admin: isAdmin }
          });
        }
      );
    });
  } catch (err) {
    res.status(500).json({ error: 'Palvelinvirhe.' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Sähköposti ja salasana vaaditaan.' });
  }

  db.get(
    'SELECT * FROM users WHERE email = ?',
    [email.toLowerCase().trim()],
    async (err, user) => {
      if (err) return res.status(500).json({ error: 'Palvelinvirhe.' });
      if (!user) return res.status(401).json({ error: 'Väärä sähköposti tai salasana.' });

      // Check account lock
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(423).json({ error: 'Tili lukittu liian monien epäonnistuneiden yritysten takia. Yritä myöhemmin.' });
      }

      const match = await bcrypt.compare(password, user.password_hash);

      if (!match) {
        const attempts = (user.failed_attempts || 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

        db.run(
          'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
          [attempts, lockUntil, user.id]
        );

        return res.status(401).json({ error: 'Väärä sähköposti tai salasana.' });
      }

      // Successful login - reset attempts
      db.run(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Kirjautuminen onnistui!',
        token,
        user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin }
      });
    }
  );
});

// ── GET /auth/verify ──────────────────────────────────────────────────────────
router.get('/verify', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, is_admin FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(401).json({ valid: false });
    res.json({ valid: true, user });
  });
});

// ── GET /auth/logout ──────────────────────────────────────────────────────────
// With JWT there's no server-side session to destroy; client just drops the token.
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Kirjauduttu ulos.' });
});


// ── GET /auth/profile ─────────────────────────────────────────────────────────
router.get('/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Käyttäjää ei löydy.' });
    res.json({ user });
  });
});

// ── PUT /auth/profile ─────────────────────────────────────────────────────────
router.put('/profile', authenticateToken, (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nimi ja sähköposti vaaditaan.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Virheellinen sähköpostiosoite.' });

  db.run('UPDATE users SET name = ?, email = ? WHERE id = ?',
    [name.trim(), email.toLowerCase().trim(), req.user.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Sähköpostiosoite on jo käytössä.' });
        return res.status(500).json({ error: 'Palvelinvirhe.' });
      }
      res.json({ message: 'Profiili päivitetty.', user: { name: name.trim(), email: email.toLowerCase().trim() } });
    }
  );
});

// ── PUT /auth/password ────────────────────────────────────────────────────────
router.put('/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Täytä kaikki kentät.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Salasanan tulee olla vähintään 8 merkkiä.' });

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Käyttäjää ei löydy.' });

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Nykyinen salasana on väärä.' });

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Palvelinvirhe.' });
      res.json({ message: 'Salasana vaihdettu.' });
    });
  });
});

// ── DELETE /auth/account ──────────────────────────────────────────────────────
router.delete('/account', authenticateToken, (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.user.id], function(err) {
    if (err) return res.status(500).json({ error: 'Palvelinvirhe.' });
    res.json({ message: 'Tili poistettu.' });
  });
});


// ── Email settings table ──────────────────────────────────────────────────────
db.run(`CREATE TABLE IF NOT EXISTS email_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  host TEXT,
  port INTEGER DEFAULT 587,
  secure INTEGER DEFAULT 0,
  user TEXT,
  pass TEXT,
  from_name TEXT DEFAULT 'Kotitalous',
  from_email TEXT,
  frontend_url TEXT DEFAULT 'http://localhost:2992',
  enabled INTEGER DEFAULT 0
)`, (err) => {
  if (!err) {
    db.run("INSERT OR IGNORE INTO email_settings (id) VALUES (1)");
  }
});

// ── Helper: send reset email ──────────────────────────────────────────────────
async function sendResetEmail(toEmail, userName, resetToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM email_settings WHERE id = 1', async (err, cfg) => {
      if (err || !cfg || !cfg.enabled || !cfg.host) {
        // Dev fallback: log link to console
        const link = `${(cfg && cfg.frontend_url) || 'http://localhost:2992'}/reset-password.html?token=${resetToken}`;
        console.log('EMAIL NOT CONFIGURED - reset link:', link);
        return resolve({ devLink: link });
      }

      try {
        const transporter = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port || 587,
          secure: cfg.secure === 1,
          auth: { user: cfg.user, pass: cfg.pass },
          tls: { rejectUnauthorized: false }
        });

        const resetLink = `${cfg.frontend_url}/reset-password.html?token=${resetToken}`;

        await transporter.sendMail({
          from: `"${cfg.from_name || 'Kotitalous'}" <${cfg.from_email || cfg.user}>`,
          to: toEmail,
          subject: 'Salasanan palautus – Kotitalous',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#1a1a2e,#0f3460);color:#fff;padding:28px;border-radius:10px 10px 0 0;text-align:center">
                <h1 style="margin:0;font-size:1.4rem">🔑 Salasanan palautus</h1>
              </div>
              <div style="background:#f8f9fa;padding:28px;border-radius:0 0 10px 10px">
                <p>Hei <strong>${userName}</strong>,</p>
                <p>Olet pyytänyt salasanan palautusta Kotitalous-sovellukseen.</p>
                <p style="text-align:center;margin:28px 0">
                  <a href="${resetLink}"
                     style="background:linear-gradient(135deg,#1a1a2e,#0f3460);color:#fff;padding:14px 32px;
                            text-decoration:none;border-radius:6px;font-weight:600;display:inline-block">
                    Palauta salasana
                  </a>
                </p>
                <p><strong>Linkki vanhenee 1 tunnin kuluttua.</strong></p>
                <p>Jos et pyytänyt tätä, voit jättää tämän viestin huomiotta.</p>
                <hr style="margin:20px 0;border:none;border-top:1px solid #ddd">
                <p style="font-size:0.8rem;color:#888">Kotitalous-sovellus</p>
              </div>
            </div>
          `
        });
        resolve({ sent: true });
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ── POST /auth/forgot-password ────────────────────────────────────────────────
router.post('/forgot-password', authLimiter, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Sähköposti vaaditaan.' });

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Palvelinvirhe.' });

    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'Jos sähköposti on rekisteröity, lähetämme palautuslinkin.' });

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    db.run('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expires, user.id], async (err2) => {
        if (err2) return res.status(500).json({ error: 'Palvelinvirhe.' });

        try {
          const result = await sendResetEmail(user.email, user.name, token);
          if (result.devLink) {
            // Dev mode: return link in response so frontend can show it
            return res.json({
              message: 'Jos sähköposti on rekisteröity, lähetämme palautuslinkin.',
              devLink: result.devLink
            });
          }
          res.json({ message: 'Jos sähköposti on rekisteröity, lähetämme palautuslinkin.' });
        } catch (e) {
          console.error('Email send failed:', e.message);
          res.status(500).json({ error: 'Sähköpostin lähetys epäonnistui.' });
        }
      }
    );
  });
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token ja salasana vaaditaan.' });
  if (password.length < 8) return res.status(400).json({ error: 'Salasanan tulee olla vähintään 8 merkkiä.' });

  db.get('SELECT * FROM users WHERE reset_token = ?', [token], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Palvelinvirhe.' });
    if (!user) return res.status(400).json({ error: 'Virheellinen tai vanhentunut palautuslinkki.' });
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Palautuslinkki on vanhentunut. Pyydä uusi.' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    db.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hash, user.id], (err2) => {
        if (err2) return res.status(500).json({ error: 'Palvelinvirhe.' });
        res.json({ message: 'Salasana vaihdettu onnistuneesti!' });
      }
    );
  });
});

// ── GET /auth/email-settings (admin only for now: any logged-in user) ─────────
router.get('/email-settings', authenticateToken, (req, res) => {
  db.get('SELECT host, port, secure, user, from_name, from_email, frontend_url, enabled FROM email_settings WHERE id = 1',
    (err, cfg) => {
      if (err) return res.status(500).json({ error: 'Palvelinvirhe.' });
      res.json({ settings: cfg || {} });
    }
  );
});

// ── PUT /auth/email-settings ──────────────────────────────────────────────────
router.put('/email-settings', authenticateToken, (req, res) => {
  const { host, port, secure, user, pass, from_name, from_email, frontend_url, enabled } = req.body;

  const query = pass
    ? 'UPDATE email_settings SET host=?,port=?,secure=?,user=?,pass=?,from_name=?,from_email=?,frontend_url=?,enabled=? WHERE id=1'
    : 'UPDATE email_settings SET host=?,port=?,secure=?,user=?,from_name=?,from_email=?,frontend_url=?,enabled=? WHERE id=1';

  const params = pass
    ? [host, port||587, secure?1:0, user, pass, from_name, from_email, frontend_url, enabled?1:0]
    : [host, port||587, secure?1:0, user, from_name, from_email, frontend_url, enabled?1:0];

  db.run(query, params, (err) => {
    if (err) return res.status(500).json({ error: 'Palvelinvirhe.' });
    res.json({ message: 'Sähköpostiasetukset tallennettu.' });
  });
});

// ── POST /auth/test-email ─────────────────────────────────────────────────────
router.post('/test-email', authenticateToken, async (req, res) => {
  db.get('SELECT * FROM email_settings WHERE id = 1', async (err, cfg) => {
    if (err || !cfg || !cfg.host) return res.status(400).json({ error: 'Sähköpostiasetuksia ei ole määritetty.' });

    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port || 587,
        secure: cfg.secure === 1,
        auth: { user: cfg.user, pass: cfg.pass },
        tls: { rejectUnauthorized: false }
      });
      await transporter.verify();

      db.get('SELECT email, name FROM users WHERE id = ?', [req.user.id], async (e, user) => {
        await transporter.sendMail({
          from: `"${cfg.from_name}" <${cfg.from_email || cfg.user}>`,
          to: user.email,
          subject: 'Testitähköposti – Kotitalous',
          html: '<p>Sähköpostiasetukset toimivat! ✅</p>'
        });
        res.json({ message: `Testitähköposti lähetetty osoitteeseen ${user.email}` });
      });
    } catch (e) {
      res.status(500).json({ error: `Yhteys epäonnistui: ${e.message}` });
    }
  });
});


// ── GET /auth/users (admin only) ─────────────────────────────────────────────
router.get('/users', authenticateToken, (req, res) => {
  db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, me) => {
    if (err || !me || !me.is_admin) return res.status(403).json({ error: 'Ei oikeuksia.' });
    db.all('SELECT id, name, email, is_admin, created_at, last_login FROM users ORDER BY id',
      [], (err2, rows) => {
        if (err2) return res.status(500).json({ error: 'Palvelinvirhe.' });
        res.json({ users: rows });
      });
  });
});

// ── PUT /auth/users/:id/role (admin only) ─────────────────────────────────────
router.put('/users/:id/role', authenticateToken, (req, res) => {
  db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, me) => {
    if (err || !me || !me.is_admin) return res.status(403).json({ error: 'Ei oikeuksia.' });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Et voi muuttaa omia oikeuksiasi.' });

    const { is_admin } = req.body;
    db.run('UPDATE users SET is_admin = ? WHERE id = ?', [is_admin ? 1 : 0, req.params.id], function(err2) {
      if (err2) return res.status(500).json({ error: 'Palvelinvirhe.' });
      if (this.changes === 0) return res.status(404).json({ error: 'Käyttäjää ei löydy.' });
      res.json({ message: `Käyttäjä ${is_admin ? 'ylennettiin pääkäyttäjäksi' : 'palautettiin peruskäyttäjäksi'}.` });
    });
  });
});

// ── DELETE /auth/users/:id (admin only) ───────────────────────────────────────
router.delete('/users/:id', authenticateToken, (req, res) => {
  db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, me) => {
    if (err || !me || !me.is_admin) return res.status(403).json({ error: 'Ei oikeuksia.' });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Et voi poistaa omaa tiliäsi täältä.' });

    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err2) {
      if (err2) return res.status(500).json({ error: 'Palvelinvirhe.' });
      if (this.changes === 0) return res.status(404).json({ error: 'Käyttäjää ei löydy.' });
      res.json({ message: 'Käyttäjä poistettu.' });
    });
  });
});

module.exports = { router, authenticateToken };
