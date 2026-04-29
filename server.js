require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { tokenize, extractHoursIntent, buildSearchWhere, buildRankingExpression } = require('./search');
const { getSampleCourses, getSampleCategories, getFeaturedCategories, getValueProps, getTrustBlocks, getReviewPoints, getFaqDemo, getProcessSteps, getUseCases, getBenefitsStrip, getIntelligenceSignals, getReleasePhases, getOpsChecklist, getHeroBadges, getEmptyStateTips, getCatalogMicrocopy, getCourseHighlights, getDemoNextMilestones, getCtaFooter, getSearchSuggestions } = require('./demo-data');
const { buildCategoryChips } = require('./category-utils');
const { getRelatedCourses } = require('./recommendations');
const { toTsQueryTokens } = require('./fulltext');
const { buildStatus } = require('./status-data');
const { buildCourseNav } = require('./navigation-utils');

async function safeQuery(query, params = []) {
  try {
    return await pool.query(query, params);
  } catch (error) {
    return null;
  }
}

function scoreDemoCourse(course, q) {
  if (!q) return 0;

  const normalizedQ = q.toLowerCase();
  const tokens = tokenize(q);
  const title = String(course.title || '').toLowerCase();
  const category = String(course.category_raw || '').toLowerCase();
  const searchText = String(course.search_text || `${course.title || ''} ${course.category_raw || ''} ${course.course_code || ''}`).toLowerCase();

  let score = 0;
  if (title.includes(normalizedQ)) score += 25;
  if (category.includes(normalizedQ)) score += 15;

  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (category.includes(token)) score += 4;
    if (searchText.includes(token)) score += 2;
  }

  return score;
}

