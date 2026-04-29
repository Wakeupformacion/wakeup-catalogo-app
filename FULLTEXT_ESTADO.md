# Estado full-text search

## Ya preparado
- soporte de `search_vector` en esquema SQL
- índice GIN previsto para rendimiento
- carga de datos que construye `tsvector`
- consultas que pueden usar `ts_rank` cuando PostgreSQL esté activo

## Qué implica
Cuando la base real esté conectada y cargada, el catálogo podrá dar un salto claro en relevancia de búsqueda sin rehacer toda la app.

## Limitación actual
En modo demo sin PostgreSQL no se ejecuta el full-text real; ahí sigue funcionando la heurística textual ya implementada.
