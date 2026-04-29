const { getSampleCourses } = require('./demo-data');

function buildStatus({ dbConnected = false } = {}) {
  const fallbackCount = getSampleCourses().length;
  return {
    mode: dbConnected ? 'Conectado a base de datos' : 'Demo / fallback',
    modeDescription: dbConnected
      ? 'La app está usando la base de datos y el catálogo persistido.'
      : 'La app puede funcionar con el catálogo importado en fallback mientras la base real no está disponible.',
    courseCount: dbConnected ? 'Catálogo real' : fallbackCount,
    courseCountDescription: dbConnected
      ? 'El volumen dependerá de la carga real importada en PostgreSQL.'
      : 'Catálogo importado reutilizado para revisión visual y funcional sin depender aún de PostgreSQL.',
    searchMode: dbConnected ? 'Full-text / relevancia híbrida preparada' : 'Relevancia heurística + fallback real',
    searchDescription: dbConnected
      ? 'La base está lista para aprovechar búsqueda real sobre PostgreSQL.'
      : 'La demo sigue permitiendo navegación, filtros y descubrimiento sobre el catálogo importado real.',
    items: [
      'Importación del Excel planteada y validada.',
      'Conservación del enlace oficial de contenidos y objetivos.',
      'Catálogo web navegable con detalle de curso.',
      'Filtros, categorías y relacionados activos.',
      'Arquitectura preparada para despliegue y evolución inteligente.',
    ],
  };
}

module.exports = {
  buildStatus,
};
