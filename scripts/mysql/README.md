# Local MySQL — caregiver_app

Schema inferred from caregiver-app API contracts (`api.text` + `src/**` payloads).

## Connection

| Setting  | Value           |
|----------|-----------------|
| Host     | `127.0.0.1`     |
| Port     | `3306`          |
| Database | `caregiver_app` |
| User     | `root`          |
| Password | `root@1234`     |

```
mysql -u root -p"root@1234" caregiver_app
```

## Create / reset schema

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p"root@1234" --default-character-set=utf8mb4 -e "source E:/caregiver-app/scripts/mysql/caregiver_app_schema.sql"
```

**Warning:** re-running the script drops and recreates all tables in `caregiver_app`.

## Tables ↔ API

| Table | Related API |
|-------|-------------|
| `users`, `oauth_identities`, `email_verification_codes` | `/users`, `/auth/*`, `/users/me` |
| `profiles`, `profile_consents` | `/profiles/*`, consents |
| `medical_general_info` | `/profiles/:id/medical-general` |
| `profile_reminders` | `/profiles/:id/reminders` |
| `profile_goals` | `/profiles/:id/goals` |
| `devices`, `user_devices` | `/devices`, `/users/me/devices` |
| `yuwell_models` | `/yuwell/models` |
| `medical_data_raw`, `medical_data_daily`, `medical_data_archeive` | `/medical-data`, trends, health-report |
| `medical_events`, `medical_events_archive` | `/medical-events` |
| `line_notify_targets`, `line_notify_link_pins` | `/line-notify/*` |

Note: `medical_data_archeive` keeps the API spelling used by `/profiles/:id/health-report-data`.
