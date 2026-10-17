# Semilla Estelar

RPG de vida real para Android: misiones, rachas, cofres y **recordatorios push que llegan aunque la app esté cerrada**. La notificación trae los botones **Completar** y **Posponer 10 min**.

- **App:** página web instalable (PWA) alojada gratis en GitHub Pages.
- **Datos y avisos:** Supabase (inicio de sesión, base de datos, funciones y tarea programada cada minuto).

> La app web vive en la raíz del repositorio, sin carpetas. El código de Supabase (`schema.sql`, `cron.sql` y las dos funciones) está en la carpeta `supabase/` del zip; no hace falta subirlo a GitHub, solo copiarlo en el panel de Supabase.

---

## Guía de instalación (unos 30 minutos, una sola vez)

Hazlo desde el **computador**. Ten a mano un bloc de notas privado para guardar valores.

### Paso 1 · Activar GitHub Pages

1. En este repositorio ve a **Settings › Pages**.
2. En **Source** elige **Deploy from a branch**; rama **main**, carpeta **/ (root)**. Guarda.
3. En 1 o 2 minutos aparece tu dirección: `https://jcvm24.github.io/semilla-estelar/`.

### Paso 2 · Generar tus claves

1. Abre `https://jcvm24.github.io/semilla-estelar/generar-claves.html` y toca **Generar claves**.
2. Copia los tres valores (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y APP_SECRET) en tu nota privada.
3. **No los pegues en ningún chat.** La clave privada y el secreto solo van en Supabase.

### Paso 3 · Crear el proyecto en Supabase

1. En supabase.com crea un proyecto nuevo (por ejemplo `semilla-estelar`). Elige la región más cercana y guarda la contraseña de la base de datos.
2. Cuando termine de crearse, ve a **SQL Editor › New query**, pega todo el contenido de `supabase/schema.sql` (del zip) y toca **Run**. Debe decir *Success*.

### Paso 4 · Configurar el inicio de sesión

1. **Authentication › URL Configuration › Site URL:** pega `https://jcvm24.github.io/semilla-estelar/`. Guarda.
2. (Después de crear tu cuenta en el paso 8) **Authentication › Sign In / Providers**: desactiva **Allow new users to sign up** para que nadie más se registre.

### Paso 5 · Guardar los secretos

En **Edge Functions › Secrets**, agrega estos cuatro:

| Nombre | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la clave pública del paso 2 |
| `VAPID_PRIVATE_KEY` | la clave privada del paso 2 |
| `VAPID_SUBJECT` | `mailto:` seguido de tu correo, por ejemplo `mailto:juan@correo.com` |
| `APP_SECRET` | el secreto del paso 2 |

### Paso 6 · Publicar las dos funciones

En **Edge Functions › Deploy a new function › Via Editor**:

1. Nombre **`send-reminders`**. Borra el código de ejemplo, pega el de `supabase/functions/send-reminders/index.ts` (del zip) y publica.
2. Repite con el nombre **`snooze`** y el código de `supabase/functions/snooze/index.ts` (del zip).
3. En los **Details/Settings** de **cada** función, **desactiva "Enforce JWT verification"** (o "Verify JWT"). Están protegidas por el secreto y por una firma.

> Si prefieres la terminal: `npx supabase login`, `npx supabase link --project-ref TU-PROYECTO` y `npx supabase functions deploy` (el archivo `supabase/config.toml` ya desactiva la verificación JWT).

### Paso 7 · Activar la tarea programada

1. Abre `supabase/cron.sql` (del zip), cópialo al **SQL Editor** y reemplaza:
   - `TU-PROYECTO` por el *Project ID* (está en **Project Settings › General**, o en tu URL `https://ESTO.supabase.co`).
   - `TU-SECRETO` por tu `APP_SECRET`.
2. Toca **Run**. Ese texto queda solo dentro de tu base de datos; no lo guardes editado en GitHub.

### Paso 8 · Conectar la app

1. En este repositorio abre **`config.js`**, toca el lápiz ✏️ y reemplaza:
   - `SUPABASE_URL` por tu **Project URL** (**Project Settings › API**).
   - `SUPABASE_ANON_KEY` por la clave **anon public** o **publishable**. Es pública; nunca uses la `service_role` ni la `secret`.
   - `VAPID_PUBLIC_KEY` por la clave pública del paso 2.
2. Toca **Commit changes**. En 1 o 2 minutos GitHub Pages se actualiza.

### Paso 9 · Instalar en tu Android

1. En **Chrome** del celular abre `https://jcvm24.github.io/semilla-estelar/`.
2. Toca **Crear cuenta**, confirma con el enlace que llega a tu correo y luego toca **Entrar**.
3. Menú **⋮ › Agregar a la pantalla principal** (o **Instalar app**).
4. Abre la app desde el ícono, ve a **Personaje › Recordatorios** y toca **Activar notificaciones**. Acepta el permiso.
5. Toca **Enviar notificación de prueba**. Debe llegar en menos de un minuto.

### Paso 10 · Traer tu progreso de la versión de Claude

1. En la versión de Claude, ve a **Personaje › Respaldar mis datos**. Se descarga un `.json`.
2. En la app nueva: **Importar respaldo anterior** (pantalla de inicio) o **Personaje › Importar respaldo**.

---

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| La prueba no llega | En el SQL Editor: `select status_code, content from net._http_response order by created desc limit 5;` · 401 = el `APP_SECRET` del cron no coincide con el de Secrets · 404 = nombre de función o Project ID mal escrito. |
| `cron.job_run_details` vacío | Repite el paso 7. |
| Llega a un celular pero no al otro | Activa las notificaciones en cada dispositivo. |
| Android no muestra avisos | **Ajustes › Apps › Chrome (o Semilla) › Notificaciones** activadas, y sin ahorro de batería extremo para Chrome. |
| La app no se actualiza | Cierra y abre la app dos veces. |

## Cómo funciona

- Cada minuto, la tarea programada llama a `send-reminders`. Esa función revisa tus misiones en hora de Bogotá (UTC-5) y envía los avisos que tocan. No envía avisos de misiones ya completadas ni durante tu horario de silencio, y nunca envía el mismo aviso dos veces.
- **Completar** abre la app y marca la misión, con su XP y sus fragmentos.
- **Posponer** llama a `snooze`, que programa un aviso nuevo en 10 minutos.
- Cada misión puede tener su propio aviso: sin aviso, a la hora exacta o de 5 a 60 minutos antes. Se configura al editarla.

## Costos

Para una sola persona, el uso debería caber en los planes gratuitos de GitHub Pages y Supabase. Revisa los límites vigentes en sus páginas oficiales. Ten en cuenta que Supabase puede **pausar proyectos gratuitos inactivos**; usar la app a diario lo evita.

## Próximas fases

- **Fase 2:** cofres escritos con IA (saga continua) generados en el servidor, e integración con Google Calendar.
- **Fase 3:** estadísticas avanzadas y exportación para Power BI.
