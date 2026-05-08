require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { randomUUID } = require('crypto');
const { pool } = require('./db');
const { normalizeText, expandSearchTerms, extractHoursIntent, buildSearchWhere, buildRankingExpression } = require('./search');
const { getSampleCourses, getSampleCategories, getFeaturedCategories, getValueProps, getTrustBlocks, getReviewPoints, getFaqDemo, getProcessSteps, getUseCases, getBenefitsStrip, getIntelligenceSignals, getReleasePhases, getOpsChecklist, getHeroBadges, getEmptyStateTips, getCatalogMicrocopy, getCourseHighlights, getDemoNextMilestones, getCtaFooter, getSearchSuggestions } = require('./demo-data');
const { buildCategoryChips } = require('./category-utils');
const { getRelatedCourses } = require('./recommendations');
const { toTsQueryTokens } = require('./fulltext');
const { buildCourseNav } = require('./navigation-utils');
const { uploadsDir, ensureUploadsDir, parseCookies, createAdminSession, verifyAdminSession, getAdminAuthConfig, normalizeCourseInput, buildSearchText, readFallbackCourses, writeFallbackCourses, parseDelimitedText, parseExcelFile } = require('./admin-utils');

const appBaseUrl = (process.env.APP_BASE_URL || 'https://wakeup-catalogo-app.onrender.com').replace(/\/$/, '');
const BUDGET_RATE_PER_HOUR = 8.25;

function buildPageMeta({ title, description, path: pagePath = '/', image = '/WakeUpLogo.png', type = 'website' }) {
  return {
    title,
    description,
    canonicalUrl: `${appBaseUrl}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`,
    imageUrl: image.startsWith('http') ? image : `${appBaseUrl}${image.startsWith('/') ? image : `/${image}`}`,
    type,
  };
}

async function safeQuery(query, params = []) {
  try {
    return await pool.query(query, params);
  } catch (_error) {
    return null;
  }
}

function formatBudgetCurrency(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function buildSelectedCoursesFromRequest(rawCourses) {
  const selected = Array.isArray(rawCourses)
    ? rawCourses
    : rawCourses
      ? [rawCourses]
      : [];

  return Array.from(new Set(selected.filter(Boolean)));
}

function buildSelectedCoursesQuery(selectedCourses = []) {
  const params = new URLSearchParams();
  selectedCourses.forEach((slug) => {
    if (slug) params.append('courses', slug);
  });
  return params.toString();
}

async function getBudgetItems(selectedSlugs) {
  const result = await safeQuery(
    `select id, course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url
     from courses
     where is_active = true and slug = any($1::text[])
     order by title asc`,
    [selectedSlugs]
  );

  const fallbackItems = getSampleCourses()
    .filter((item) => selectedSlugs.includes(item.slug))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es'));

  const items = result ? result.rows : fallbackItems;

  return items.map((item) => {
    const hours = Number(item.hours) || 0;
    const amount = hours * BUDGET_RATE_PER_HOUR;
    return {
      ...item,
      hours,
      amount,
    };
  });
}

function collectCompanyData(source = {}) {
  return {
    companyName: (source.companyName || '').trim(),
    contactName: (source.contactName || '').trim(),
    email: (source.email || '').trim(),
    phone: (source.phone || '').trim(),
  };
}

function scoreDemoCourse(course, q) {
  if (!q) return 0;
  const normalizedQ = normalizeText(q);
  const terms = expandSearchTerms(q);
  const title = normalizeText(course.title || '');
  const category = normalizeText(course.category_raw || '');
  const searchText = normalizeText(course.search_text || `${course.title || ''} ${course.category_raw || ''} ${course.course_code || ''}`);

  let score = 0;
  if (title.includes(normalizedQ)) score += 25;
  if (category.includes(normalizedQ)) score += 20;
  if (searchText.includes(normalizedQ)) score += 10;

  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (category.includes(term)) score += 6;
    if (searchText.includes(term)) score += 3;
  }

  return score;
}

