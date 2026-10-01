# Room Booking API

Backend REST API telpu rezervēšanai, izstrādāts ar Laravel un MySQL 1. nedēļas programmēšanas prakses ietvaros. Sistēma ļauj apskatīt uzņēmuma telpas un to dienas grafiku, kā arī izveidot, rediģēt un dzēst rezervācijas — nodrošinot, ka viena telpa vienlaicīgi netiek rezervēta vairākiem cilvēkiem un rezervāciju laiki nepārklājas.

Projektā iekļauta arī vienkārša frontend lapa (`public/rooms.html`), kas ļauj testēt un demonstrēt API darbību tieši pārlūkā.

---

## Satura rādītājs

1. [Tehnoloģijas](#tehnoloģijas)
2. [Uzstādīšana](#uzstādīšana)
3. [Datu modelis](#datu-modelis)
4. [Biznesa loģika](#biznesa-loģika)
5. [API endpointi](#api-endpointi)
6. [Drošība](#drošība)
7. [Testa dati (seeders)](#testa-dati-seeders)
8. [Frontend lapa](#frontend-lapa)
9. [Tehniskie pieņēmumi](#tehniskie-pieņēmumi)

---

## Tehnoloģijas

- PHP 8.2+
- Laravel 13
- MySQL
- Git

---

## Uzstādīšana

1. Klonēt repozitoriju un ieiet projekta mapē:
   ```bash
   git clone <repo-url>
   cd Room-Booking-API
   ```

2. Instalēt PHP atkarības:
   ```bash
   composer install
   ```

3. Izveidot `.env` failu no parauga un ģenerēt aplikācijas atslēgu:
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. `.env` failā iestatīt MySQL datubāzes savienojumu un API atslēgu:
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=room_booking
   DB_USERNAME=root
   DB_PASSWORD=

   API_KEY=izveido-savu-garu-nejaušu-virkni
   ```
   Datubāzei `room_booking` jābūt izveidotai iepriekš (piem., ar phpMyAdmin vai HeidiSQL).

5. Palaist migrācijas un aizpildīt datubāzi ar testa datiem:
   ```bash
   php artisan migrate:fresh --seed
   ```

6. Notīrīt config kešatmiņu (lai `API_KEY` tiktu ielasīts) un palaist serveri:
   ```bash
   php artisan config:clear
   php artisan serve
   ```

Pēc tam:
- API pieejams: `http://127.0.0.1:8000/api`
- Frontend lapa: `http://127.0.0.1:8000/rooms.html` (arī `http://127.0.0.1:8000/` novirza uz to pašu adresi)

---

## Datu modelis

**rooms**

| Lauks | Nozīme |
|---|---|
| `id` | primārā atslēga |
| `name` | telpas nosaukums |
| `capacity` | maksimālais cilvēku skaits |
| `location` | atrašanās vieta |
| `is_active` | vai telpa ir aktīva |
| `created_at` / `updated_at` | laika zīmogi |

**bookings**

| Lauks | Nozīme |
|---|---|
| `id` | primārā atslēga |
| `room_id` | ārējā atslēga uz `rooms` |
| `title` | rezervācijas nosaukums |
| `booked_by` | rezervācijas veicējs |
| `starts_at` / `ends_at` | sākuma un beigu datums/laiks |
| `created_at` / `updated_at` | laika zīmogi |

**Attiecība:** viena telpa var saturēt vairākas rezervācijas (`Room hasMany Booking`, `Booking belongsTo Room`).

---

## Biznesa loģika

- **Rezervāciju laiki nedrīkst pārklāties.** Divi periodi pārklājas, ja esošais sākas pirms jaunā beigām UN beidzas pēc jaunā sākuma. Salīdzinājumā izmantoti stingri `<` un `>`, tāpēc rezervācijas var sekot cita citai bez pārtraukuma (piem., 10:00–11:00 un uzreiz pēc tam 11:00–12:00 ir atļautas).
- **Rezervācijas iespējamas tikai no 07:00 līdz 21:00.** Ja sākums ir pirms 07:00 vai beigas pēc 21:00, pieprasījums tiek noraidīts ar validācijas kļūdu.
- Pārklāšanās pārbaude notiek datubāzes transakcijā ar rindas bloķēšanu (`lockForUpdate`), lai divi vienlaicīgi pieprasījumi nevarētu abi izturēt pārbaudi un izveidot pārklājošās rezervācijas.
- Rezervāciju var izveidot tikai aktīvai telpai (`is_active = true`).

---

## API endpointi

Visi endpointi saņem un atgriež JSON un pieprasa API atslēgas autentifikāciju (skat. [Drošība](#drošība)). Pieprasījumiem jāsūta galvene `Accept: application/json`.

### Telpas

| Metode | Adrese | Apraksts |
|---|---|---|
| GET | `/api/rooms` | Visas aktīvās telpas |
| GET | `/api/rooms/{id}` | Konkrēta telpa |
| POST | `/api/rooms` | Jaunas telpas izveide |
| GET | `/api/rooms/{room}/schedule/{date}` | Telpas rezervācijas konkrētā datumā (`YYYY-MM-DD`) |
| GET | `/api/rooms/{room}/current` | Vai telpa šobrīd aizņemta |
| GET | `/api/rooms/{room}/upcoming` | Nākamās 5 telpas rezervācijas |

```json
// POST /api/rooms
{
  "name": "Meeting Room B",
  "capacity": 6,
  "location": "3. stāvs"
}
```

### Rezervācijas

| Metode | Adrese | Apraksts |
|---|---|---|
| POST | `/api/bookings` | Jaunas rezervācijas izveide |
| PATCH | `/api/bookings/{booking}` | Rezervācijas rediģēšana |
| DELETE | `/api/bookings/{booking}` | Rezervācijas dzēšana |

```json
// POST /api/bookings vai PATCH /api/bookings/{id}
{
  "room_id": 1,
  "title": "Development Team Meeting",
  "booked_by": "Toms",
  "starts_at": "2026-10-05 10:00:00",
  "ends_at": "2026-10-05 11:00:00"
}
```

### Kļūdu atbildes

| Kods | Nozīme |
|---|---|
| 401 | Trūkst vai nederīga API atslēga — `{"message": "Invalid or missing API key."}` |
| 404 | Telpa vai rezervācija ar norādīto ID neeksistē |
| 422 | Validācijas kļūda (trūkst lauka, nederīgs datums, laiks ārpus 07:00–21:00) vai pārklāšanās kļūda — `{"message": "Room is already booked for this period."}` |
| 429 | Pārsniegts pieprasījumu limits — skat. [Drošība](#drošība) |

Visas kļūdu atbildes tiek atgrieztas JSON formātā, nevis kā HTML lapa — `bootstrap/app.php` ir konfigurēts ar `shouldRenderJsonWhen` visiem `/api/*` pieprasījumiem.

---

## Drošība

**API atslēgas verifikācija.** Visi `/api/*` endpointi (gan lasīšanas, gan rakstīšanas) ir aizsargāti ar pielāgotu middleware `VerifyApiKey`, kas pārbauda pieprasījumā norādīto atslēgu pret `.env` failā definēto `API_KEY` vērtību, izmantojot `hash_equals()`, lai izvairītos no laika uzbrukuma (timing attack). Atslēgu var nosūtīt divos veidos:
- kā `X-API-Key` galveni (izmanto Postman un frontend pieprasījumi), vai
- kā `?key=` URL parametru, lai endpointu varētu pārbaudīt tieši pārlūkā, piem.: `http://127.0.0.1:8000/api/rooms?key=...`

URL parametra variants ir mazāk drošs nekā galvene, jo URL biežāk paliek saglabāti pārlūka vēsturē un servera logos — tas ir iekļauts lokālas demonstrācijas ērtībai.

**Rate limiting.** Visi `/api/*` maršruti ir ierobežoti ar `ThrottleRequests` middleware — maksimums 60 pieprasījumi minūtē no viena IP (kopīgs limits visiem endpointiem). Ja limits tiek pārsniegts, API atgriež `429 Too Many Requests` ar `{"message": "Too Many Attempts."}`.

**Mass assignment aizsardzība.** `Room` un `Booking` modeļiem ir definēts `$fillable`, tāpēc pieprasījumā nevar injicēt neparedzētus laukus (piem., `is_active`), kas nav norādīti šajā sarakstā.

**Validācija.** Visiem ievades datiem — obligātie lauki, datumu formāts, darba laika ierobežojums (07:00–21:00) un pārklāšanās pārbaude (skat. [Biznesa loģika](#biznesa-loģika)).

**`APP_DEBUG`.** Izstrādes laikā `.env` failā ir iestatīts `APP_DEBUG=true`, lai kļūdu gadījumā redzētu pilnu stack trace. Reālā izvietošanā šis iestatījums jāmaina uz `APP_DEBUG=false`, lai lietotājiem netiktu rādīta iekšēja informācija (faila ceļi, izmantotās bibliotēkas) — tā vietā redzams tikai īss JSON ziņojums.

**Zināms ierobežojums — API atslēga frontend kodā.** `public/app.js` satur `API_KEY` konstanti, lai `rooms.html` varētu izsaukt API. Tā kā šis ir statisks HTML/JS fails, kas izpildās pārlūkā, jebkurš, kas apskata lapas avota kodu, var redzēt šo atslēgu. Tas ir apzināts, dokumentēts ierobežojums šī uzdevuma demonstrācijas vajadzībām, nevis drošības kļūda — reālā produkcijas lietotnē frontend nekad nesazinātos ar API tieši, izmantojot koplietotu atslēgu, bet gan caur uzticamu backend starpniekserveri vai lietotāja autentifikāciju (sesijas, OAuth).

Pilna lietotāju autentifikācija (piem., Laravel Sanctum ar lietotāju kontiem) nav ieviesta — izmantota vienkārša koplietota API atslēga, kas ir apzināts pieņēmums šī uzdevuma tvēruma ietvaros.

---

## Testa dati (seeders)

Pēc `php artisan migrate:fresh --seed` datubāzē tiek izveidotas:
- **5 telpas** (`RoomSeeder`)
- **15 rezervācijas**, sadalītas pa telpām un dienām, plus **1 rezervācija**, kas ir aktīva tieši šobrīd, lai demonstrētu `/current` endpointu (`BookingSeeder`)

---

## Frontend lapa

Vienkārša HTML/CSS/JS lapa `public/rooms.html`, kas izmanto tikai iepriekš minētos API endpointus:
- telpu saraksts ar statusu (Free / In use / Full)
- izvēlētās dienas grafiks ar iespēju noklikšķināt uz stundas, lai izveidotu rezervāciju
- rezervācijas izveide, rediģēšana un dzēšana
- tuvāko rezervāciju saraksts

Fails ir sadalīts trīs daļās:
- `rooms.html` — izkārtojums
- `style.css` — stils
- `app.js` — loģika, ieskaitot API atslēgas pievienošanu katram pieprasījumam

Šī ir papildu funkcionalitāte demonstrācijai — pati API loģika (validācija, pārklāšanās pārbaude, autentifikācija) atrodas Laravel kodā, nevis frontend.

---

## Tehniskie pieņēmumi

- Darba laiks telpām ir fiksēts no 07:00 līdz 21:00 visām telpām vienādi.
- `booked_by` ir vienkāršs teksta lauks (personas vārds), nevis saite uz lietotāju tabulu, jo pilna lietotāju autentifikācija nav obligāta prasība.
- Kļūdu atbildes vienmēr tiek atgrieztas JSON formātā, lai API nekad neatgrieztu HTML kļūdas lapu.
- `API_KEY` frontend kodā (`public/app.js`) ir demonstrācijas vērtība — reālā izvietošanā tā tiktu aizstāta ar pareizu lietotāju autentifikāciju.