# Caregiver API (Laravel)

Local backend for the caregiver mobile app. Routes mirror production (`bpscaregiver.com`) paths used by the Expo client.

## Requirements

- PHP 8.3+ with `pdo_pgsql`
- Composer
- PostgreSQL 16+ database `core_grid` (restored from `Documents\core_grid`)

## Setup

```powershell
cd backend
composer install
copy .env.example .env   # if needed; .env points at local PostgreSQL core_grid
php artisan key:generate
php artisan migrate
php artisan db:seed --class=RolesAndPermissionsSeeder
php artisan serve --host=0.0.0.0 --port=8000
```

### Database (`.env`)

The app uses **only** PostgreSQL `core_grid`. There is no MySQL connection.

```
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=core_grid
DB_USERNAME=postgres
DB_PASSWORD=postgres
```

Login reads `account_credentials.password_hash`. Domain tables already exist in the dump.  
Laravel migrations only add `personal_access_tokens` (Sanctum) and Spatie permission tables.

## Point the mobile app at local API

Edit `src/shared/config/api.ts`:

```ts
export const API_BASE_URL = 'http://10.0.2.2:8000'; // Android emulator → host machine
// or 'http://YOUR_LAN_IP:8000' for a physical device
// or 'http://127.0.0.1:8000' for iOS simulator / web
```

## Admin panel (login + roles)

Open while `php artisan serve` is running:

**http://127.0.0.1:8000/admin/login**

### Default super admin (after seed)

| Field | Value |
|-------|--------|
| Email | `debug@debug.com` (core_grid SuperAdmin) |
| Password | `BPS@1234` |

Seed / re-seed:

```powershell
php artisan db:seed --class=RolesAndPermissionsSeeder
```

Override via `.env`:

```
ADMIN_EMAIL=admin@caregiver.local
ADMIN_PASSWORD=BPS@1234
ADMIN_NAME="Super Admin"
```

### Roles

| Role | Access |
|------|--------|
| `super_admin` | All permissions (Gate bypass) |
| `admin` | Records + user management (no role edit) |
| `support` | View records + view admin users |
| `viewer` | Read-only records |

### Permissions

- `dashboard.view`, `monitoring.kpi.view`
- `records.users.view`, `records.profiles.view`, `records.devices.view`
- `records.medical.view`, `records.events.view`, `records.yuwell.view`, `records.tables.view`
- `admin.users.view`, `admin.users.manage`
- `admin.roles.view`, `admin.roles.manage`

### Pages

| Page | URL |
|------|-----|
| Login | `/admin/login` |
| Dashboard | `/admin` |
| Monitoring room | `/admin/monitoring` |
| Vital signs | `/admin/vitals` |
| App users (records) | `/admin/records/users` |
| Profiles | `/admin/profiles` |
| Devices | `/admin/devices` |
| Medical readings | `/admin/medical-data` |
| Events / alerts | `/admin/events` |
| Yuwell catalog | `/admin/yuwell-models` |
| Table row counts | `/admin/tables` |
| User management | `/admin/management/users` |
| Roles & permissions | `/admin/management/roles` |

## Auth

- Email signup: `POST /users` `{ user_label, email, password }`
- Login: `POST /auth/login` `{ email, password }`
- Bearer token on all protected routes: `Authorization: Bearer <token>`
- OAuth: `POST /auth/google|facebook|line`  
  With `OAUTH_DEV_MODE=true`, tokens may use `dev:you@example.com` for local testing.
- Login uses **only** `core_grid.account_credentials` (PostgreSQL). MySQL is not used.

### Medical alerts (core_grid)

| Who | Endpoint | What they see |
|-----|----------|----------------|
| Signed-in user | `GET /medical-alerts` | Alerts for profiles they own or were granted |
| Signed-in user | `GET /medical-records` | Raw readings for those same profiles |
| Admin (`super_admin` / `admin`, or core_grid `SuperAdmin`) | `GET /medical-alerts` | Every medical alert |
| Admin | `GET /monitoring/kpi` | Monitoring-room KPIs |
| Admin | `GET /monitoring/alerts` | Full alert feed |

Query params on alert list: `profile_id`, `from`, `to`, `severity` (comma list), `reading_type` (`spo2|bp|glucose|temp|weight|pulse`), `search`, `per_page`.

```powershell
# User: only own records
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8000/medical-alerts"

# Admin KPI for the monitoring room
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://127.0.0.1:8000/monitoring/kpi"
```

## Quick smoke test

```powershell
# Signup
curl -s -X POST http://127.0.0.1:8000/users -H "Content-Type: application/json" -d "{\"user_label\":\"Demo\",\"email\":\"demo@local.test\",\"password\":\"Passw0rd1\"}"

# Login
curl -s -X POST http://127.0.0.1:8000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"demo@local.test\",\"password\":\"Passw0rd1\"}"
```

## Route map

See `../api.text` for the full client contract. Implemented under `routes/api.php` **without** an `/api` prefix so paths match the app.
