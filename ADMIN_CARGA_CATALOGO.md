# Requisito pendiente · acceso administrador para carga de catálogo

## Objetivo
La web debe incluir un acceso de tipo **administrador** protegido con **usuario y contraseña**.

## Para qué sirve
Permitir la **carga/actualización del catálogo** sin exponer esa función al público.

## Alcance esperado
- login de administrador
- área privada o ruta protegida
- opción de cargar el origen del catálogo
- flujo para importar/actualizar datos desde el fichero del catálogo
- ejecución segura del proceso de carga hacia la base de datos del catálogo

## Nota funcional
Esta capacidad es interna y no debe aparecer en la navegación pública orientada a cliente.

## Siguiente implementación recomendada
1. definir credenciales/estrategia de autenticación
2. crear ruta protegida `/admin`
3. añadir formulario de subida/importación
4. conectar con el flujo de carga del catálogo
5. registrar validaciones y errores de importación
