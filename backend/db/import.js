// db/import.js  – CSV import routes
const express = require('express');
const router  = express.Router();
const db      = require('./dbconfig');

// ── Helper: parse Finnish date "30.4.2026" → "2026-04-30" ────────────────────
function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return str;
}

// ── Helper: parse CSV text → array of objects ─────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  function parseLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  return lines.slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = parseLine(l);
      const obj  = {};
      headers.forEach((h, i) => obj[h] = vals[i] ?? '');
      return obj;
    });
}

// ── POST /import/properties ───────────────────────────────────────────────────
router.post('/properties', (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ error: 'CSV-data puuttuu.' });

  const rows = parseCsv(csvText);
  if (!rows.length) return res.status(400).json({ error: 'CSV on tyhjä tai virheellinen.' });

  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];

  const process = (i) => {
    if (i >= rows.length) {
      return res.json({ inserted, updated, skipped, errors,
        message: `Tuonti valmis: ${inserted} lisätty, ${updated} päivitetty, ${skipped} ohitettu.` });
    }

    const r = rows[i];
    const tunnus = r['Property ID'];
    if (!tunnus) { skipped++; return process(i+1); }

    const params = [
      r['Property Name']     || null,
      r['Address']           || null,
      tunnus,
      r['Building Year']     || null,
      r['Building Material'] || null,
      r['Area (m²)']         || null,
      r['Volume (m³)']       || null,
      r['Plot Area (m²)']    || null,
      r['Property Owner']    || null,
      r['Owner Phone']       || null,
      r['Owner Email']       || null,
      r['Other information'] || null,
    ];

    db.run(`INSERT INTO kiinteisto
        (kiinteisto, osoite, kiinteistotunnus, rakennusvuosi, rakennusmateriaali,
         pintaala, tilavuus, tontinpintaala, omistajanimi, omistajapuh, omistajasposti, muuta)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      params, function(err) {
        if (err && err.message.includes('UNIQUE')) {
          db.run(`UPDATE kiinteisto SET
              kiinteisto=?, osoite=?, rakennusvuosi=?, rakennusmateriaali=?,
              pintaala=?, tilavuus=?, tontinpintaala=?, omistajanimi=?,
              omistajapuh=?, omistajasposti=?, muuta=?
              WHERE kiinteistotunnus=?`,
            [params[0], params[1], params[3], params[4], params[5], params[6],
             params[7], params[8], params[9], params[10], params[11], tunnus],
            (err2) => {
              if (err2) errors.push(`Rivi ${i+2}: ${err2.message}`);
              else updated++;
              process(i+1);
            });
        } else if (err) {
          errors.push(`Rivi ${i+2}: ${err.message}`);
          process(i+1);
        } else {
          inserted++;
          process(i+1);
        }
      });
  };

  process(0);
});

// ── POST /import/heat ─────────────────────────────────────────────────────────
router.post('/heat', (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ error: 'CSV-data puuttuu.' });

  const rows = parseCsv(csvText);
  if (!rows.length) return res.status(400).json({ error: 'CSV on tyhjä tai virheellinen.' });

  let inserted = 0, skipped = 0;
  const errors = [];

  const process = (i) => {
    if (i >= rows.length) {
      return res.json({ inserted, skipped, errors,
        message: `Tuonti valmis: ${inserted} lisätty, ${skipped} ohitettu.` });
    }

    const r      = rows[i];
    const tunnus  = r['Property ID'];
    const vuosi   = parseInt(r['Year']);
    const kuukausi= r['Month'];
    const pva     = parseDate(r['Reading Date']);
    const lampo   = parseFloat(r['Heat Reading (MWh)']);
    const virtaama= parseFloat(r['Flow Reading (m³)']);

    if (!tunnus || !vuosi || !kuukausi || !pva || isNaN(lampo) || isNaN(virtaama)) {
      skipped++;
      return process(i+1);
    }

    db.run(`INSERT INTO lampo
        (kiinteistotunnus, vuosi, kuukausi, lukemapva, lampolukema, virtaamalukema, muuta)
        VALUES (?,?,?,?,?,?,?)`,
      [tunnus, vuosi, kuukausi, pva, lampo, virtaama, r['Notes'] || null],
      function(err) {
        if (err) errors.push(`Rivi ${i+2}: ${err.message}`);
        else inserted++;
        process(i+1);
      });
  };

  process(0);
});

// ── POST /import/electricity ──────────────────────────────────────────────────
router.post('/electricity', (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ error: 'CSV-data puuttuu.' });

  const rows = parseCsv(csvText);
  if (!rows.length) return res.status(400).json({ error: 'CSV on tyhjä tai virheellinen.' });

  let inserted = 0, skipped = 0;
  const errors = [];

  const process = (i) => {
    if (i >= rows.length) {
      return res.json({ inserted, skipped, errors,
        message: `Tuonti valmis: ${inserted} lisätty, ${skipped} ohitettu.` });
    }

    const r        = rows[i];
    const tunnus   = r['Property ID'];
    const vuosi    = parseInt(r['Year']);
    const kuukausi = r['Month'];
    const pva      = parseDate(r['Reading Date']);
    const sahko    = parseFloat(r['Electricity Reading (kWh)']);

    if (!tunnus || !vuosi || !kuukausi || !pva || isNaN(sahko)) {
      skipped++;
      return process(i+1);
    }

    db.run(`INSERT INTO sahko
        (kiinteistotunnus, vuosi, kuukausi, lukemapva, sahkolukema, muuta)
        VALUES (?,?,?,?,?,?)`,
      [tunnus, vuosi, kuukausi, pva, sahko, r['Notes'] || null],
      function(err) {
        if (err) errors.push(`Rivi ${i+2}: ${err.message}`);
        else inserted++;
        process(i+1);
      });
  };

  process(0);
});

// ── POST /import/water ────────────────────────────────────────────────────────
router.post('/water', (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ error: 'CSV-data puuttuu.' });

  const rows = parseCsv(csvText);
  if (!rows.length) return res.status(400).json({ error: 'CSV on tyhjä tai virheellinen.' });

  let inserted = 0, skipped = 0;
  const errors = [];

  const process = (i) => {
    if (i >= rows.length) {
      return res.json({ inserted, skipped, errors,
        message: `Tuonti valmis: ${inserted} lisätty, ${skipped} ohitettu.` });
    }

    const r        = rows[i];
    const tunnus   = r['Property ID'];
    const vuosi    = parseInt(r['Year']);
    const kuukausi = r['Month'];
    const pva      = parseDate(r['Reading Date']);
    const vesi     = parseFloat(r['Water Reading (m³)']);

    if (!tunnus || !vuosi || !kuukausi || !pva || isNaN(vesi)) {
      skipped++;
      return process(i+1);
    }

    db.run(`INSERT INTO vesi
        (kiinteistotunnus, vuosi, kuukausi, lukemapva, vesilukema, muuta)
        VALUES (?,?,?,?,?,?)`,
      [tunnus, vuosi, kuukausi, pva, vesi, r['Notes'] || null],
      function(err) {
        if (err) errors.push(`Rivi ${i+2}: ${err.message}`);
        else inserted++;
        process(i+1);
      });
  };

  process(0);
});

module.exports = router;
