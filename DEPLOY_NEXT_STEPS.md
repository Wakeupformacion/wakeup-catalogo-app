# Siguiente salto a demo funcional/publicable

## Para verla realmente en web
Hace falta una de estas dos situaciones:

### Opción 1 · Local / servidor propio
- PostgreSQL disponible
- `DATABASE_URL` configurada
- ejecutar carga con `npm run load`
- arrancar API/web con `npm run dev`

### Opción 2 · Despliegue de demo
- subir app a un hosting Node
- provisionar PostgreSQL
- cargar datos importados
- publicar URL temporal o dominio final

## Opción recomendada de despliegue rápido
- backend/frontend juntos en un VPS o Render/Railway
- PostgreSQL en Neon, Supabase, Railway o servidor propio

## Entregable ideal siguiente
- demo pública temporal
- importación ya conectada a DB real
- catálogo navegable
- búsquedas reales con datos cargados
