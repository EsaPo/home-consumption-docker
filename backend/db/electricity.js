// db/electricity.js
const express = require('express');
const router = express.Router();
const db = require('./dbconfig');

// NOTE: Table columns (mittarinvaihto, vanha_lukema) and the
// sahko_with_consumption view are created once, centrally, in dbconfig.js.
// They used to be recreated here too, which raced with dbconfig.js on startup
// and threw "view sahko_with_consumption already exists". This file now only
// defines the HTTP routes.

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const query = `
    SELECT l.*, k.kiinteisto, k.osoite, k.omistajanimi
    FROM sahko_with_consumption l
    LEFT JOIN kiinteisto k ON l.kiinteistotunnus = k.kiinteistotunnus
    ORDER BY lukemapva DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error', details: err.message });

    const transformed = rows.map(row => ({
      id:               row.id,
      kiinteistotunnus: row.kiinteistotunnus,
      kiinteisto:       row.kiinteisto,
      osoite:           row.osoite,
      omistajanimi:     row.omistajanimi,
      vuosi:            row.vuosi,
      kuukausi:         row.kuukausi,
      kuukausi_num:     row.kuukausi_num,
      lukemapva:        row.lukemapva,
      sahkolukema:      parseFloat(row.sahkolukema).toFixed(0),
      kulutus_sahko:    parseFloat(row.kulutus_sahko || 0).toFixed(0),
      mittarinvaihto:   row.mittarinvaihto || 0,
      vanha_lukema:     row.vanha_lukema,
      muuta:            row.muuta,
    }));

    res.json(transformed);
  });
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { kiinteistotunnus, vuosi, kuukausi, lukemapva,
          sahkolukema, mittarinvaihto, vanha_lukema, muuta } = req.body;

  if (!kiinteistotunnus || !vuosi || !kuukausi || !lukemapva || sahkolukema === undefined) {
    return res.status(400).json({ error: 'Pakolliset kentät puuttuvat.' });
  }

  if (mittarinvaihto && (vanha_lukema === undefined || vanha_lukema === null || vanha_lukema === '')) {
    return res.status(400).json({ error: 'Mittarinvaihdossa vanhan mittarin lukema on pakollinen.' });
  }

  db.run(
    `INSERT INTO sahko (kiinteistotunnus, vuosi, kuukausi, lukemapva,
      sahkolukema, mittarinvaihto, vanha_lukema, muuta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [kiinteistotunnus, vuosi, kuukausi, lukemapva,
     sahkolukema, mittarinvaihto ? 1 : 0,
     mittarinvaihto ? vanha_lukema : null, muuta],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM sahko WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(row);
      });
    }
  );
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { kiinteistotunnus, vuosi, kuukausi, lukemapva,
          sahkolukema, mittarinvaihto, vanha_lukema, muuta } = req.body;

  if (mittarinvaihto && (vanha_lukema === undefined || vanha_lukema === null || vanha_lukema === '')) {
    return res.status(400).json({ error: 'Mittarinvaihdossa vanhan mittarin lukema on pakollinen.' });
  }

  db.run(
    `UPDATE sahko SET
      kiinteistotunnus = ?, vuosi = ?, kuukausi = ?, lukemapva = ?,
      sahkolukema = ?, mittarinvaihto = ?, vanha_lukema = ?, muuta = ?
     WHERE id = ?`,
    [kiinteistotunnus, vuosi, kuukausi, lukemapva,
     sahkolukema, mittarinvaihto ? 1 : 0,
     mittarinvaihto ? vanha_lukema : null,
     muuta, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to update electricity data' });
      if (this.changes === 0) return res.status(404).json({ error: 'Electricity data not found' });
      db.get('SELECT * FROM sahko WHERE id = ?', [req.params.id], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Electricity updated successfully', data: row });
      });
    }
  );
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM sahko WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete electricity data' });
    if (this.changes === 0) return res.status(404).json({ error: 'Electricity data not found' });
    res.json({ message: 'Electricity data deleted successfully', id: req.params.id });
  });
});

module.exports = router;
