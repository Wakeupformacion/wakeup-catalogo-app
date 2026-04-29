# Nota sobre acceso local

## Qué ha pasado
El servidor puede arrancar dentro del entorno de trabajo, pero `localhost` no necesariamente es visible desde el navegador del usuario si no comparten el mismo host/red.

## Qué significa
- la app puede estar viva internamente
- el usuario aún puede ver `ERR_CONNECTION_REFUSED` desde su máquina

## Conclusión
Para una revisión real por navegador del usuario hace falta:
- despliegue público
- o compartir el mismo host local
