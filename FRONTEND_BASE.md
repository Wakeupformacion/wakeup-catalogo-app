# Frontend base preparado

## Estado
Se ha añadido una capa visual inicial al backend Express para disponer de una primera web navegable del catálogo.

## Vistas creadas
- `views/home.ejs`
- `views/courses.ejs`
- `views/course-detail.ejs`
- `public/styles.css`

## Rutas web añadidas
- `/` → landing/home
- `/cursos` → listado de cursos
- `/cursos/:slug` → detalle de curso

## Objetivo de esta capa
Permitir una primera experiencia funcional con:
- home con propuesta de valor
- caja de búsqueda
- listado de cursos
- botón `Ver contenidos y objetivos`
- ficha resumida de curso

## Dependencia actual
Estas vistas consumen la tabla `courses` en PostgreSQL a través del propio servidor.

## Siguiente evolución recomendable
1. conectar con base real y probar navegación
2. mejorar branding visual con logo WakeUp
3. añadir filtros más amigables por categoría
4. sustituir búsqueda simple por full-text
5. migrar después a frontend más avanzado si conviene
