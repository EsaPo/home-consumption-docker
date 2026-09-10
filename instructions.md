# Kotitalous - Käyttöohjeet

## Yleistä

Kotitalous on kiinteistöjen kulutusseurantasovellus. Sillä voit seurata kiinteistöjesi sähkö-, lämpö- ja vesikulutusta kuukausittain.

---

## Kiinteistöt

- Lisää kiinteistö **Add New Property** -napilla
- Jokaisella kiinteistöllä on yksilöllinen kiinteistötunnus
- Kiinteistö pitää lisätä ensin ennen kuin voit lisätä kulutuslukemat

---

## Kulutuslukemat

### Lukeman lisääminen

1. Valitse kiinteistö pudotusvalikosta
2. Syötä vuosi ja kuukausi
3. Syötä lukemapäivä
4. Syötä mittarilukema
5. Tallenna

### Kulutuksen laskenta

Kulutus lasketaan automaattisesti:
```
Kulutus = tämän kuun lukema - edellisen kuun lukema
```

### Mittarinvaihto

Jos mittari on vaihdettu, rastita **🔄 Mittarinvaihto tällä lukemalla** ja syötä vanhan mittarin viimeinen lukema. Kulutus lasketaan oikein:
```
Kulutus = (vanha lukema - edellinen kuukausi) + uuden mittarin lukema
```

---

## CSV-tuonti ja -vienti

- **Export to CSV** — vie kaikki data CSV-tiedostoon
- **Import CSV** — tuo data CSV-tiedostosta
- Käytä aina sovelluksen omaa export-formaattia tuonnissa
- Kiinteistöt pitää tuoda ennen kulutuslukemat

---

## Asetukset

### Profiili
Voit muuttaa nimeäsi ja sähköpostiosoitettasi.

### Salasana
Vaihda salasana syöttämällä nykyinen ja uusi salasana.

### Sähköpostiasetukset
Määritä SMTP-palvelin salasanan palautusta varten.

### Käyttäjähallinta (pääkäyttäjä)
Ensimmäinen rekisteröitynyt käyttäjä on automaattisesti pääkäyttäjä. Pääkäyttäjä voi:
- Korottaa muita käyttäjiä pääkäyttäjiksi
- Poistaa käyttäjiä

---

## Teema

Vaihda vaalean ja tumman teeman välillä navigaatiopalkin 🌙/☀️ -napilla.

---

*Päivitetty: 2026*
