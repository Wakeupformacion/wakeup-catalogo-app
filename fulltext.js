function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTsQueryTokens(query) {
  return normalizeText(query)
    .split(' ')
    .filter(Boolean)
    .map((token) => `${token}:*`)
    .join(' & ');
}

module.exports = {
  normalizeText,
  toTsQueryTokens,
};
