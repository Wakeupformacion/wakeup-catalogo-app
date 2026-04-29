# Checklist para publicar la demo

## Opción más rápida
Usar Render con el modo demo activo.

## Checklist
- [ ] subir `wakeup-catalogo-app/` a GitHub
- [ ] crear servicio web en Render
- [ ] conectar el repositorio
- [ ] verificar que `npm start` arranca correctamente
- [ ] abrir la URL temporal generada por Render
- [ ] revisar home, catálogo y detalle de curso
- [ ] comprobar categorías destacadas y filtros
- [ ] comprobar botón `Ver contenidos y objetivos`

## Para pasar a catálogo real
- [ ] provisionar PostgreSQL
- [ ] configurar `DATABASE_URL`
- [ ] dejar que `npm start` ejecute `boot.js`
- [ ] verificar `/api/courses`
- [ ] validar búsquedas y categorías reales

## Para pasar a producción de verdad
- [ ] definir dominio real
- [ ] conectar DNS
- [ ] habilitar SSL
- [ ] revisar branding final
- [ ] ajustar SEO y analítica
