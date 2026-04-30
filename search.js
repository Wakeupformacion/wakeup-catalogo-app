function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean);
}

const QUERY_ALIASES = {
  agricultura: ['agraria', 'agricola', 'agro'],
  agricola: ['agraria', 'agricultura', 'agro'],
  agro: ['agraria', 'agricultura', 'agricola'],
  'diseno grafico': ['diseno', 'grafico', 'artes graficas'],
  'diseño grafico': ['diseno', 'grafico', 'artes graficas'],
  'diseño gráfico': ['diseno', 'grafico', 'artes graficas'],
  grafico: ['diseno', 'artes graficas'],
  grafica: ['diseno', 'artes graficas'],
  'artes graficas': ['diseno', 'grafico'],
  'artes gráficas': ['diseno', 'grafico'],
};

function expandSearchTerms(query) {
  const normalizedQuery = normalizeText(query);
  const terms = new Set();
  if (!normalizedQuery) return [];

  terms.add(normalizedQuery);
  tokenize(normalizedQuery).forEach((token) => terms.add(token));

  const addAliases = (key) => {
    const aliases = QUERY_ALIASES[key] || [];
    aliases.forEach((alias) => {
      terms.add(normalizeText(alias));
      tokenize(alias).forEach((token) => terms.add(token));
    });
  };

  addAliases(normalizedQuery);
  tokenize(normalizedQuery).forEach(addAliases);

  return Array.from(terms).filter(Boolean);
}

function extractHoursIntent(query) {
  const match = String(query || '').match(/(\d{1,3})\s*horas?/i);
  return match ? parseInt(match[1], 10) : null;
}

function buildSearchWhere({ q, category, maxHours }, values) {
  const where = ['is_active = true'];

  if (category) {
    values.push(category);
    where.push(`category_normalized = $${values.length}`);
  }

  if (Number.isFinite(maxHours)) {
    values.push(maxHours);
    where.push(`hours <= $${values.length}`);
  }

  if (q) {
    const terms = expandSearchTerms(q);
    if (terms.length) {
      const tokenClauses = [];
      for (const term of terms) {
        values.push(`%${term}%`);
        tokenClauses.push(`lower(search_text) like $${values.length}`);
      }
      where.push(`(${tokenClauses.join(' or ')})`);
    }
  }

  return where;
}

function buildRankingExpression(q, values) {
  if (!q) return '0';
  const parts = [];
  const normalizedQuery = normalizeText(q);
  const terms = expandSearchTerms(q);

  values.push(normalizedQuery);
  parts.push(`case when lower(title) like '%' || $${values.length} || '%' then 25 else 0 end`);
  parts.push(`case when lower(category_raw) like '%' || $${values.length} || '%' then 15 else 0 end`);

  for (const term of terms) {
    values.push(term);
    const i = values.length;
    parts.push(`case when lower(title) like '%' || $${i} || '%' then 8 else 0 end`);
    parts.push(`case when lower(category_raw) like '%' || $${i} || '%' then 6 else 0 end`);
    parts.push(`case when lower(search_text) like '%' || $${i} || '%' then 3 else 0 end`);
  }

  return parts.join(' + ') || '0';
}

module.exports = {
  normalizeText,
  tokenize,
  expandSearchTerms,
  extractHoursIntent,
  buildSearchWhere,
  buildRankingExpression,
};
