# Despliegue rápido en Render

## Qué permite
Publicar una demo web del catálogo con una URL pública temporal.

## Pasos
1. subir `wakeup-catalogo-app/` a un repositorio Git
2. crear servicio web en Render
3. usar el archivo `render.yaml` o configurar manualmente:
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`
4. dejar `DATABASE_URL` sin configurar si quieres publicar primero la demo
5. añadir `DATABASE_URL` cuando PostgreSQL real esté disponible

## Comportamiento actual
- `npm start` lanza `boot.js`
- el build usa `npm ci` para ser más reproducible en despliegue
- Render puede vigilar `/health` como comprobación simple de servicio
- si hay base de datos accesible, intenta cargar cursos y luego arranca
- si no hay base de datos, sigue sirviendo la demo con catálogo importado real
- la carpeta ya es autocontenida para publicar la demo sin depender de `../wakeup-catalogo-tecnico/`
- Render debe usar su `PORT` dinámico, por eso no conviene fijarlo manualmente allí

## Ventaja
Es la forma más rápida de obtener una URL pública revisable sin bloquearse por completo en la base de datos.