function getDemoCourses({ q, category, maxHours, limit, offset }) {
  const filtered = getSampleCourses()
    .filter((course) => course.is_active !== false)
    .filter((course) => !category || course.category_normalized === category)
    .filter((course) => !Number.isFinite(maxHours) || (course.hours && course.hours <= maxHours))
    .map((course) => ({ ...course, relevance_score: scoreDemoCourse(course, q) }))
    .filter((course) => !q || course.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score || String(a.title || '').localeCompare(String(b.title || ''), 'es'));

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

function setFlash(res, message) {
  res.setHeader('Set-Cookie', `admin_flash=${encodeURIComponent(message)}; Path=/; HttpOnly; SameSite=Lax`);
}

function clearFlash(req, res) {
  const message = req.cookies.admin_flash ? decodeURIComponent(req.cookies.admin_flash) : '';
  if (req.cookies.admin_flash) {
    res.append('Set-Cookie', 'admin_flash=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  }
  return message;
}

function requireAdmin(req, res, next) {
  const config = getAdminAuthConfig();
  const username = verifyAdminSession(req.cookies.admin_session, config.secret);
  if (!username) return res.redirect('/admin');
  req.adminUser = username;
  next();
}

async function safeAdminUpsertCourse(course, existingSlug = null) {
  const searchText = buildSearchText(course);
  const result = await safeQuery('select id from courses where slug = $1 limit 1', [existingSlug || course.slug]);
  if (!result) return false;

  if (result.rows.length) {
    await pool.query(
      `update courses set
        course_code = $2,
        title = $3,
        title_normalized = $4,
        slug = $5,
        category_raw = $6,
        category_normalized = $7,
        hours = $8,
        delivery_mode = $9,
        detail_url = $10,
        language = $11,
        is_active = $12,
        search_text = $13,
        search_vector =
          setweight(to_tsvector('simple', coalesce($3, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce($6, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce($13, '')), 'C'),
        updated_at = now()
      where slug = $1`,
      [existingSlug || course.slug, course.course_code, course.title, course.title_normalized, course.slug, course.category_raw, course.category_normalized, course.hours, course.delivery_mode, course.detail_url, course.language, course.is_active, searchText]
    );
  } else {
    await pool.query(
      `insert into courses (
        id, source_file, source_sheet, source_row_number, import_batch_id,
        course_code, title, title_normalized, slug,
        category_raw, category_normalized, hours, delivery_mode,
        detail_url, language, is_active, search_text, search_vector, embedding_status
      ) values (
        $1, 'admin-manual', 'manual', 0, null,
        $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        setweight(to_tsvector('simple', coalesce($3, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce($6, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce($13, '')), 'C'),
        'pending'
      )`,
      [randomUUID(), course.course_code, course.title, course.title_normalized, course.slug, course.category_raw, course.category_normalized, course.hours, course.delivery_mode, course.detail_url, course.language, course.is_active, searchText]
    );
  }

  return true;
}

function upsertFallbackCourse(course, existingSlug = null) {
  const items = readFallbackCourses();
  const idx = items.findIndex((item) => item.slug === (existingSlug || course.slug));
  const nextItem = { ...items[idx], ...course, search_text: buildSearchText(course) };
  if (idx >= 0) items[idx] = nextItem;
  else items.unshift(nextItem);
  writeFallbackCourses(items);
}

function deleteFallbackCourse(slug) {
  const items = readFallbackCourses().filter((item) => item.slug !== slug);
  writeFallbackCourses(items);
}

const app = express();
ensureUploadsDir();
const upload = multer({ dest: uploadsDir });
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  req.cookies = parseCookies(req.headers.cookie || '');
  next();
});
app.use(express.static(__dirname + '/public'));

app.get('/', async (_req, res) => {
  const categoryResult = await safeQuery(`
    select category_normalized, min(category_raw) as category_label, count(*)::int as total
    from courses
    where is_active = true
    group by category_normalized
    order by category_label asc
  `);
  const allCategories = categoryResult ? categoryResult.rows : getSampleCategories();

  res.render('home', {
    pageMeta: buildPageMeta({
      title: 'WakeUp · Catálogo online',
      description: 'Explora el catálogo online de WakeUp: cursos, categorías y acceso claro a la ficha de cada formación.',
      path: '/',
    }),
    featuredCategories: getFeaturedCategories(),
    allCategories,
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
    const categoryResult = await safeQuery(`
      select category_normalized, min(category_raw) as category_label, count(*)::int as total
      from courses
      where is_active = true
      group by category_normalized
      order by total desc, category_label asc
    `);
    const categories = categoryResult ? categoryResult.rows : getSampleCategories();
    const topCategories = categories.slice(0, 8);
    const activeCategoryLabel = categories.find((item) => item.category_normalized === category)?.category_label || '';

    const hasPrev = offset > 0;
    const nextOffset = offset + limit;
    const prevOffset = Math.max(offset - limit, 0);

    res.render('courses', {
      pageMeta: buildPageMeta({
        title: category ? `Catálogo · ${activeCategoryLabel || 'WakeUp'}` : 'Catálogo · WakeUp',
        description: q
          ? `Resultados del catálogo WakeUp para ${q}. Explora cursos online y filtra por categoría o duración.`
          : 'Explora el catálogo WakeUp y encuentra cursos online por temática, categoría y horas.',
        path: `/cursos${req.originalUrl.includes('?') ? req.originalUrl.slice('/cursos'.length) : ''}`,
      }),
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

app.get('/estado-demo', (_req, res) => res.redirect('/cursos'));

app.get('/cursos/:slug', async (req, res) => {
  try {
    const result = await safeQuery(
      `select id, course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url, search_text
       from courses where slug = $1 and is_active = true limit 1`,
      [req.params.slug]
    );
    const course = result?.rows?.[0] || getSampleCourses().find((item) => item.slug === req.params.slug);
    if (!course) return res.status(404).send('Curso no encontrado');

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
      pageMeta: buildPageMeta({
        title: `${course.title} · WakeUp`,
        description: `${course.title}. Curso online de ${course.category_raw || 'formación online'} con ${course.hours || 'duración variable'} horas en el catálogo WakeUp.`,
        path: `/cursos/${course.slug}`,
        type: 'article',
      }),
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

app.get('/admin', (req, res) => {
  const flash = clearFlash(req, res);
  return res.render('admin-login', {
    error: flash && flash.startsWith('ERROR:') ? flash.replace(/^ERROR:\s*/, '') : '',
  });
});

app.post('/admin/login', (req, res) => {
  const config = getAdminAuthConfig();
  const { username, password } = req.body;
  if (!config.password) return res.status(500).send('Configura ADMIN_USERNAME y ADMIN_PASSWORD para habilitar el admin.');
  if (username !== config.username || password !== config.password) {
    setFlash(res, 'ERROR: Credenciales incorrectas.');
    return res.redirect('/admin');
  }
  const token = createAdminSession(username, config.secret);
  res.append('Set-Cookie', `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
  return res.redirect('/admin/dashboard');
});

app.post('/admin/logout', (_req, res) => {
  res.append('Set-Cookie', 'admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res.redirect('/admin');
});

app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const perPage = 50;
  const offset = (page - 1) * perPage;
  const flash = clearFlash(req, res);
  const adminQuery = String(req.query.q || '').trim();

  const result = adminQuery
    ? await safeQuery(`
        select course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url, language, is_active
        from courses
        where title ilike $1 or course_code ilike $1 or coalesce(category_raw, '') ilike $1
        order by title asc
        limit $2 offset $3
      `, [`%${adminQuery}%`, perPage, offset])
    : await safeQuery(`
        select course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url, language, is_active
        from courses
        order by title asc
        limit $1 offset $2
      `, [perPage, offset]);

  let stats;
  let courses;
  let totalPages = 1;

  if (result) {
    courses = result.rows;
    const statsResult = adminQuery
      ? await safeQuery(`
          select
            count(*)::int as total,
            count(*) filter (where is_active = true)::int as active,
            count(*) filter (where is_active = false)::int as inactive,
            count(*) filter (where detail_url is not null and detail_url <> '')::int as with_detail_url
          from courses
          where title ilike $1 or course_code ilike $1 or coalesce(category_raw, '') ilike $1
        `, [`%${adminQuery}%`])
      : await safeQuery(`
          select
            count(*)::int as total,
            count(*) filter (where is_active = true)::int as active,
            count(*) filter (where is_active = false)::int as inactive,
            count(*) filter (where detail_url is not null and detail_url <> '')::int as with_detail_url
          from courses
        `);
    stats = statsResult?.rows?.[0]
      ? {
          total: statsResult.rows[0].total,
          active: statsResult.rows[0].active,
          inactive: statsResult.rows[0].inactive,
          withDetailUrl: statsResult.rows[0].with_detail_url,
        }
      : {
          total: courses.length,
          active: courses.filter((item) => item.is_active !== false).length,
          inactive: courses.filter((item) => item.is_active === false).length,
          withDetailUrl: courses.filter((item) => item.detail_url).length,
        };
    totalPages = Math.max(Math.ceil(stats.total / perPage), 1);
  } else {
    const fallbackAll = readFallbackCourses().sort((a, b) => String(a.title).localeCompare(String(b.title), 'es'));
    const fallbackCourses = adminQuery
      ? fallbackAll.filter((item) => [item.title, item.course_code, item.category_raw].filter(Boolean).join(' ').toLowerCase().includes(adminQuery.toLowerCase()))
      : fallbackAll;
    courses = fallbackCourses.slice(offset, offset + perPage);
    stats = {
      total: fallbackCourses.length,
      active: fallbackCourses.filter((item) => item.is_active !== false).length,
      inactive: fallbackCourses.filter((item) => item.is_active === false).length,
      withDetailUrl: fallbackCourses.filter((item) => item.detail_url).length,
    };
    totalPages = Math.max(Math.ceil(stats.total / perPage), 1);
  }

  return res.render('admin-dashboard', {
    courses,
    stats,
    currentPage: page,
    totalPages,
    perPage,
    adminQuery,
    usingDemoData: !result,
    flash: flash && !flash.startsWith('ERROR:') ? flash : '',
    error: flash && flash.startsWith('ERROR:') ? flash.replace(/^ERROR:\s*/, '') : '',
  });
});

app.post('/admin/courses', requireAdmin, async (req, res) => {
  try {
    const course = normalizeCourseInput(req.body);
    if (!course.title || !course.course_code || !course.category_raw) {
      setFlash(res, 'ERROR: Completa código, título y categoría.');
      return res.redirect('/admin/dashboard');
    }
    const ok = await safeAdminUpsertCourse(course);
    if (!ok) upsertFallbackCourse(course);
    setFlash(res, 'Curso creado correctamente.');
    return res.redirect('/admin/dashboard');
  } catch (error) {
    setFlash(res, `ERROR: ${error.message}`);
    return res.redirect('/admin/dashboard');
  }
});

app.post('/admin/courses/:slug', requireAdmin, async (req, res) => {
  try {
    const course = normalizeCourseInput(req.body, { slug: req.params.slug });
    const ok = await safeAdminUpsertCourse(course, req.params.slug);
    if (!ok) upsertFallbackCourse(course, req.params.slug);
    setFlash(res, 'Curso actualizado.');
    return res.redirect('/admin/dashboard');
  } catch (error) {
    setFlash(res, `ERROR: ${error.message}`);
    return res.redirect('/admin/dashboard');
  }
});

app.post('/admin/courses/:slug/delete', requireAdmin, async (req, res) => {
  try {
    const deleted = await safeQuery('delete from courses where slug = $1', [req.params.slug]);
    if (!deleted) deleteFallbackCourse(req.params.slug);
    setFlash(res, 'Curso eliminado.');
    return res.redirect('/admin/dashboard');
  } catch (error) {
    setFlash(res, `ERROR: ${error.message}`);
    return res.redirect('/admin/dashboard');
  }
});

app.post('/admin/import', requireAdmin, upload.single('catalogFile'), async (req, res) => {
  try {
    if (!req.file) {
      setFlash(res, 'ERROR: Debes adjuntar un fichero.');
      return res.redirect('/admin/dashboard');
    }
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    const rows = ext === '.xlsx'
      ? parseExcelFile(req.file.path)
      : parseDelimitedText(fs.readFileSync(req.file.path, 'utf8'));
    fs.unlinkSync(req.file.path);
    if (!rows.length) {
      setFlash(res, 'ERROR: No se encontraron filas en el fichero.');
      return res.redirect('/admin/dashboard');
    }
    let imported = 0;
    let skipped = 0;
    const warnings = [];
    for (const [index, row] of rows.entries()) {
      const course = normalizeCourseInput({
        course_code: row.course_code || row.codigo || row.code,
        title: row.title || row.titulo,
        category_raw: row.category_raw || row.categoria || row.category,
        hours: row.hours || row.horas,
        delivery_mode: row.delivery_mode || row.modalidad,
        detail_url: row.detail_url || row.url || row.enlace,
        is_active: String(row.is_active || row.activo || 'true').toLowerCase() !== 'false',
      });
      if (!course.title || !course.course_code) {
        skipped += 1;
        if (warnings.length < 5) warnings.push(`fila ${index + 2}: faltan código o título`);
        continue;
      }
      const ok = await safeAdminUpsertCourse(course);
      if (!ok) upsertFallbackCourse(course);
      imported += 1;
    }
    const warningText = warnings.length ? ` Avisos: ${warnings.join('; ')}${skipped > warnings.length ? '; ...' : ''}` : '';
    setFlash(res, `Importación completada: ${imported} cursos procesados, ${skipped} omitidos.${warningText}`);
    return res.redirect('/admin/dashboard');
  } catch (error) {
    setFlash(res, `ERROR: ${error.message}`);
    return res.redirect('/admin/dashboard');
  }
});

app.get('/admin/export.json', requireAdmin, async (_req, res) => {
  const result = await safeQuery(`
    select course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url, language, is_active
    from courses
    order by title asc
  `);
  const items = result ? result.rows : readFallbackCourses().sort((a, b) => String(a.title).localeCompare(String(b.title), 'es'));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="wakeup-catalogo-export.json"');
  return res.send(`${JSON.stringify(items, null, 2)}\n`);
});

app.get('/admin/export.csv', requireAdmin, async (_req, res) => {
  const result = await safeQuery(`
    select course_code, title, slug, category_raw, category_normalized, hours, delivery_mode, detail_url, language, is_active
    from courses
    order by title asc
  `);
  const items = result ? result.rows : readFallbackCourses().sort((a, b) => String(a.title).localeCompare(String(b.title), 'es'));
  const headers = ['course_code', 'title', 'slug', 'category_raw', 'category_normalized', 'hours', 'delivery_mode', 'detail_url', 'language', 'is_active'];
  const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(',')]
    .concat(items.map((item) => headers.map((key) => escapeCell(item[key])).join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="wakeup-catalogo-export.csv"');
  return res.send(`${csv}\n`);
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
    res.json({ items, limit, offset, q, category, maxHours, usingDemoData: !result });
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
    if (!course) return res.status(404).json({ ok: false, error: 'Course not found' });
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
app.get('/presupuesto', async (req, res) => {
  try {
    const uniqueSelected = buildSelectedCoursesFromRequest(req.query.courses);
    if (!uniqueSelected.length) return res.redirect('/cursos');

    const items = await getBudgetItems(uniqueSelected);
    if (!items.length) return res.redirect('/cursos');

    const totalHours = items.reduce((sum, item) => sum + item.hours, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const budgetSummary = items.map((item) => `${item.title} (${item.hours}h)`).join(', ');
    const company = collectCompanyData(req.query);

    return res.render('budget-summary', {
      pageMeta: buildPageMeta({
        title: 'Presupuesto generado · WakeUp',
        description: `Resumen de cursos seleccionados y presupuesto estimado para ${budgetSummary}.`,
        path: `/presupuesto${req.originalUrl.includes('?') ? req.originalUrl.slice('/presupuesto'.length) : ''}`,
      }),
      items,
      totalHours,
      totalAmount,
      ratePerHour: BUDGET_RATE_PER_HOUR,
      formattedRate: formatBudgetCurrency(BUDGET_RATE_PER_HOUR),
      formatCurrency: formatBudgetCurrency,
      company,
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.get('/presupuesto/pdf', async (req, res) => {
  try {
    const uniqueSelected = buildSelectedCoursesFromRequest(req.query.courses);
    if (!uniqueSelected.length) return res.redirect('/cursos');

    const items = await getBudgetItems(uniqueSelected);
    if (!items.length) return res.redirect('/cursos');

    const totalHours = items.reduce((sum, item) => sum + item.hours, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const company = collectCompanyData(req.query);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=\"presupuesto-wakeup.pdf\"');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(22).fillColor('#c81e3a').text('Presupuesto WakeUp');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#475569').text(`Tarifa aplicada: ${formatBudgetCurrency(BUDGET_RATE_PER_HOUR)} por hora`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111827').text('Datos de empresa');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#374151');
    doc.text(`Empresa: ${company.companyName || '-'}`);
    doc.text(`Persona de contacto: ${company.contactName || '-'}`);
    doc.text(`Email: ${company.email || '-'}`);
    doc.text(`Teléfono: ${company.phone || '-'}`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111827').text('Cursos seleccionados');
    doc.moveDown(0.5);

    items.forEach((item, index) => {
      doc.fontSize(12).fillColor('#111827').text(`${index + 1}. ${item.title}`);
      doc.fontSize(10).fillColor('#4b5563').text(`${item.category_raw || 'Sin categoría'} · ${item.hours} horas · ${item.delivery_mode}`);
      doc.fontSize(11).fillColor('#c81e3a').text(`Importe: ${formatBudgetCurrency(item.amount)}`);
      doc.moveDown(0.7);
    });

    doc.moveDown(0.4);
    doc.fontSize(13).fillColor('#111827').text(`Total horas: ${totalHours} h`);
    doc.fontSize(18).fillColor('#c81e3a').text(`Importe presupuestado: ${formatBudgetCurrency(totalAmount)}`);
    doc.end();
  } catch (error) {
    return res.status(500).send(error.message);
  }
});
app.listen(port, () => {
  console.log(`WakeUp catálogo API listening on http://localhost:${port}`);
});
