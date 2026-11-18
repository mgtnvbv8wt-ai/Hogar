# Nuestro Hogar

App web instalable (PWA) para dos viviendas: calendario, chat, compra, tareas, menú de la guardería y el tiempo.
Se publica con GitHub Pages desde `main`. Datos y usuarios en Supabase (proyecto `casa-control-hogar`).

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Estructura de las pantallas y política de contenido (CSP) |
| `css/style.css` | Estilos (tema claro/oscuro, tamaño de letra, colores por vivienda) |
| `js/*.js` | Código, un archivo por área. **El orden de carga está en `index.html`** |
| `sw.js`, `manifest.webmanifest` | Service worker (avisos, caché) y datos de instalación |
| `icon-*.png`, `splash/` | Iconos y pantallas de arranque de iOS |
| `tests/` | Pruebas de interfaz con un Supabase simulado |

Orden y papel de los archivos JS: `config` (cliente Supabase) → `i18n` (castellano/català) → `core` (preferencias, utilidades, estado) → `offline` (cola de cambios y copia local) →
`auth` → `data` (carga y tiempo real) → `nav` → `calendar` → `chat` → `shop` → `chores` → `lists` → `menu` → `weather` → `home` → `backup` →
`search` → `swipe` → `admin` → `settings` → `push` → `main` (se carga el último: registra la sesión y el service worker).
Son scripts clásicos que comparten ámbito global, así que una función de un archivo se puede llamar desde otro **solo cuando ya se ha ejecutado**
(no hay código que se ejecute al cargar y dependa de un archivo posterior).

## Cambios habituales

* Textos nuevos: escribirlos con `tr('Texto en castellano')` y añadir la traducción en `js/i18n.js` (`CA`, o `HTML_CA` si está en `index.html`).
* Cada vez que cambie algún archivo de la app: subir el número de `CACHE` en `sw.js` y, si se añade un archivo, ponerlo en `SHELL`.
* Tablas y funciones de Supabase: migraciones SQL; todas las tablas tienen RLS por hogar (`my_household_id()`).

## Pruebas

```bash
pip install playwright && playwright install chromium
bash tests/run_all.sh        # arranca un servidor local en :8765, ejecuta las pruebas y lo apaga
```

Las capturas y registros quedan en `tests/out/` (no se sube).

## Mantenimiento

- **Pruebas automáticas:** `.github/workflows/tests.yml` ejecuta la sintaxis de los scripts y `tests/run_all.sh` en cada push a `main` y en cada pull request. Si falla alguna prueba, la ejecución sale en rojo en la pestaña *Actions* de GitHub.
- **Copias de seguridad:** el día 1 de cada mes a las 3:00 UTC (`pg_cron`, tarea `copia-mensual`) se guarda en `private.backups` una copia de hogar, miembros, eventos, mensajes, compra, tareas y menús. Se conservan las 6 últimas. Para hacer una a mano: `select private.take_backup();`. Para ver las copias: `select id, taken_at, rows_total from private.backups order by taken_at desc;`.
  Ejemplo de restauración de eventos borrados por error (sin pisar los que ya existen):
  ```sql
  insert into public.events
  select * from jsonb_populate_recordset(null::public.events, (select data->'events' from private.backups where id = 1))
  on conflict (id) do nothing;
  ```
  Estas copias viven en la misma base de datos: protegen de borrados por error, no de perder el proyecto. Para eso, usa también *Copia de seguridad* en Ajustes de la app.

## Piezas añadidas (noviembre)

- `js/lists.js`: listas reutilizables (tabla `checklists`; se reinician 12 h después de terminarlas).
- `js/admin.js`: pantalla de administración. Usa las funciones `admin_*` del servidor, que solo responden a quien entró primero en el hogar.
- `js/swipe.js`: deslizar para marcar (→) o borrar (←) en compra y tareas.
- Avisos (función `notify`): chat, compra, tareas, eventos, recordatorios, resumen de tareas, menú y alertas de seguridad (registro nuevo o códigos de invitación fallidos). Las preferencias de cada persona están en `notif_prefs`.
- Vista de **semana** en el calendario (`renderWeek` en `js/calendar.js`).

### AngIA (asistente con Gemini)
- Pestaña `AngIA` (js/angia.js) en lugar de Chat; el chat sigue en la base de datos y su vista existe, pero la pestaña está oculta.
- Función `angia` de Supabase (verify_jwt): valida la sesión, lee compra/tareas/eventos/menú con RLS de su casa y llama a Gemini. Responde y puede AÑADIR (no borrar ni editar) productos a la compra, tareas y eventos mediante function calling de Gemini; inserta con la sesión de quien pregunta (RLS) y como máximo 15 acciones por petición.
- Secretos en Vault: `gemini_api_key` (obligatorio) y `gemini_model` (opcional, por defecto `gemini-flash-latest`).
- Límite de 40 preguntas al día por persona (`public.angia_take`, tabla `private.angia_usage`). La conversación se guarda solo en el móvil.
- Prueba: `tests/test_angia.py`.
- Memoria compartida: tabla `angia_memory` (RLS por hogar, máx. 60 recuerdos), herramienta `remember_fact` y botón «Memoria» en la pestaña. La conversación sigue guardándose solo en cada móvil.
- El tiempo: si la pregunta lo menciona, la función refresca la estación de Torelló (función `weather`) y pasa la lectura real (no previsión) a Gemini.
- Fotos: botón 📷 en la pestaña; la foto se reduce en el móvil (máx. 1600 px, JPEG) y viaja a la función como `image` (base64, máx. ~5 MB). AngIA la interpreta (invitaciones → eventos, recetas → compra, menú de la guardería → `add_menu_days`).
- Herramientas de la función: `add_shopping_items`, `add_chore` (con repetición diaria/semanal/mensual), `add_event`, `add_menu_days` (upsert por día), `complete_items` (marca compra o tareas como hechas, como la app; nunca borra) y `remember_fact`.

