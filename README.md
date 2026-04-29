# WakeUp Catálogo App

Base inicial de backend/API para el catálogo inteligente.

## Contenido
- `server.js` → API Express base
- `db.js` → conexión PostgreSQL
- `load-courses.js` → carga `courses.json` a PostgreSQL
- `data/catalog-fallback.json` → catálogo importado embebido para modo demo/publicación rápida
- `.env.example` → variables de entorno de ejemplo

## Endpoints iniciales
- `GET /health`
- `GET /api/courses`
- `GET /api/courses/:slug`
- `GET /api/categories`
- `GET /`
- `GET /estado-demo`
- `GET /cursos`
- `GET /cursos/:slug`

## Flujo esperado
1. configurar `DATABASE_URL`
2. arrancar PostgreSQL
3. ejecutar `npm run load`
4. arrancar la app con `npm start`

## Publicación rápida
Si vas a subir esto a GitHub/Render, lo más limpio es publicar **solo esta carpeta** como repositorio independiente.

Guía breve:
- `PUBLICAR_RAPIDO.md`
- `DEPLOY_RENDER.md`

Además puedes generar una exportación limpia con:

```bash
npm run bundle
```

Y validar lo esencial con:

```bash
npm run smoke
```

## Arranque rápido demo
Sin base de datos disponible, la app puede seguir mostrando una demo navegable y autocontenida:

```bash
npm ci
npm start
```

URL local esperada:
- `http://localhost:3001`

## Arranque full-stack con Docker Compose
Para una demo más cercana a entorno real:

```bash
docker compose up --build
```

Esto intenta:
- levantar PostgreSQL
- cargar el catálogo
- arrancar la app

## Notas
- la búsqueda actual ya incluye una primera capa de relevancia textual
- detecta intención simple por horas (`20 horas`, `40 horas`, etc.)
- pondera mejor título y categoría
- existe modo demo cuando no hay PostgreSQL disponible
- el fallback ya queda dentro de esta carpeta para publicar la demo sin depender de rutas externas
- `boot.js` permite intentar carga automática cuando la base responde
- ya está preparada la base para full-text real y futura búsqueda semántica
