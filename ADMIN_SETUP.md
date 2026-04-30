# Admin setup

## Variables necesarias

Configura estas variables de entorno para activar el acceso admin en producción:

- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=pon-aqui-una-clave-segura`
- `ADMIN_SESSION_SECRET=otra-clave-larga-y-distinta`

## Acceso

- URL: `/admin`

## Qué permite hacer

- crear cursos manualmente
- editar cursos existentes
- eliminar cursos
- importar cursos desde CSV
- importar cursos desde Excel `.xlsx`

## Formatos recomendados de columnas

El importador intenta mapear estas cabeceras comunes:

- `course_code` / `codigo` / `code`
- `title` / `titulo`
- `category_raw` / `categoria` / `category`
- `hours` / `horas`
- `delivery_mode` / `modalidad`
- `detail_url` / `url` / `enlace`
- `is_active` / `activo`

## Notas

- Si hay base de datos conectada, el admin escribe sobre PostgreSQL.
- Si no hay base de datos conectada, escribe sobre `data/catalog-fallback.json`.
- Recomendado: usar primero un fichero pequeño de prueba antes de cargar el catálogo completo.
