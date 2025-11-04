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

> Opcional: define `NEXT_PUBLIC_API_BASE` para apuntar a otra URL (por defecto `http://localhost:4000/api`).

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
