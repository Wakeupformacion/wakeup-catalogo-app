function buildSemanticCandidateText(course) {
  return [
    course.title,
    course.category_raw,
    course.search_text,
    'formacion online',
  ]
    .filter(Boolean)
    .join('. ');
}

function buildUserNeedText(query, opts = {}) {
  return [
    query,
    opts.maxHours ? `maximo ${opts.maxHours} horas` : null,
    opts.categoryLabel || null,
    'busqueda de formacion online',
  ]
    .filter(Boolean)
    .join('. ');
}

module.exports = {
  buildSemanticCandidateText,
  buildUserNeedText,
};
