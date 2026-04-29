# Full-text search · preparación

## Objetivo
Dar el siguiente salto en el buscador pasando de coincidencia textual ponderada a búsqueda full-text real en PostgreSQL.

## Qué se prepara
- columna `search_vector` en `courses`
- índice GIN sobre `search_vector`
- generación de `tsvector` a partir de título, categoría y texto de búsqueda
- consultas con `ts_rank`

## Ventaja
- mejora relevancia
- mejor rendimiento en catálogos grandes
- base sólida antes de llegar a embeddings

## Evolución prevista
1. full-text PostgreSQL
2. sinónimos / taxonomía
3. embeddings / vector search
