# Demo local completa con Docker Compose

## Objetivo
Levantar una demo más cercana a entorno real con:
- app Node
- PostgreSQL
- carga automática del catálogo

## Arranque esperado
Desde `wakeup-catalogo-app/`:

```bash
docker compose up --build
```

## Qué hace
1. arranca PostgreSQL
2. espera a que la base responda
3. ejecuta la carga de cursos
4. levanta la app en `http://localhost:3001`

## Ventaja
Acerca mucho el proyecto a una revisión real sin tener que montar manualmente todos los pasos por separado.

## Nota
Si la base no está disponible, `boot.js` permite seguir arrancando en modo demo.
