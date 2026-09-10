//dbconfig.js - Fixed version
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
// Support pkg, Docker and normal Node.js
const dbPath = process.pkg
  ? path.join(path.dirname(process.execPath), 'property.db')
  : process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, 'property.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the property database.');
  db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
    if (pragmaErr) {
      console.error('Failed to enable foreign keys:', pragmaErr.message);
    } else {
      console.log('Foreign keys enabled.');
    }
  });
  
  // Create kiinteisto table first (referenced table)
  db.run(`CREATE TABLE IF NOT EXISTS kiinteisto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kiinteisto TEXT,
    osoite TEXT NOT NULL,
    kiinteistotunnus TEXT UNIQUE NOT NULL,
    rakennusvuosi INTEGER,
    rakennusmateriaali TEXT,
    pintaala REAL,
    tilavuus REAL,
    tontinpintaala REAL,
    omistajanimi TEXT NOT NULL,
    omistajapuh TEXT,
    omistajasposti TEXT,
    muuta TEXT
  )`, (err) => {
    if (err) {
      console.error('Error creating kiinteisto table:', err.message);
    }
  });

  // Create lampo table after kiinteisto table (referencing table)
  db.run(`CREATE TABLE IF NOT EXISTS lampo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kiinteistotunnus TEXT NOT NULL,
      vuosi INTEGER NOT NULL,
      kuukausi TEXT NOT NULL,
      lukemapva TEXT NOT NULL,
      lampolukema DECIMAL(7,4) NOT NULL,
      virtaamalukema DECIMAL(6,2) NOT NULL,
      muuta TEXT,
      kuukausi_num INTEGER GENERATED ALWAYS AS (
           CASE
               WHEN kuukausi = 'Tammi' THEN 1
               WHEN kuukausi = 'Helmi' THEN 2
               WHEN kuukausi = 'Maalis' THEN 3
               WHEN kuukausi = 'Huhti' THEN 4
               WHEN kuukausi = 'Touko' THEN 5
               WHEN kuukausi = 'Kesä' THEN 6
               WHEN kuukausi = 'Heinä' THEN 7
               WHEN kuukausi = 'Elo' THEN 8
               WHEN kuukausi = 'Syys' THEN 9
               WHEN kuukausi = 'Loka' THEN 10
               WHEN kuukausi = 'Marras' THEN 11
               WHEN kuukausi = 'Joulu' THEN 12
           END
      ) STORED,
      FOREIGN KEY (kiinteistotunnus) REFERENCES kiinteisto(kiinteistotunnus)
  )`, (err) => {
    if (err) {
      console.error('Error creating lampo table:', err.message);
    } else {
      // Add mittarinvaihto columns if not exists (safe migration)
      db.run('ALTER TABLE lampo ADD COLUMN mittarinvaihto INTEGER DEFAULT 0', () => {});
      db.run('ALTER TABLE lampo ADD COLUMN vanha_lampolukema REAL', () => {});
      db.run('ALTER TABLE lampo ADD COLUMN vanha_virtaamalukema REAL', () => {});
      // Drop existing view first
      db.run('DROP VIEW IF EXISTS lampo_with_consumption', () => {
        // Create improved view that handles multiple readings per month
        db.run(`
          CREATE VIEW lampo_with_consumption AS
          SELECT 
            current.*,
            CASE
              WHEN current.mittarinvaihto = 1 AND current.vanha_lampolukema IS NOT NULL
                THEN COALESCE(current.vanha_lampolukema - prev.lampolukema, 0) + current.lampolukema
              ELSE COALESCE(current.lampolukema - prev.lampolukema, 0)
            END as kulutus_lampo,
            CASE
              WHEN current.mittarinvaihto = 1 AND current.vanha_virtaamalukema IS NOT NULL
                THEN COALESCE(current.vanha_virtaamalukema - prev.virtaamalukema, 0) + current.virtaamalukema
              ELSE COALESCE(current.virtaamalukema - prev.virtaamalukema, 0)
            END as kulutus_virtaama
          FROM (
            -- Get the latest reading for each property/month combination
            SELECT l.*
            FROM lampo l
            INNER JOIN (
              SELECT 
                kiinteistotunnus, 
                vuosi, 
                kuukausi_num, 
                MAX(lukemapva) as latest_date,
                MAX(id) as latest_id
              FROM lampo 
              GROUP BY kiinteistotunnus, vuosi, kuukausi_num
            ) latest ON (
              l.kiinteistotunnus = latest.kiinteistotunnus 
              AND l.vuosi = latest.vuosi 
              AND l.kuukausi_num = latest.kuukausi_num 
              AND l.id = latest.latest_id
            )
          ) current
          LEFT JOIN (
            -- Get the previous month's latest reading
            SELECT l.*
            FROM lampo l
            INNER JOIN (
              SELECT 
                kiinteistotunnus, 
                vuosi, 
                kuukausi_num, 
                MAX(lukemapva) as latest_date,
                MAX(id) as latest_id
              FROM lampo 
              GROUP BY kiinteistotunnus, vuosi, kuukausi_num
            ) latest ON (
              l.kiinteistotunnus = latest.kiinteistotunnus 
              AND l.vuosi = latest.vuosi 
              AND l.kuukausi_num = latest.kuukausi_num 
              AND l.id = latest.latest_id
            )
          ) prev ON (
            current.kiinteistotunnus = prev.kiinteistotunnus 
            AND (
              -- Same year, current month is next month
              (current.vuosi = prev.vuosi AND current.kuukausi_num = prev.kuukausi_num + 1) OR
              -- Next year, current is January and previous is December
              (current.vuosi = prev.vuosi + 1 AND current.kuukausi_num = 1 AND prev.kuukausi_num = 12)
            )
          )
          ORDER BY current.kiinteistotunnus, current.vuosi, current.kuukausi_num
        `, (viewErr) => {
          if (viewErr) {
            console.error('Error creating improved heat consumption view:', viewErr.message);
          } else {
            console.log('Improved heat consumption view created successfully.');
          }
        });
      });
    }
  });

  // Create sahko table after kiinteisto table (referencing table)
  db.run(`CREATE TABLE IF NOT EXISTS sahko (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kiinteistotunnus TEXT NOT NULL,
      vuosi INTEGER NOT NULL,
      kuukausi TEXT NOT NULL,
      lukemapva TEXT NOT NULL,
      sahkolukema REAL NOT NULL,
      muuta TEXT,
      kuukausi_num INTEGER GENERATED ALWAYS AS (
           CASE
               WHEN kuukausi = 'Tammi' THEN 1
               WHEN kuukausi = 'Helmi' THEN 2
               WHEN kuukausi = 'Maalis' THEN 3
               WHEN kuukausi = 'Huhti' THEN 4
               WHEN kuukausi = 'Touko' THEN 5
               WHEN kuukausi = 'Kesä' THEN 6
               WHEN kuukausi = 'Heinä' THEN 7
               WHEN kuukausi = 'Elo' THEN 8
               WHEN kuukausi = 'Syys' THEN 9
               WHEN kuukausi = 'Loka' THEN 10
               WHEN kuukausi = 'Marras' THEN 11
               WHEN kuukausi = 'Joulu' THEN 12
           END
      ) STORED,
      FOREIGN KEY (kiinteistotunnus) REFERENCES kiinteisto(kiinteistotunnus)
  )`, (err) => {
    if (err) {
      console.error('Error creating sahko table:', err.message);
    } else {
      // Add mittarinvaihto columns if not exists (safe migration)
      db.run('ALTER TABLE sahko ADD COLUMN mittarinvaihto INTEGER DEFAULT 0', () => {});
      db.run('ALTER TABLE sahko ADD COLUMN vanha_lukema REAL', () => {});
      // Drop existing view first
      db.run('DROP VIEW IF EXISTS sahko_with_consumption', () => {
        // Create improved view that handles multiple readings per month
        db.run(`
          CREATE VIEW sahko_with_consumption AS
          SELECT 
            current.*,
            CASE
              WHEN current.mittarinvaihto = 1 AND current.vanha_lukema IS NOT NULL
                THEN COALESCE(current.vanha_lukema - prev.sahkolukema, 0) + current.sahkolukema
              ELSE COALESCE(current.sahkolukema - prev.sahkolukema, 0)
            END as kulutus_sahko
          FROM (
            -- Get the latest reading for each property/month combination
            SELECT l.*
            FROM sahko l
            INNER JOIN (
              SELECT 
                kiinteistotunnus, 
                vuosi, 
                kuukausi_num, 
                MAX(lukemapva) as latest_date,
                MAX(id) as latest_id
              FROM sahko 
              GROUP BY kiinteistotunnus, vuosi, kuukausi_num
            ) latest ON (
              l.kiinteistotunnus = latest.kiinteistotunnus 
              AND l.vuosi = latest.vuosi 
              AND l.kuukausi_num = latest.kuukausi_num 
              AND l.id = latest.latest_id
            )
          ) current
          LEFT JOIN (
            -- Get the previous month's latest reading
            SELECT l.*
            FROM sahko l
            INNER JOIN (
              SELECT 
                kiinteistotunnus, 
                vuosi, 
                kuukausi_num, 
                MAX(lukemapva) as latest_date,
                MAX(id) as latest_id
              FROM sahko 
              GROUP BY kiinteistotunnus, vuosi, kuukausi_num
            ) latest ON (
              l.kiinteistotunnus = latest.kiinteistotunnus 
              AND l.vuosi = latest.vuosi 
              AND l.kuukausi_num = latest.kuukausi_num 
              AND l.id = latest.latest_id
            )
          ) prev ON (
            current.kiinteistotunnus = prev.kiinteistotunnus 
            AND (
              -- Same year, current month is next month
              (current.vuosi = prev.vuosi AND current.kuukausi_num = prev.kuukausi_num + 1) OR
              -- Next year, current is January and previous is December
              (current.vuosi = prev.vuosi + 1 AND current.kuukausi_num = 1 AND prev.kuukausi_num = 12)
            )
          )
          ORDER BY current.kiinteistotunnus, current.vuosi, current.kuukausi_num
        `, (viewErr) => {
          if (viewErr) {
            console.error('Error creating improved electricity consumption view:', viewErr.message);
          } else {
            console.log('Improved electricity consumption view created successfully.');
          }
        });
      });
    }
  });

  // Create vesi table after kiinteisto table (referencing table)
  db.run(`CREATE TABLE IF NOT EXISTS vesi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kiinteistotunnus TEXT NOT NULL,
      vuosi INTEGER NOT NULL,
      kuukausi TEXT NOT NULL,
      lukemapva TEXT NOT NULL,
      vesilukema DECIMAL(8,4) NOT NULL,
      muuta TEXT,
      kuukausi_num INTEGER GENERATED ALWAYS AS (
           CASE
               WHEN kuukausi = 'Tammi' THEN 1
               WHEN kuukausi = 'Helmi' THEN 2
               WHEN kuukausi = 'Maalis' THEN 3
               WHEN kuukausi = 'Huhti' THEN 4
               WHEN kuukausi = 'Touko' THEN 5
               WHEN kuukausi = 'Kesä' THEN 6
               WHEN kuukausi = 'Heinä' THEN 7
               WHEN kuukausi = 'Elo' THEN 8
               WHEN kuukausi = 'Syys' THEN 9
               WHEN kuukausi = 'Loka' THEN 10
               WHEN kuukausi = 'Marras' THEN 11
               WHEN kuukausi = 'Joulu' THEN 12
           END
      ) STORED,
      FOREIGN KEY (kiinteistotunnus) REFERENCES kiinteisto(kiinteistotunnus)
  )`, (err) => {
    if (err) {
      console.error('Error creating vesi table:', err.message);
    } else {
      // Add mittarinvaihto columns if not exists (safe migration)
      db.run('ALTER TABLE vesi ADD COLUMN mittarinvaihto INTEGER DEFAULT 0', () => {});
      db.run('ALTER TABLE vesi ADD COLUMN vanha_lukema REAL', () => {});
      // Drop existing view first
      db.run('DROP VIEW IF EXISTS vesi_with_consumption', () => {
        // Create improved view that handles multiple readings per month
        db.run(`
          CREATE VIEW vesi_with_consumption AS
          SELECT 
            current.*,
            CASE
              WHEN current.mittarinvaihto = 1 AND current.vanha_lukema IS NOT NULL
                THEN COALESCE(current.vanha_lukema - prev.vesilukema, 0) + current.vesilukema
              ELSE COALESCE(current.vesilukema - prev.vesilukema, 0)
            END as kulutus_vesi
          FROM (
            -- Get the latest reading for each property/month combination
            SELECT l.*
            FROM vesi l
            INNER JOIN (
              SELECT 
                kiinteistotunnus, 
                vuosi, 
                kuukausi_num, 
                MAX(lukemapva) as latest_date,
                MAX(id) as latest_id
              FROM vesi 
              GROUP BY kiinteistotunnus, vuosi, kuukausi_num
            ) latest ON (
              l.kiinteistotunnus = latest.kiinteistotunnus 
              AND l.vuosi = latest.vuosi 
              AND l.kuukausi_num = latest.kuukausi_num 
              AND l.id = latest.latest_id
            )
          ) current
          LEFT JOIN (
            -- Get the previous month's latest reading
            SELECT l.*
            FROM vesi l
            INNER JOIN (
              SELECT 
                kiinteistotunnus, 
                vuosi, 
                kuukausi_num, 
                MAX(lukemapva) as latest_date,
                MAX(id) as latest_id
              FROM vesi 
              GROUP BY kiinteistotunnus, vuosi, kuukausi_num
            ) latest ON (
              l.kiinteistotunnus = latest.kiinteistotunnus 
              AND l.vuosi = latest.vuosi 
              AND l.kuukausi_num = latest.kuukausi_num 
              AND l.id = latest.latest_id
            )
          ) prev ON (
            current.kiinteistotunnus = prev.kiinteistotunnus 
            AND (
              -- Same year, current month is next month
              (current.vuosi = prev.vuosi AND current.kuukausi_num = prev.kuukausi_num + 1) OR
              -- Next year, current is January and previous is December
              (current.vuosi = prev.vuosi + 1 AND current.kuukausi_num = 1 AND prev.kuukausi_num = 12)
            )
          )
          ORDER BY current.kiinteistotunnus, current.vuosi, current.kuukausi_num
        `, (viewErr) => {
          if (viewErr) {
            console.error('Error creating improved water consumption view:', viewErr.message);
          } else {
            console.log('Improved water consumption view created successfully.');
          }
        });
      });
    }
  });
});

module.exports = db;
