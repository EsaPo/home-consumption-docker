// property.js
const express = require('express');
const router = express.Router();
const db = require('./dbconfig');

// Get property data from server
router.get('/', (req, res) => {
    db.all('SELECT * FROM kiinteisto', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add property data to server
router.post('/', (req, res) => {
    const { kiinteisto, osoite, kiinteistotunnus, rakennusvuosi, rakennusmateriaali, pintaala, tilavuus, tontinpintaala, omistajanimi, omistajapuh, omistajasposti, muuta } = req.body;

    // Validate required fields based on NOT NULL constraints in database
    if (!osoite || !kiinteistotunnus || !omistajanimi) {
        return res.status(400).json({ error: "Missing required fields: osoite, kiinteistotunnus, and omistajanimi are required" });
    }

    const query = `
        INSERT INTO kiinteisto (kiinteisto, osoite, kiinteistotunnus, rakennusvuosi, rakennusmateriaali, pintaala, tilavuus, tontinpintaala, omistajanimi, omistajapuh, omistajasposti, muuta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [kiinteisto, osoite, kiinteistotunnus, rakennusvuosi, rakennusmateriaali, pintaala, tilavuus, tontinpintaala, omistajanimi, omistajapuh, omistajasposti, muuta], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: err.message });
        }
        db.get("SELECT * FROM kiinteisto WHERE id = ?", [this.lastID], (err, row) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json(row);
        });
    });
});

// Update property data in server
router.put('/:kiinteistotunnus', (req, res) => {
    const kiinteistotunnusParam = req.params.kiinteistotunnus;
    const { kiinteisto, osoite, kiinteistotunnus, rakennusvuosi, rakennusmateriaali, pintaala, tilavuus, tontinpintaala, omistajanimi, omistajapuh, omistajasposti, muuta } = req.body;

    // Validate required fields based on NOT NULL constraints in database
    if (!osoite || !kiinteistotunnus || !omistajanimi) {
        return res.status(400).json({ error: "Missing required fields: osoite, kiinteistotunnus, and omistajanimi are required" });
    }

    const sql = `
        UPDATE kiinteisto
        SET kiinteisto = ?, 
            osoite = ?, 
            kiinteistotunnus = ?, 
            rakennusvuosi = ?, 
            rakennusmateriaali = ?, 
            pintaala = ?, 
            tilavuus = ?, 
            tontinpintaala = ?, 
            omistajanimi = ?, 
            omistajapuh = ?, 
            omistajasposti = ?, 
            muuta = ?
        WHERE kiinteistotunnus = ?
    `;
    
    db.run(
        sql,
        [kiinteisto, osoite, kiinteistotunnus, rakennusvuosi, rakennusmateriaali, pintaala, tilavuus, tontinpintaala, omistajanimi, omistajapuh, omistajasposti, muuta, kiinteistotunnusParam],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Failed to update property record' });
            }
            if (this.changes > 0) {
                res.json({ message: 'Property record updated successfully' });
            } else {
                res.status(404).json({ error: 'Property record not found' });
            }
        }
    );
});

// Delete property data in server
router.delete('/:kiinteistotunnus', (req, res) => {
    const kiinteistotunnus = req.params.kiinteistotunnus;
    console.log("Deleting property:", kiinteistotunnus);

    if (!kiinteistotunnus) {
        return res.status(400).json({ error: "Property ID is required" });
    }

    const query = 'DELETE FROM kiinteisto WHERE kiinteistotunnus = ?';

    db.run(query, [kiinteistotunnus], function(err) {
        if (err) {
            console.error('Error executing query', err.stack);
            return res.status(500).json({ error: "Failed to delete property" });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: "Property not found" });
        }

        res.status(200).json({ message: "Property deleted successfully", deleted: { kiinteistotunnus: kiinteistotunnus } });
    });
});

module.exports = router;
