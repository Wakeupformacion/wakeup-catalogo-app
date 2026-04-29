const fs = require('fs');
const path = require('path');

const cache = new Map();

function loadJson(file, { useCache = true } = {}) {
  const resolved = path.resolve(__dirname, file);
  if (useCache && cache.has(resolved)) {
    return cache.get(resolved);
  }

  const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (useCache) {
    cache.set(resolved, data);
  }
  return data;
}

function decorateCourse(item, index) {
  return {
    id: item.id || `sample-${index + 1}`,
    delivery_mode: item.delivery_mode || 'online',
    relevance_score: typeof item.relevance_score === 'number' ? item.relevance_score : 0,
    ...item,
  };
}

function getSampleCourses() {
  try {
    return loadJson('./data/catalog-fallback.json').map(decorateCourse);
  } catch (_error) {
    try {
      return loadJson('../wakeup-catalogo-tecnico/output/courses.json').map(decorateCourse);
    } catch (_nestedError) {
      return loadJson('../wakeup-catalogo-tecnico/output/sample.json').map((item, index) => ({
        id: `sample-${index + 1}`,
        slug: `${item.course_code || 'curso'}-${index + 1}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        category_raw: 'Administración / Contabilidad',
        category_normalized: 'administracion-contabilidad',
        delivery_mode: 'online',
        relevance_score: 50 - index,
        ...item,
      }));
    }
  }
}

function getSampleCategories() {
  try {
    return Array.from(
      getSampleCourses()
        .filter((item) => item.is_active !== false && item.category_normalized)
        .reduce((acc, item) => {
          const current = acc.get(item.category_normalized) || {
            category_normalized: item.category_normalized,
            category_label: item.category_raw || item.category_normalized,
            total: 0,
          };
          current.total += 1;
          acc.set(item.category_normalized, current);
          return acc;
        }, new Map())
        .values()
    )
      .sort((a, b) => b.total - a.total || a.category_label.localeCompare(b.category_label, 'es'));
  } catch (_error) {
    return loadJson('./data/categories.sample.json');
  }
}

function getFeaturedCategories() {
  return loadJson('./data/featured-categories.json');
}

function getValueProps() {
  return loadJson('./data/value-props.json');
}

function getTrustBlocks() {
  return loadJson('./data/trust-blocks.json');
}

function getReviewPoints() {
  return loadJson('./data/review-points.json');
}

function getFaqDemo() {
  return loadJson('./data/faq-demo.json');
}

function getProcessSteps() {
  return loadJson('./data/process-steps.json');
}

function getUseCases() {
  return loadJson('./data/use-cases.json');
}

function getBenefitsStrip() {
  return loadJson('./data/benefits-strip.json');
}

function getIntelligenceSignals() {
  return loadJson('./data/intelligence-signals.json');
}

function getReleasePhases() {
  return loadJson('./data/release-phases.json');
}

function getOpsChecklist() {
  return loadJson('./data/ops-checklist.json');
}

function getHeroBadges() {
  return loadJson('./data/hero-badges.json');
}

function getEmptyStateTips() {
  return loadJson('./data/empty-state-tips.json');
}

function getCatalogMicrocopy() {
  return loadJson('./data/catalog-microcopy.json');
}

function getCourseHighlights() {
  return loadJson('./data/course-highlights.json');
}

function getDemoNextMilestones() {
  return loadJson('./data/demo-next-milestones.json');
}

function getCtaFooter() {
  return loadJson('./data/cta-footer.json');
}

function getSearchSuggestions() {
  return loadJson('./data/search-suggestions.json');
}

module.exports = {
  getSampleCourses,
  getSampleCategories,
  getFeaturedCategories,
  getValueProps,
  getTrustBlocks,
  getReviewPoints,
  getFaqDemo,
  getProcessSteps,
  getUseCases,
  getBenefitsStrip,
  getIntelligenceSignals,
  getReleasePhases,
  getOpsChecklist,
  getHeroBadges,
  getEmptyStateTips,
  getCatalogMicrocopy,
  getCourseHighlights,
  getDemoNextMilestones,
  getCtaFooter,
  getSearchSuggestions,
};
