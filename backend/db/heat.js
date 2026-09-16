// db/heat.js
const express = require('express');
const router = express.Router();
const db = require('./dbconfig');

// NOTE: Table columns (mittarinvaihto, vanha_lampolukema, vanha_virtaamalukema)
// and the lampo_with_consumption view are created once, centrally, in dbconfig.js.
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
    // actual-days-between-readings monthly figure for heat and flow.
    const query = `
        SELECT
            l.*,
            k.kiinteisto,
            k.osoite,
            k.omistajanimi,
            prev_r.lukemapva as prev_lukemapva
        FROM lampo_with_consumption l
        LEFT JOIN kiinteisto k ON l.kiinteistotunnus = k.kiinteistotunnus
        LEFT JOIN (
            SELECT l2.kiinteistotunnus, l2.vuosi, l2.kuukausi_num, l2.lukemapva
            FROM lampo l2
            INNER JOIN (
                SELECT kiinteistotunnus, vuosi, kuukausi_num, MAX(id) as latest_id
                FROM lampo GROUP BY kiinteistotunnus, vuosi, kuukausi_num
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
            const calL   = calcMonthly(row.lukemapva, row.prev_lukemapva, row.kulutus_lampo,    row.vuosi, row.kuukausi_num);
            const calV   = calcMonthly(row.lukemapva, row.prev_lukemapva, row.kulutus_virtaama, row.vuosi, row.kuukausi_num);
            const shared = calL || calV;   // days/month are identical for both metrics

            return {
                id:                  row.id,
                kiinteistotunnus:    row.kiinteistotunnus,
                kiinteisto:          row.kiinteisto,
                osoite:              row.osoite,
                omistajanimi:        row.omistajanimi,
                vuosi:               row.vuosi,
                kuukausi:            row.kuukausi,
                kuukausi_num:        row.kuukausi_num,
                lukemapva:           row.lukemapva,
                prev_lukemapva:      row.prev_lukemapva,
                lampolukema:         parseFloat(row.lampolukema).toFixed(3),
                virtaamalukema:      parseFloat(row.virtaamalukema).toFixed(2),
                kulutus_lampo:       parseFloat(row.kulutus_lampo || 0).toFixed(3),
                kulutus_virtaama:    parseFloat(row.kulutus_virtaama || 0).toFixed(2),
                mittarinvaihto:      row.mittarinvaihto || 0,
                vanha_lampolukema:   row.vanha_lampolukema,
                vanha_virtaamalukema:row.vanha_virtaamalukema,
                muuta:               row.muuta,
                calc_days_diff:           shared ? shared.daysDiff  : null,
                calc_month_days:          shared ? shared.monthDays : null,
                calc_is_exact:            shared ? shared.isExact   : null,
                calc_monthly_lampo:       calL ? calL.calculated.toFixed(3) : null,
                calc_daily_rate_lampo:    calL ? calL.dailyRate.toFixed(3)  : null,
                calc_monthly_virtaama:    calV ? calV.calculated.toFixed(2) : null,
                calc_daily_rate_virtaama: calV ? calV.dailyRate.toFixed(2)  : null,
            };
        });
        res.json(transformedRows);
    });
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
    const { kiinteistotunnus, vuosi, kuukausi, lukemapva,
            lampolukema, virtaamalukema,
            mittarinvaihto, vanha_lampolukema, vanha_virtaamalukema, muuta } = req.body;

    if (!kiinteistotunnus || !vuosi || !kuukausi || !lukemapva ||
        lampolukema === undefined || virtaamalukema === undefined) {
        return res.status(400).json({ error: 'Pakolliset kentät puuttuvat.' });
    }
    if (mittarinvaihto && (!vanha_lampolukema || !vanha_virtaamalukema)) {
        return res.status(400).json({ error: 'Mittarinvaihdossa vanhan mittarin lukemat ovat pakollisia.' });
    }

    db.run(
        `INSERT INTO lampo (kiinteistotunnus, vuosi, kuukausi, lukemapva,
            lampolukema, virtaamalukema, mittarinvaihto,
            vanha_lampolukema, vanha_virtaamalukema, muuta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [kiinteistotunnus, vuosi, kuukausi, lukemapva,
         lampolukema, virtaamalukema,
         mittarinvaihto ? 1 : 0,
         mittarinvaihto ? vanha_lampolukema : null,
         mittarinvaihto ? vanha_virtaamalukema : null,
         muuta],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT * FROM lampo WHERE id = ?', [this.lastID], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json(row);
            });
        }
    );
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
    const { kiinteistotunnus, vuosi, kuukausi, lukemapva,
            lampolukema, virtaamalukema,
            mittarinvaihto, vanha_lampolukema, vanha_virtaamalukema, muuta } = req.body;

    if (mittarinvaihto && (!vanha_lampolukema || !vanha_virtaamalukema)) {
        return res.status(400).json({ error: 'Mittarinvaihdossa vanhan mittarin lukemat ovat pakollisia.' });
    }

    db.run(
        `UPDATE lampo SET
            kiinteistotunnus = ?, vuosi = ?, kuukausi = ?, lukemapva = ?,
            lampolukema = ?, virtaamalukema = ?, mittarinvaihto = ?,
            vanha_lampolukema = ?, vanha_virtaamalukema = ?, muuta = ?
         WHERE id = ?`,
        [kiinteistotunnus, vuosi, kuukausi, lukemapva,
         lampolukema, virtaamalukema,
         mittarinvaihto ? 1 : 0,
         mittarinvaihto ? vanha_lampolukema : null,
         mittarinvaihto ? vanha_virtaamalukema : null,
         muuta, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update heat data' });
            if (this.changes === 0) return res.status(404).json({ error: 'Heat data not found' });
            db.get('SELECT * FROM lampo WHERE id = ?', [req.params.id], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: 'Heat updated successfully', data: row });
            });
        }
    );
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
    db.run('DELETE FROM lampo WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete heat data' });
        if (this.changes === 0) return res.status(404).json({ error: 'Heat data not found' });
        res.json({ message: 'Heat data deleted successfully', id: req.params.id });
    });
});

module.exports = router;
