function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
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
    const tokens = tokenize(q);
    if (tokens.length) {
      const tokenClauses = [];
      for (const token of tokens) {
        values.push(`%${token}%`);
        tokenClauses.push(`lower(search_text) like $${values.length}`);
      }
      where.push(`(${tokenClauses.join(' or ')})`);
    }
  }

  return where;
}

function buildRankingExpression(q, values) {
  if (!q) return '0';
  const tokens = tokenize(q);
  const parts = [];

  values.push(q.toLowerCase());
  parts.push(`case when lower(title) like '%' || $${values.length} || '%' then 25 else 0 end`);
  parts.push(`case when lower(category_raw) like '%' || $${values.length} || '%' then 15 else 0 end`);

  for (const token of tokens) {
    values.push(token);
    const i = values.length;
    parts.push(`case when lower(title) like '%' || $${i} || '%' then 8 else 0 end`);
    parts.push(`case when lower(category_raw) like '%' || $${i} || '%' then 4 else 0 end`);
    parts.push(`case when lower(search_text) like '%' || $${i} || '%' then 2 else 0 end`);
  }

  return parts.join(' + ') || '0';
}

module.exports = {
  tokenize,
  extractHoursIntent,
  buildSearchWhere,
  buildRankingExpression,
};
