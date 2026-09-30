# Room Booking API

Backend REST API telpu rezervēšanai, izstrādāts ar Laravel un MySQL. Sistēma ļauj apskatīt uzņēmuma telpas, to dienas grafiku un veikt rezervācijas, nodrošinot, ka viena telpa vienlaicīgi netiek rezervēta vairākiem cilvēkiem un rezervāciju laiki nepārklājas.

Papildus API projektā iekļauta arī vienkārša frontend lapa (`public/rooms.html`), kas ļauj testēt un demonstrēt API darbību pārlūkā.

## Tehnoloģijas

- PHP 8.2+
- Laravel 13
- MySQL
- Git

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

4. `.env` failā iestatīt MySQL datubāzes savienojumu:
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=room_booking
   DB_USERNAME=root
   DB_PASSWORD=
   ```
   Datubāzei `room_booking` jābūt izveidotai iepriekš (piem., ar phpMyAdmin vai HeidiSQL).

5. Palaist migrācijas un aizpildīt datubāzi ar testa datiem:
   ```bash
   php artisan migrate:fresh --seed
   ```

6. Palaist serveri:
   ```bash
   php artisan serve
   ```

API būs pieejams `http://127.0.0.1:8000/api`, bet frontend lapa — `http://127.0.0.1:8000/rooms.html` (arī `http://127.0.0.1:8000/` novirza uz to pašu adresi).

## Datu modelis

**rooms**: `id`, `name`, `capacity`, `location`, `is_active`, `created_at`, `updated_at`

**bookings**: `id`, `room_id` (ārējā atslēga uz `rooms`), `title`, `booked_by`, `starts_at`, `ends_at`, `created_at`, `updated_at`

Attiecība: viena telpa var saturēt vairākas rezervācijas (`Room hasMany Booking`, `Booking belongsTo Room`).

## Biznesa loģika

- **Rezervāciju laiki nedrīkst pārklāties.** Divi periodi pārklājas, ja esošais sākas pirms jaunā beigām UN beidzas pēc jaunā sākuma. Salīdzinājumā izmantoti stingri `<` un `>`, tāpēc rezervācijas var sekot cita citai bez pārtraukuma (piem., 10:00–11:00 un uzreiz pēc tam 11:00–12:00 ir atļautas).
- **Rezervācijas iespējamas tikai no 07:00 līdz 21:00.** Ja rezervācijas sākums ir pirms 07:00 vai beigas pēc 21:00, pieprasījums tiek noraidīts ar validācijas kļūdu.
- Pārklāšanās pārbaude notiek datubāzes transakcijā ar rindas bloķēšanu (`lockForUpdate`), lai divi vienlaicīgi pieprasījumi nevarētu abi izturēt pārbaudi un izveidot pārklājošās rezervācijas.
- Rezervāciju var izveidot tikai aktīvai telpai (`is_active = true`).

## API endpointi

Visi endpointi saņem un atgriež JSON. Pieprasījumiem jāsūta galvene `Accept: application/json`.

### Telpas

| Metode | Adrese | Apraksts |
|---|---|---|
| GET | `/api/rooms` | Visas aktīvās telpas |
| GET | `/api/rooms/{id}` | Konkrēta telpa |
| POST | `/api/rooms` | Jaunas telpas izveide |
| GET | `/api/rooms/{room}/schedule/{date}` | Telpas rezervācijas konkrētā datumā (formāts `YYYY-MM-DD`) |
| GET | `/api/rooms/{room}/current` | Vai telpa šobrīd aizņemta |
| GET | `/api/rooms/{room}/upcoming` | Nākamās 5 telpas rezervācijas |

