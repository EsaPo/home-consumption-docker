// db/water.js
const express = require('express');
const router = express.Router();
const db = require('./dbconfig');

// ── Ensure mittarinvaihto columns exist (safe migration) ──────────────────────
db.run(`ALTER TABLE vesi ADD COLUMN mittarinvaihto INTEGER DEFAULT 0`, () => {});
db.run(`ALTER TABLE vesi ADD COLUMN vanha_lukema REAL`, () => {});

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    const query = `
        SELECT l.*, k.kiinteisto, k.osoite, k.omistajanimi
        FROM vesi_with_consumption l
        LEFT JOIN kiinteisto k ON l.kiinteistotunnus = k.kiinteistotunnus
        ORDER BY lukemapva DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });
        const transformedRows = rows.map(row => ({
            id:               row.id,
            kiinteistotunnus: row.kiinteistotunnus,
            kiinteisto:       row.kiinteisto,
            osoite:           row.osoite,
            omistajanimi:     row.omistajanimi,
            vuosi:            row.vuosi,
            kuukausi:         row.kuukausi,
            kuukausi_num:     row.kuukausi_num,
            lukemapva:        row.lukemapva,
            vesilukema:       parseFloat(row.vesilukema).toFixed(4),
            kulutus_vesi:     parseFloat(row.kulutus_vesi || 0).toFixed(4),
            mittarinvaihto:   row.mittarinvaihto || 0,
            vanha_lukema:     row.vanha_lukema,
            muuta:            row.muuta
        }));
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
