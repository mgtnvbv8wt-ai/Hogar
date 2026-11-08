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
`search` → `swipe` → `settings` → `push` → `main` (se carga el último: registra la sesión y el service worker).
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
