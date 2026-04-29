function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(' ').filter(Boolean);
}

function scoreCourseSimilarity(baseCourse, candidate) {
  let score = 0;
  if (!baseCourse || !candidate) return score;
  if (baseCourse.course_code === candidate.course_code) return -1;
  if (baseCourse.category_normalized && baseCourse.category_normalized === candidate.category_normalized) score += 30;
  if (baseCourse.hours && candidate.hours) {
    const diff = Math.abs(baseCourse.hours - candidate.hours);
    if (diff <= 10) score += 12;
    else if (diff <= 25) score += 6;
  }
  const baseTokens = new Set(tokenize(baseCourse.title));
  const candidateTokens = tokenize(candidate.title);
  for (const token of candidateTokens) {
    if (baseTokens.has(token)) score += 3;
  }
  return score;
}

function getRelatedCourses(baseCourse, courses, limit = 3) {
  return (courses || [])
    .map((course) => ({ ...course, related_score: scoreCourseSimilarity(baseCourse, course) }))
    .filter((course) => course.related_score > 0)
    .sort((a, b) => b.related_score - a.related_score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

module.exports = {
  getRelatedCourses,
};
