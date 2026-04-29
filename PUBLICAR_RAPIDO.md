# Publicar rápido

## Lo más importante
Sube **esta carpeta `wakeup-catalogo-app/` como repositorio propio**.

No subas todo el workspace si quieres un despliegue simple.

## Opción recomendada · Render
1. crea un repo nuevo solo con el contenido de `wakeup-catalogo-app/`
   - si quieres sacar una copia limpia antes: `npm run bundle`
2. súbelo a GitHub
3. crea un servicio web en Render
4. usa:
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`
5. abre la URL pública

## Qué pasará al arrancar
- si `DATABASE_URL` no existe o no responde, la app arranca en modo demo/fallback
- si `DATABASE_URL` existe y responde, `boot.js` intenta cargar cursos y luego arrancar

## Variables
### Mínimas para demo pública
- `NODE_ENV=production`
- `CORS_ORIGIN=*`

### Para catálogo con PostgreSQL
- `DATABASE_URL=postgresql://...`

## Verificaciones rápidas
- `/`
- `/cursos`
- `/estado-demo`
- `/api/courses`
- `/api/categories`

Si la app ya está levantada, puedes validar lo esencial con:

```bash
npm run smoke
```

Opcionalmente, contra otra URL:

```bash
SMOKE_BASE_URL=https://tu-demo.onrender.com npm run smoke
```

## Nota
La carpeta ya incluye `data/catalog-fallback.json`, así que la demo puede publicarse sin depender de rutas externas del workspace.

El script `npm run bundle` genera una exportación limpia en `dist/` lista para revisar o subir a un repo nuevo.
