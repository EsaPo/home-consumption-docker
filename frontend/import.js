// ── CSV format definitions ────────────────────────────────────────────────────
const importFormats = {
  properties: {
    title: 'Kiinteistöt',
    note: 'Voit käyttää suoraan sovelluksen "Export to CSV" -toiminnon tuottamaa tiedostoa.',
    columns: [
      { name: 'Property ID',       req: true,  desc: 'Kiinteistötunnus (esim. 245-1-550-1)' },
      { name: 'Property Name',     req: false, desc: 'Kiinteistön nimi' },
      { name: 'Property Owner',    req: true,  desc: 'Omistajan nimi' },
      { name: 'Address',           req: true,  desc: 'Osoite' },
      { name: 'Building Year',     req: false, desc: 'Rakennusvuosi' },
      { name: 'Building Material', req: false, desc: 'Rakennusmateriaali' },
      { name: 'Area (m²)',         req: false, desc: 'Pintaala neliömetreinä' },
      { name: 'Volume (m³)',       req: false, desc: 'Tilavuus kuutiometreinä' },
      { name: 'Plot Area (m²)',    req: false, desc: 'Tontinpintaala' },
      { name: 'Owner Phone',       req: false, desc: 'Omistajan puhelin' },
      { name: 'Owner Email',       req: false, desc: 'Omistajan sähköposti' },
      { name: 'Other information', req: false, desc: 'Muuta tietoa' },
    ]
  },
  heat: {
    title: 'Lämpökulutus',
    note: 'Voit käyttää suoraan sovelluksen "Export to CSV" -toiminnon tuottamaa tiedostoa.',
    columns: [
      { name: 'Property ID',           req: true,  desc: 'Kiinteistötunnus — pitää löytyä jo tietokannasta' },
      { name: 'Year',                  req: true,  desc: 'Vuosi (esim. 2026)' },
      { name: 'Month',                 req: true,  desc: 'Kuukausi suomeksi (esim. Tammi, Helmi, ...)' },
      { name: 'Reading Date',          req: true,  desc: 'Lukemapäivä muodossa d.m.yyyy tai yyyy-mm-dd' },
      { name: 'Heat Reading (MWh)',    req: true,  desc: 'Lämpömittarin lukema MWh' },
      { name: 'Flow Reading (m³)',     req: true,  desc: 'Virtaamamittarin lukema m³' },
      { name: 'Heat Consumption (MWh)',req: false, desc: 'Kulutus (lasketaan automaattisesti, ohitetaan)' },
      { name: 'Flow Consumption (m³)', req: false, desc: 'Virtaamakulutus (ohitetaan)' },
      { name: 'Notes',                 req: false, desc: 'Muistiinpanot' },
    ]
  },
  electricity: {
    title: 'Sähkökulutus',
    note: 'Voit käyttää suoraan sovelluksen "Export to CSV" -toiminnon tuottamaa tiedostoa.',
    columns: [
      { name: 'Property ID',                req: true,  desc: 'Kiinteistötunnus — pitää löytyä jo tietokannasta' },
      { name: 'Year',                       req: true,  desc: 'Vuosi (esim. 2026)' },
      { name: 'Month',                      req: true,  desc: 'Kuukausi suomeksi (esim. Tammi, Helmi, ...)' },
      { name: 'Reading Date',               req: true,  desc: 'Lukemapäivä muodossa d.m.yyyy tai yyyy-mm-dd' },
      { name: 'Electricity Reading (kWh)',  req: true,  desc: 'Sähkömittarin lukema kWh' },
      { name: 'Electricity Consumption (kWh)', req: false, desc: 'Kulutus (ohitetaan, lasketaan automaattisesti)' },
      { name: 'Notes',                      req: false, desc: 'Muistiinpanot' },
    ]
  },
  water: {
    title: 'Vesikulutus',
    note: 'Voit käyttää suoraan sovelluksen "Export to CSV" -toiminnon tuottamaa tiedostoa.',
    columns: [
      { name: 'Property ID',        req: true,  desc: 'Kiinteistötunnus — pitää löytyä jo tietokannasta' },
      { name: 'Year',               req: true,  desc: 'Vuosi (esim. 2026)' },
      { name: 'Month',              req: true,  desc: 'Kuukausi suomeksi (esim. Tammi, Helmi, ...)' },
      { name: 'Reading Date',       req: true,  desc: 'Lukemapäivä muodossa d.m.yyyy tai yyyy-mm-dd' },
      { name: 'Water Reading (m³)', req: true,  desc: 'Vesimittarin lukema m³' },
      { name: 'Water Consumption (m³)', req: false, desc: 'Kulutus (ohitetaan, lasketaan automaattisesti)' },
      { name: 'Notes',              req: false, desc: 'Muistiinpanot' },
    ]
  }
};

