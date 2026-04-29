# Buscador inteligente · base implementada

## Enfoque actual
Se implementa una primera capa de "inteligencia útil" sin depender todavía de embeddings ni proveedores externos.

## Qué añade esta fase
- tokenización de consulta
- normalización básica
- detección simple de intención por horas (`20 horas`, `40 horas`, etc.)
- ranking textual por relevancia
- ponderación mayor en título y categoría
- soporte para filtros combinados

## Ventaja
Esto permite una v1 razonable que ya mejora bastante un buscador plano por coincidencia exacta.

## Limitación
Todavía no es búsqueda semántica real. No entiende significados profundos ni sinónimos complejos como lo haría una capa de embeddings/IA.

## Evolución prevista
### Fase siguiente
- PostgreSQL full-text (`tsvector` + ranking)
- diccionario de sinónimos comerciales
- normalización avanzada de categorías

### Fase IA
- embeddings por curso
- embeddings por consulta del usuario
- búsqueda vectorial con pgvector
- recomendación semántica de cursos relacionados

## Ejemplos de mejora esperable
Consulta:
- `curso contabilidad 20 horas`

Capacidad actual:
- detecta tokens `curso`, `contabilidad`, `20`, `horas`
- puede priorizar cursos de contabilidad
- puede aplicar límite de horas si se expone como filtro/intención

## Objetivo
Acercar el catálogo a una experiencia de búsqueda más inteligente desde ya, sin esperar a la fase IA completa.
