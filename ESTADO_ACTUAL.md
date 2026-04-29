# Estado actual de la app técnica

## Ya implementado

### Importación real
Existe un importador funcional en:
- `../wakeup-catalogo-tecnico/importer/`

Genera:
- `../wakeup-catalogo-tecnico/output/courses.json`
- `../wakeup-catalogo-tecnico/output/import-summary.json`
- `../wakeup-catalogo-tecnico/output/import-errors.json`

### Capa API inicial
Existe una app Node/Express en este directorio con:
- `GET /health`
- `GET /api/courses`
- `GET /api/courses/:slug`
- `GET /api/categories`

### Carga a PostgreSQL
Existe un cargador de datos:
- `load-courses.js`

Ese script:
- aplica `schema.sql`
- crea un lote de importación
- inserta o actualiza cursos por `course_code`
- deja trazabilidad en `import_batches`

## Limitación actual del entorno
En esta sesión no está disponible `psql`, por lo que no se ha podido validar una conexión PostgreSQL real desde aquí.

## Siguiente paso técnico
Cuando haya PostgreSQL disponible:

```bash
cd /home/node/.openclaw/workspace/wakeup-catalogo-app
cp .env.example .env
# ajustar DATABASE_URL
npm run load
npm run dev
```

## Resultado esperado
- tabla `courses` poblada
- API sirviendo catálogo real
- base lista para conectar frontend web y buscador inteligente