function toggleImportInfo() {
  const box = document.getElementById('importInfoBox');
  if (!box) return;
  if (box.style.display === 'none') {
    const fmt = importFormats[importType];
    if (!fmt) return;

    const rows = fmt.columns.map(col => `
      <tr>
        <td style="padding:3px 8px;font-family:monospace;white-space:nowrap;color:var(--accent)">${col.name}</td>
        <td style="padding:3px 8px;text-align:center">${col.req
          ? '<span style="color:var(--error);font-weight:700">✱ pakollinen</span>'
          : '<span style="color:var(--text-3)">valinnainen</span>'}</td>
        <td style="padding:3px 8px;color:var(--text-2)">${col.desc}</td>
      </tr>`).join('');

    box.innerHTML = `
      <p style="margin-bottom:8px;color:var(--text);font-weight:600">📋 ${fmt.title} — CSV-sarakkeet</p>
      <p style="margin-bottom:8px;color:var(--success);font-size:0.78rem">✅ ${fmt.note}</p>
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="padding:3px 8px;text-align:left;color:var(--text-2)">Sarake</th>
            <th style="padding:3px 8px;text-align:left;color:var(--text-2)">Vaatimus</th>
            <th style="padding:3px 8px;text-align:left;color:var(--text-2)">Kuvaus</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:8px;color:var(--text-3);font-size:0.75rem">
        💡 Kuukausiarvot: Tammi, Helmi, Maalis, Huhti, Touko, Kesä, Heinä, Elo, Syys, Loka, Marras, Joulu
      </p>`;
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}
// import.js  – frontend CSV import logic

let importType    = null;   // 'properties' | 'heat' | 'electricity' | 'water'
let importCsvText = null;   // raw CSV string from file

const importLabels = {
  properties:  'Kiinteistöt',
  heat:        'Lämpökulutus',
  electricity: 'Sähkökulutus',
  water:       'Vesikulutus',
};

// ── Open modal ────────────────────────────────────────────────────────────────
function showImportModal(type) {
  importType    = type;
  importCsvText = null;

  document.getElementById('importModalDesc').textContent =
    `Tuo ${importLabels[type] || type} -data CSV-tiedostosta.`;
  document.getElementById('importFileName').textContent  = '';
  document.getElementById('importConfirmBtn').disabled   = true;
  document.getElementById('importResult').style.display  = 'none';
  document.getElementById('importFileInput').value       = '';
  document.getElementById('importDropzone').style.borderColor = '#aaa';
  const infoBox = document.getElementById('importInfoBox');
  if (infoBox) { infoBox.style.display = 'none'; infoBox.innerHTML = ''; }

  const modal = document.getElementById('importModal');
  modal.style.display = 'block';
  setTimeout(() => modal.classList.add('show'), 10);
}

// ── Close modal ───────────────────────────────────────────────────────────────
function closeImportModal() {
  const modal = document.getElementById('importModal');
  modal.classList.remove('show');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
}

// ── File selected via input ───────────────────────────────────────────────────
function handleImportFileSelect(event) {
  const file = event.target.files[0];
  if (file) readImportFile(file);
}

// ── File dropped ──────────────────────────────────────────────────────────────
function handleImportDrop(event) {
  event.preventDefault();
  document.getElementById('importDropzone').style.borderColor = '#aaa';
  const file = event.dataTransfer.files[0];
  if (file) readImportFile(file);
}

// ── Read file as text ─────────────────────────────────────────────────────────
function readImportFile(file) {
  if (!file.name.endsWith('.csv')) {
    showImportResult('Valitse CSV-tiedosto (.csv)', false);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    importCsvText = e.target.result;
    document.getElementById('importFileName').textContent  = `✅ ${file.name}`;
    document.getElementById('importConfirmBtn').disabled   = false;
    document.getElementById('importResult').style.display  = 'none';
  };
  reader.readAsText(file, 'UTF-8');
}

// ── Send to backend ───────────────────────────────────────────────────────────
async function confirmImport() {
  if (!importCsvText || !importType) return;

  const btn = document.getElementById('importConfirmBtn');
  btn.disabled    = true;
  btn.textContent = 'Tuodaan...';

  try {
    const res  = await fetch(`/import/${importType}`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ csvText: importCsvText }),
    });
    const data = await res.json();

    if (!res.ok) {
      showImportResult(`Virhe: ${data.error}`, false);
      return;
    }

    showImportResult(data.message, true, data.errors);

    // Reload the relevant page data
    if (importType === 'properties')  property.loadProperties();
    else if (importType === 'heat')   heat.loadHeatData();
    else if (importType === 'electricity') electricity.loadElectricityData();
    else if (importType === 'water')  water.loadWaterData();

  } catch {
    showImportResult('Verkkovirhe.', false);
  } finally {
    btn.disabled    = false;
    btn.textContent = '⬆️ Tuo data';
  }
}

// ── Show result inside modal ──────────────────────────────────────────────────
function showImportResult(msg, success, errors) {
  const resultDiv = document.getElementById('importResult');
  const textDiv   = document.getElementById('importResultText');
  const errDiv    = document.getElementById('importErrors');

  resultDiv.style.display = 'block';
  textDiv.textContent     = msg;
  textDiv.style.background = success ? '#e8f8e8' : '#fce8e8';
  textDiv.style.color      = success ? '#27ae60' : '#c0392b';
  textDiv.style.border     = success ? '1px solid #c3e6cb' : '1px solid #f5c6cb';

  if (errors && errors.length) {
    errDiv.innerHTML = errors.map(e => `<div>⚠️ ${e}</div>`).join('');
  } else {
    errDiv.innerHTML = '';
  }
}

// Close import modal on outside click
window.addEventListener('click', e => {
  const modal = document.getElementById('importModal');
  if (modal && e.target === modal) closeImportModal();
});