function getDemoCourses({ q, category, maxHours, limit, offset }) {
  const filtered = getSampleCourses()
    .filter((course) => course.is_active !== false)
    .filter((course) => !category || course.category_normalized === category)
    .filter((course) => !Number.isFinite(maxHours) || (course.hours && course.hours <= maxHours))
    .filter((course) => {
      if (!q) return true;
      const haystack = `${course.title || ''} ${course.category_raw || ''} ${course.course_code || ''} ${course.search_text || ''}`.toLowerCase();
      return tokenize(q).every((token) => haystack.includes(token));
    })
    .map((course) => ({
      ...course,
      relevance_score: scoreDemoCourse(course, q),
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score || String(a.title || '').localeCompare(String(b.title || ''), 'es'));

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(__dirname + '/public'));

app.get('/', (_req, res) => {
  res.render('home', {
    featuredCategories: getFeaturedCategories(),
    valueProps: getValueProps(),
    trustBlocks: getTrustBlocks(),
    reviewPoints: getReviewPoints(),
    faqDemo: getFaqDemo(),
    processSteps: getProcessSteps(),
    useCases: getUseCases(),
    benefitsStrip: getBenefitsStrip(),
    intelligenceSignals: getIntelligenceSignals(),
    releasePhases: getReleasePhases(),
    opsChecklist: getOpsChecklist(),
    heroBadges: getHeroBadges(),
    demoNextMilestones: getDemoNextMilestones(),
    ctaFooter: getCtaFooter(),
    searchSuggestions: getSearchSuggestions(),
  }, (err, html) => {
    if (err) return res.status(500).send(err.stack || err.message);
    return res.send(html);
  });
});

app.get('/cursos', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '24', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const category = req.query.category || '';
    const q = (req.query.q || '').trim();
    const maxHours = req.query.maxHours ? parseInt(req.query.maxHours, 10) : extractHoursIntent(q);

    const values = [];
    const useFullText = Boolean(q && q.trim());
    const where = buildSearchWhere({ q: useFullText ? '' : q, category, maxHours }, values);
    let ranking = buildRankingExpression(q, values);

    if (useFullText) {
      const tsQuery = toTsQueryTokens(q);
      if (tsQuery) {
        values.push(tsQuery);
        where.push(`search_vector @@ to_tsquery('simple', $${values.length})`);
        ranking = `ts_rank(search_vector, to_tsquery('simple', $${values.length})) * 100`;
      }
    }

    values.push(limit);
    values.push(offset);

    const sql = `
      select id, course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url,
             ${ranking} as relevance_score
      from courses
      where ${where.join(' and ')}
      order by relevance_score desc, title asc
      limit $${values.length - 1}
      offset $${values.length}
    `;

    const result = await safeQuery(sql, values);
    const demoResult = result ? null : getDemoCourses({ q, category, maxHours, limit, offset });
    const items = result ? result.rows : demoResult.items;
    let categories = [];
    const categoryResult = await safeQuery(`
      select category_normalized, min(category_raw) as category_label, count(*)::int as total
      from courses
      where is_active = true
      group by category_normalized
      order by total desc, category_label asc
    `);
    categories = categoryResult ? categoryResult.rows : getSampleCategories();
    const topCategories = categories.slice(0, 8);

    const hasPrev = offset > 0;
    const nextOffset = offset + limit;
    const prevOffset = Math.max(offset - limit, 0);

    res.render('courses', {
      items,
      q,
      category,
      maxHours: Number.isFinite(maxHours) ? String(maxHours) : '',
      limit,
      offset,
      usingDemoData: !result,
      categoryChips: buildCategoryChips(topCategories, category),
      allCategories: categories,
      hasPrev,
      nextOffset,
      prevOffset,
      emptyStateTips: getEmptyStateTips(),
      catalogMicrocopy: getCatalogMicrocopy(),
      searchSuggestions: getSearchSuggestions(),
      encodeURIComponent,
    }, (err, html) => {
      if (err) return res.status(500).send(err.stack || err.message);
      return res.send(html);
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/estado-demo', async (_req, res) => {
  const dbCheck = await safeQuery('select 1 as ok');
  return res.render('status', {
    status: buildStatus({ dbConnected: Boolean(dbCheck) }),
  });
});

app.get('/cursos/:slug', async (req, res) => {
  try {
    const result = await safeQuery(
      `select id, course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url, search_text
       from courses where slug = $1 and is_active = true limit 1`,
      [req.params.slug]
    );
    const course = result?.rows?.[0] || getSampleCourses().find((item) => item.slug === req.params.slug);
    if (!course) {
      return res.status(404).send('Curso no encontrado');
    }

    const relatedResult = await safeQuery(
      `select id, course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url
       from courses
       where is_active = true and category_normalized = $1 and slug <> $2
       order by title asc
       limit 12`,
      [course.category_normalized, course.slug]
    );
    const relatedPool = relatedResult ? relatedResult.rows : getSampleCourses();
    const relatedCourses = getRelatedCourses(course, relatedPool, 3);
    const navPool = relatedResult ? [course, ...relatedResult.rows] : getSampleCourses();
    const courseNav = buildCourseNav(course.slug, navPool);

    return res.render('course-detail', {
      course,
      usingDemoData: !result,
      relatedCourses,
      courseNav,
      catalogMicrocopy: getCatalogMicrocopy(),
      courseHighlights: getCourseHighlights(),
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.get('/health', async (_req, res) => {
  const result = await safeQuery('select now() as now');
  return res.json({
    ok: true,
    app: 'up',
    dbConnected: Boolean(result),
    mode: result ? 'database' : 'fallback',
    time: result?.rows?.[0]?.now || new Date().toISOString(),
  });
});

app.get('/api/courses', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const category = req.query.category || null;
    const q = (req.query.q || '').trim();
    const maxHours = req.query.maxHours ? parseInt(req.query.maxHours, 10) : extractHoursIntent(q);

    const values = [];
    const useFullText = Boolean(q && q.trim());
    const where = buildSearchWhere({ q: useFullText ? '' : q, category, maxHours }, values);
    let ranking = buildRankingExpression(q, values);

    if (useFullText) {
      const tsQuery = toTsQueryTokens(q);
      if (tsQuery) {
        values.push(tsQuery);
        where.push(`search_vector @@ to_tsquery('simple', $${values.length})`);
        ranking = `ts_rank(search_vector, to_tsquery('simple', $${values.length})) * 100`;
      }
    }

    values.push(limit);
    values.push(offset);

    const sql = `
      select
        id,
        course_code,
        title,
        slug,
        category_raw,
        category_normalized,
        hours,
        delivery_mode,
        detail_url,
        ${ranking} as relevance_score
      from courses
      where ${where.join(' and ')}
      order by relevance_score desc, title asc
      limit $${values.length - 1}
      offset $${values.length}
    `;

    const result = await safeQuery(sql, values);
    const demoResult = result ? null : getDemoCourses({ q, category, maxHours, limit, offset });
    const items = result ? result.rows : demoResult.items;
    res.json({
      items,
      limit,
      offset,
      q,
      category,
      maxHours,
      usingDemoData: !result,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/courses/:slug', async (req, res) => {
  try {
    const result = await safeQuery(
      `select id, course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url, search_text
       from courses where slug = $1 and is_active = true limit 1`,
      [req.params.slug]
    );
    const course = result?.rows?.[0] || getSampleCourses().find((item) => item.slug === req.params.slug);
    if (!course) {
      return res.status(404).json({ ok: false, error: 'Course not found' });
    }
    return res.json({ ...course, usingDemoData: !result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const result = await safeQuery(`
      select category_normalized, min(category_raw) as category_label, count(*)::int as total
      from courses
      where is_active = true
      group by category_normalized
      order by category_label asc
    `);
    res.json({ items: result ? result.rows : getSampleCategories(), usingDemoData: !result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const port = parseInt(process.env.PORT || '3001', 10);
app.listen(port, () => {
  console.log(`WakeUp catálogo API listening on http://localhost:${port}`);
});