**POST /api/rooms** piemērs:
```json
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

**POST /api/bookings** un **PATCH /api/bookings/{id}** piemērs:
```json
{
  "room_id": 1,
  "title": "Development Team Meeting",
  "booked_by": "Toms",
  "starts_at": "2026-10-05 10:00:00",
  "ends_at": "2026-10-05 11:00:00"
}
```

### Kļūdu atbildes

- **404** — telpa vai rezervācija ar norādīto ID neeksistē.
- **422** — validācijas kļūda (trūkst lauka, nederīgs datums, laiks ārpus 07:00–21:00 u.tml.) vai pārklāšanās kļūda:
  ```json
  { "message": "Room is already booked for this period." }
  ```
- **429** — pārsniegts pieprasījumu limits (skat. sadaļu "Drošība").

Visas kļūdu atbildes tiek atgrieztas JSON formātā, nevis kā HTML lapa, jo `bootstrap/app.php` ir konfigurēts ar `shouldRenderJsonWhen` visiem `/api/*` pieprasījumiem.

## Testa dati (seeders)

Pēc `php artisan migrate:fresh --seed` datubāzē tiek izveidotas:
- 5 telpas (`RoomSeeder`)
- 15 rezervācijas, sadalītas pa telpām un dienām, plus 1 rezervācija, kas ir aktīva tieši šobrīd, lai demonstrētu `/current` endpointu (`BookingSeeder`)

## Drošība

- **Rate limiting.** Visi `/api/*` maršruti ir ierobežoti ar `ThrottleRequests` middleware — maksimums 60 pieprasījumi minūtē no viena IP (kopīgs limits visiem endpointiem, nevis atsevišķi katram). Limits pievienots `bootstrap/app.php` failā. Ja limits tiek pārsniegts, API atgriež `429 Too Many Requests` ar JSON `{"message": "Too Many Attempts."}`.
- **Mass assignment aizsardzība.** `Room` un `Booking` modeļiem ir definēts `$fillable`, tāpēc pieprasījumā nevar injicēt neparedzētus laukus (piem., `is_active`), kas nav norādīti šajā sarakstā.
- **Validācija visiem ievades datiem** — obligātie lauki, datumu formāts, darba laika ierobežojums (07:00–21:00) un pārklāšanās pārbaude (skat. "Biznesa loģika").
- **`APP_DEBUG`.** Izstrādes laikā `.env` failā ir iestatīts `APP_DEBUG=true`, lai kļūdu gadījumā redzētu pilnu stack trace. Reālā izvietošanā šis iestatījums jāmaina uz `APP_DEBUG=false`, lai lietotājiem netiktu rādīta iekšēja informācija (faila ceļi, izmantotās bibliotēkas) — tā vietā redzams tikai īss JSON ziņojums.

Nav ieviesta autentifikācija (piem., Laravel Sanctum) — visi endpointi šobrīd ir publiski pieejami, kas ir apzināts pieņēmums šī uzdevuma tvēruma ietvaros. Autentifikācija ir minēta kā viens no iespējamajiem papildu izaicinājumiem.

## Frontend lapa

Projektā iekļauta vienkārša HTML/CSS/JS lapa `public/rooms.html`, kas izmanto tikai iepriekš minētos API endpointus:
- telpu saraksts ar statusu (Free / In use / Full)
- izvēlētās dienas grafiks ar iespēju noklikšķināt uz stundas, lai izveidotu rezervāciju
- rezervācijas izveide, rediģēšana un dzēšana
- tuvāko rezervāciju saraksts

Fails ir sadalīts trīs daļās: `rooms.html` (izkārtojums), `style.css` (stils) un `app.js` (loģika). Šī ir papildu funkcionalitāte demonstrācijai — pati API loģika (validācija, pārklāšanās pārbaude) atrodas Laravel kodā, nevis frontend.

## Svarīgi tehniskie pieņēmumi

- Darba laiks telpām ir fiksēts no 07:00 līdz 21:00 visām telpām vienādi.
- `booked_by` ir vienkāršs teksta lauks (personas vārds), nevis saite uz lietotāju tabulu, jo autentifikācija nav obligāta prasība.
- Kļūdu atbildes vienmēr tiek atgrieztas JSON formātā, lai API nekad neatgrieztu HTML kļūdas lapu.