// db/electricity.js
const express = require('express');
const router = express.Router();
const db = require('./dbconfig');

// NOTE: Table columns (mittarinvaihto, vanha_lukema) and the
// sahko_with_consumption view are created once, centrally, in dbconfig.js.
// They used to be recreated here too, which raced with dbconfig.js on startup
// and threw "view sahko_with_consumption already exists". This file now only
// defines the HTTP routes.

// ── Helper: days in month ────────────────────────────────────────────────────
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// ── Helper: calculate monthly consumption based on actual reading dates ───────
// Normalizes the consumption between two consecutive readings to a full calendar
// month: dailyRate = consumption / (days between readings), scaled to month days.
function calcMonthly(currentDate, prevDate, consumption, vuosi, kuukausiNum) {
  if (!prevDate || parseFloat(consumption) <= 0) return null;

  const curr     = new Date(currentDate);
  const prev     = new Date(prevDate);
  const daysDiff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 0) return null;

  const monthDays  = daysInMonth(vuosi, kuukausiNum);
  const dailyRate  = parseFloat(consumption) / daysDiff;
  const calculated = Math.round(dailyRate * monthDays);

  return {
    calculated,
    daysDiff,
    monthDays,
    dailyRate: dailyRate.toFixed(1),
    isExact: daysDiff === monthDays
  };
}

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  // Fetch current readings with the previous month's reading date joined in,
  // so we can compute the actual-days-between-readings monthly figure.
  const query = `
    SELECT
      l.*,
      k.kiinteisto,
      k.osoite,
      k.omistajanimi,
      prev_r.lukemapva as prev_lukemapva
    FROM sahko_with_consumption l
    LEFT JOIN kiinteisto k ON l.kiinteistotunnus = k.kiinteistotunnus
    LEFT JOIN (
      SELECT l2.kiinteistotunnus, l2.vuosi, l2.kuukausi_num, l2.lukemapva
      FROM sahko l2
      INNER JOIN (
        SELECT kiinteistotunnus, vuosi, kuukausi_num, MAX(id) as latest_id
        FROM sahko GROUP BY kiinteistotunnus, vuosi, kuukausi_num
      ) latest ON (
        l2.kiinteistotunnus = latest.kiinteistotunnus
        AND l2.vuosi = latest.vuosi
        AND l2.kuukausi_num = latest.kuukausi_num
        AND l2.id = latest.latest_id
      )
    ) prev_r ON (
      l.kiinteistotunnus = prev_r.kiinteistotunnus AND (
        (l.vuosi = prev_r.vuosi AND l.kuukausi_num = prev_r.kuukausi_num + 1) OR
        (l.vuosi = prev_r.vuosi + 1 AND l.kuukausi_num = 1 AND prev_r.kuukausi_num = 12)
      )
    )
    ORDER BY l.lukemapva DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error', details: err.message });

    const transformed = rows.map(row => {
      const cal = calcMonthly(
        row.lukemapva,
        row.prev_lukemapva,
        row.kulutus_sahko,
        row.vuosi,
        row.kuukausi_num
      );

      return {
        id:               row.id,
        kiinteistotunnus: row.kiinteistotunnus,
        kiinteisto:       row.kiinteisto,
        osoite:           row.osoite,
        omistajanimi:     row.omistajanimi,
        vuosi:            row.vuosi,
        kuukausi:         row.kuukausi,
        kuukausi_num:     row.kuukausi_num,
        lukemapva:        row.lukemapva,
        prev_lukemapva:   row.prev_lukemapva,
        sahkolukema:      parseFloat(row.sahkolukema).toFixed(0),
        kulutus_sahko:    parseFloat(row.kulutus_sahko || 0).toFixed(0),
        mittarinvaihto:   row.mittarinvaihto || 0,
        vanha_lukema:     row.vanha_lukema,
        muuta:            row.muuta,
        calc_monthly:     cal ? cal.calculated : null,
        calc_days_diff:   cal ? cal.daysDiff   : null,
        calc_month_days:  cal ? cal.monthDays  : null,
        calc_daily_rate:  cal ? cal.dailyRate  : null,
        calc_is_exact:    cal ? cal.isExact    : null,
      };
    });

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
