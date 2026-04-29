# Embeddings / búsqueda semántica · plan base

## Objetivo
Permitir que el usuario escriba necesidades formativas en lenguaje natural y reciba cursos relevantes aunque no coincidan literalmente las palabras.

## Enfoque previsto
1. generar embedding por curso
2. generar embedding por consulta del usuario
3. comparar similitud vectorial
4. devolver cursos por afinidad semántica

## Qué campos pueden alimentar el embedding
- título del curso
- categoría
- `search_text`
- futuros contenidos y objetivos si se incorporan

## Estrategia recomendada
### Fase 1
- mantener full-text como fallback
- añadir columna vectorial en PostgreSQL (`pgvector`)
- generar embeddings por lote tras importación

### Fase 2
- combinar full-text + vector similarity
- reranking híbrido

### Fase 3
- recomendador conversacional
- refinamiento por intención del usuario

## Ventaja
Este enfoque encaja muy bien con un catálogo grande de formación online.
