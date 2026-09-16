// db/water.js
const express = require('express');
const router = express.Router();
const db = require('./dbconfig');

// NOTE: Table columns (mittarinvaihto, vanha_lukema) and the
// vesi_with_consumption view are created once, centrally, in dbconfig.js.
// This file only defines the HTTP routes.

// ── Helper: days in month ────────────────────────────────────────────────────
function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

// ── Helper: normalize consumption between two readings to a full month ────────
// dailyRate = consumption / (days between readings), scaled to the month's days.
function calcMonthly(currentDate, prevDate, consumption, vuosi, kuukausiNum) {
    if (!prevDate || parseFloat(consumption) <= 0) return null;

    const curr     = new Date(currentDate);
    const prev     = new Date(prevDate);
    const daysDiff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0) return null;

    const monthDays  = daysInMonth(vuosi, kuukausiNum);
    const dailyRate  = parseFloat(consumption) / daysDiff;
    const calculated = dailyRate * monthDays;

    return { daysDiff, monthDays, dailyRate, calculated, isExact: daysDiff === monthDays };
}

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    // Join the previous month's latest reading date so we can compute the
    // actual-days-between-readings monthly figure.
    const query = `
        SELECT
            l.*,
            k.kiinteisto,
            k.osoite,
            k.omistajanimi,
            prev_r.lukemapva as prev_lukemapva
        FROM vesi_with_consumption l
        LEFT JOIN kiinteisto k ON l.kiinteistotunnus = k.kiinteistotunnus
        LEFT JOIN (
            SELECT l2.kiinteistotunnus, l2.vuosi, l2.kuukausi_num, l2.lukemapva
            FROM vesi l2
            INNER JOIN (
                SELECT kiinteistotunnus, vuosi, kuukausi_num, MAX(id) as latest_id
                FROM vesi GROUP BY kiinteistotunnus, vuosi, kuukausi_num
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
        const transformedRows = rows.map(row => {
            const cal = calcMonthly(row.lukemapva, row.prev_lukemapva, row.kulutus_vesi, row.vuosi, row.kuukausi_num);

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
                vesilukema:       parseFloat(row.vesilukema).toFixed(4),
                kulutus_vesi:     parseFloat(row.kulutus_vesi || 0).toFixed(4),
                mittarinvaihto:   row.mittarinvaihto || 0,
                vanha_lukema:     row.vanha_lukema,
                muuta:            row.muuta,
                calc_monthly:     cal ? cal.calculated.toFixed(3) : null,
                calc_days_diff:   cal ? cal.daysDiff  : null,
                calc_month_days:  cal ? cal.monthDays : null,
                calc_daily_rate:  cal ? cal.dailyRate.toFixed(3) : null,
                calc_is_exact:    cal ? cal.isExact   : null,
            };
        });
        res.json(transformedRows);
    });
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
    const { kiinteistotunnus, vuosi, kuukausi, lukemapva,
            vesilukema, mittarinvaihto, vanha_lukema, muuta } = req.body;

    if (!kiinteistotunnus || !vuosi || !kuukausi || !lukemapva || vesilukema === undefined) {
        return res.status(400).json({ error: 'Pakolliset kentät puuttuvat.' });
    }
    if (mittarinvaihto && (vanha_lukema === undefined || vanha_lukema === null || vanha_lukema === '')) {
        return res.status(400).json({ error: 'Mittarinvaihdossa vanhan mittarin lukema on pakollinen.' });
    }

    db.run(
        `INSERT INTO vesi (kiinteistotunnus, vuosi, kuukausi, lukemapva,
            vesilukema, mittarinvaihto, vanha_lukema, muuta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [kiinteistotunnus, vuosi, kuukausi, lukemapva,
         vesilukema, mittarinvaihto ? 1 : 0,
         mittarinvaihto ? vanha_lukema : null, muuta],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT * FROM vesi WHERE id = ?', [this.lastID], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json(row);
            });
        }
    );
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
    const { kiinteistotunnus, vuosi, kuukausi, lukemapva,
            vesilukema, mittarinvaihto, vanha_lukema, muuta } = req.body;

    if (mittarinvaihto && (vanha_lukema === undefined || vanha_lukema === null || vanha_lukema === '')) {
        return res.status(400).json({ error: 'Mittarinvaihdossa vanhan mittarin lukema on pakollinen.' });
    }

    db.run(
        `UPDATE vesi SET
            kiinteistotunnus = ?, vuosi = ?, kuukausi = ?, lukemapva = ?,
            vesilukema = ?, mittarinvaihto = ?, vanha_lukema = ?, muuta = ?
         WHERE id = ?`,
        [kiinteistotunnus, vuosi, kuukausi, lukemapva,
         vesilukema, mittarinvaihto ? 1 : 0,
         mittarinvaihto ? vanha_lukema : null,
         muuta, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update water data' });
            if (this.changes === 0) return res.status(404).json({ error: 'Water data not found' });
            db.get('SELECT * FROM vesi WHERE id = ?', [req.params.id], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: 'Water updated successfully', data: row });
            });
        }
    );
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
    db.run('DELETE FROM vesi WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete water data' });
        if (this.changes === 0) return res.status(404).json({ error: 'Water data not found' });
        res.json({ message: 'Water data deleted successfully', id: req.params.id });
    });
});

module.exports = router;
