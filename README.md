## El Prospecto de Cada Día

Aplicación completa para gestionar envíos de mensajes de Instagram desde archivos Excel/CSV, con dashboard, planificación diaria, filtros inteligentes y métricas de costos.

### Stack
- Frontend: Next.js + TailwindCSS + SWR + Recharts
- Backend: Node.js + Express + SQLite (better-sqlite3)

### Estructura
- `backend/` API Express + SQLite
- `app/` Frontend Next.js (páginas: dashboard, upload, prospects, plan)

### Ejecutar en local
- Terminal 1 (API):
  - `cd backend`
  - `npm run dev`
  - API en `http://localhost:4000/api`
- Terminal 2 (Frontend):
  - `npm run dev`
  - Web en `http://localhost:3000`

> Produccion: define `NEXT_PUBLIC_API_BASE` para apuntar al backend publico (por defecto `http://localhost:4000/api`).

Despliegue recomendado (Vercel + Render/Railway)

- Frontend (Vercel)
  - Variables de entorno:
    - `NEXT_PUBLIC_API_BASE`: URL base del backend, por ej. `https://tu-backend.onrender.com/api`
  - Construccion: `npm run build`

- Backend (Render/Railway/Fly)
  - Variables de entorno:
    - `PORT`: 4000
    - `DB_PATH`: ruta al archivo sqlite (en Render usa un disco persistente, por ej. `/var/data/database.sqlite`)
    - `NODE_ENV`: `production`
    - `CORS_ORIGIN`: opcional; si no se define, el backend refleja el `Origin` de la solicitud (compatible con credenciales)
  - Asignar un volumen/disco para persistir la base de datos.

Notas

- El paquete `better-sqlite3` no es compatible con lambdas serverless de Vercel. Por eso se recomienda desplegar el backend en un servicio con proceso persistente (Render/Railway/Fly) y el frontend en Vercel apuntando al backend via `NEXT_PUBLIC_API_BASE`.
- Cookies de sesion: en produccion se envian con `SameSite=None; Secure` y CORS con `credentials: true`. Asegurate de que el dominio de Vercel este incluido via `CORS_ORIGIN` o usando el modo "reflect" por defecto.

### Subida de archivos
- Acepta `.xlsx` y `.csv`.
- Columnas esperadas (cualquiera de):
  - `href` | `link` | `url` (enlace a perfil de Instagram)
  - `usuario` | `username` | `user` (nombre de usuario)
  - `nombre` | `name` | `full_name` (nombre real)
- Normaliza usuarios, elimina duplicados, marca no deseados por palabras clave ("design", "agencia", "web", "marketing", "digital", etc.).

### Planificación y tracking
- Genera planificación automática: X mensajes/día × N cuentas, desde una fecha, por N días.
- Marca cada registro como `pendiente` → `enviado` → `cliente ganado`.
- Cronómetro simple para medir tiempo (work sessions) desde la vista de Plan.

### Métricas y costos
- Totales: prospectos cargados, enviados, clientes.
- Tasa de conversión.
- Valor hora configurable.
- Costo total, CPA (por mensaje) y CPR (por cliente), horas acumuladas.

### Avatares de Instagram
- Se muestran con `https://unavatar.io/instagram/<usuario>`.

### Segmentación y scoring de prospects
- Nuevos campos en `prospects`:
  - `entity_kind` (`person|business`), `person_profession`, `industry`, `is_competitor` (0/1)
  - `lead_score` (0–100), `interest_probability` (0–1)
  - `classification_signals` (JSON), `classification_version`, `classification_updated_at`
- Clasificador por reglas en `backend/utils/classifier.js`.
- Backfill local: `node backend/scripts/backfill-classification.js`
  - Reprocesar todos: `FULL_RECLASSIFY=1 node backend/scripts/backfill-classification.js`

### Turso (libSQL)
- Variables de entorno para usar Turso en lugar de SQLite local:
  - `LIBSQL_URL` y `LIBSQL_AUTH_TOKEN` (opcional, según DB privada)
- Migrar datos locales a Turso: `LIBSQL_URL=... LIBSQL_AUTH_TOKEN=... node backend/scripts/migrate-to-turso.js`
- Al iniciar el backend con `LIBSQL_URL` definido, se conectará a Turso automáticamente.
