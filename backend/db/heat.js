// db/heat.js
const express = require('express');
const router = express.Router();
const db = require('./dbconfig');

// ── Ensure mittarinvaihto columns exist (safe migration) ──────────────────────
db.run(`ALTER TABLE lampo ADD COLUMN mittarinvaihto INTEGER DEFAULT 0`, () => {});
db.run(`ALTER TABLE lampo ADD COLUMN vanha_lampolukema REAL`, () => {});
db.run(`ALTER TABLE lampo ADD COLUMN vanha_virtaamalukema REAL`, () => {});

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    const query = `
        SELECT l.*, k.kiinteisto, k.osoite, k.omistajanimi
        FROM lampo_with_consumption l
        LEFT JOIN kiinteisto k ON l.kiinteistotunnus = k.kiinteistotunnus
        ORDER BY lukemapva DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });
        const transformedRows = rows.map(row => ({
            id:                  row.id,
            kiinteistotunnus:    row.kiinteistotunnus,
            kiinteisto:          row.kiinteisto,
            osoite:              row.osoite,
            omistajanimi:        row.omistajanimi,
            vuosi:               row.vuosi,
            kuukausi:            row.kuukausi,
            kuukausi_num:        row.kuukausi_num,
            lukemapva:           row.lukemapva,
            lampolukema:         parseFloat(row.lampolukema).toFixed(3),
            virtaamalukema:      parseFloat(row.virtaamalukema).toFixed(2),
            kulutus_lampo:       parseFloat(row.kulutus_lampo || 0).toFixed(3),
            kulutus_virtaama:    parseFloat(row.kulutus_virtaama || 0).toFixed(2),
            mittarinvaihto:      row.mittarinvaihto || 0,
            vanha_lampolukema:   row.vanha_lampolukema,
            vanha_virtaamalukema:row.vanha_virtaamalukema,
            muuta:               row.muuta
        }));
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
