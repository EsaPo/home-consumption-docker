# Omakotitalon kulutusseuranta - Docker versio

Tämä sovellus on suunniteltu tavallisille kodeille ja sillä voi seurata sähkön, veden ja kaukolämmön kulutusta. Sovelluksella voi seurata kulutuksia graafeista kunhan vain ensin lisää kuukaisittaiset kulutuslukemat sovellukseen. Tämä sovellus käyttää vanhanaikaista tapaa seurata kulutuksia ja toimiakseen sinun täytyy lukea mittarit kuukausittain ja lisätä lukemat sovellukseen.

Ohjelma on luotu siten, että siinä on node.js backend, joka tallentaa datan SQLite tietokantaan. Frontend on luotu html-kielellä ja se kommunikoi node.js backendin kanssa.

### Asennus
Aluksi täytyy asentaa docker ja siihen docker compose plugin. Seuraavaksi kloonataan tämä repo ja mennään tämän hakemiston juureen. Seuraavaksi muokataan `env.template` tiedostoa ja tallennetaan se `.env` nimellä backend -hakemistoon. Lopuksi ajetaan komento `docker compose up -d` ja odotetaan, että tarvittavat tiedostot ovat asentuneet.

Asennuksen jälkeen mennään selaimella osoitteeseen http://127.0.0.1:2992 tai siihen IP-osoitteeseen mille laitteelle sovellus on asennettu.

### Aloitus
Aluksi luodaan sovellukseen käyttäjätunnus ja asetetaan salasana. Tämä ensimmäinen käyttäjä on ns. admin-käyttäjä, jolla on admin-oikeudet. Ensimmäisellä kirjautumiskerralla sovellus kysyy, että mitä kulutuslajeja haluat seurata, vaihtoehtoina lämmitys (kaukolämpö), sähkö tai vesi. Näitä asetuksia voi halutessaan muuttaa myöhemmin asetukset-menusta. Kirjautumisen jälkeen pitää aluksi luoda kiinteistö ennen kuin voi lisätä kulutuslukemia. Enemmän ohjeita löytyy ohje-menusta.

---- 

# Home consumption app - Docker version

This app is designed for homes and allows you to track your electricity, heat and water consumption. You can also see monthly consumption graphs as you add up your readings month by month. This is an old-fashioned way of tracking your home's consumption and you need to read the meter monthly and add data to this app.

This app is created so that there is node.js backend by which your data is saved to SQLite database. Frontend is pure html file which communicate with this node.js backend.

### How to install
First you have to install docker and docker compose plugin to your system. Next clone this repo and go to root folder. Then you have to modify `env.template` file and save it to backend folder with name `.env`. Next run docker compose command `docker compose up -d` and wait app to be installed.

After that app is ready to use and you can go to web browser and open the ip address http://127.0.0.1:2992 or IP-address where this app is installed.

### How to start
In first login you have to create username and set password. This first user is so-called admin user. In the first run app asks what consumptions you want to track, options are heat (district heating), electricity and water. You can change these options later in the settings menu. After first login you have to first create property before you can start add meter readings. Look for more in the ìnstructions tab.
