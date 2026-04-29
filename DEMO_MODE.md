# Modo demo

## Objetivo
Permitir ver la web aunque PostgreSQL aún no esté conectada.

## Cómo funciona
Si las consultas a base de datos fallan:
- `/cursos` usa el catálogo importado como fallback
- `/cursos/:slug` intenta resolver con ese catálogo importado
- `/api/courses` responde también con fallback real
- `/api/categories` calcula categorías desde el catálogo importado

## Ventaja
Esto permite revisar:
- estructura visual
- navegación
- botones de contenidos y objetivos
- flujo general del catálogo
- filtros y categorías con datos mucho más representativos

## Limitación
No sustituye la carga real del catálogo completo en PostgreSQL. Es un puente útil para demo, revisión y publicación inicial.
