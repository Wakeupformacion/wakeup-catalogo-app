const targets = [
  { path: '/health', expectJson: { ok: true, app: 'up' } },
  { path: '/', expect: ['Catálogo Inteligente', 'Pruebas rápidas'] },
  { path: '/cursos', expect: ['Catálogo de cursos online', 'cursos mostrados'] },
  { path: '/estado-demo', expect: ['Estado de la demo', 'Qué está operativo ahora mismo'] },
  { path: '/api/courses?limit=2&category=marketing', expectJson: { usingDemoData: true, minItems: 1 } },
  { path: '/api/categories', expectJson: { usingDemoData: true, minItems: 1 } },
];

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001';

async function checkTarget(target) {
  const url = `${baseUrl}${target.path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${target.path} devolvió ${response.status}`);
  }

  const text = await response.text();

  if (target.expect) {
    for (const snippet of target.expect) {
      if (!text.includes(snippet)) {
        throw new Error(`${target.path} no contiene: ${snippet}`);
      }
    }
    return;
  }

  if (target.expectJson) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`${target.path} no devolvió JSON válido`);
    }

    if (typeof target.expectJson.ok === 'boolean' && payload.ok !== target.expectJson.ok) {
      throw new Error(`${target.path} ok esperado=${target.expectJson.ok} actual=${payload.ok}`);
    }

    if (typeof target.expectJson.app === 'string' && payload.app !== target.expectJson.app) {
      throw new Error(`${target.path} app esperado=${target.expectJson.app} actual=${payload.app}`);
    }

    if (typeof target.expectJson.usingDemoData === 'boolean' && payload.usingDemoData !== target.expectJson.usingDemoData) {
      throw new Error(`${target.path} usingDemoData esperado=${target.expectJson.usingDemoData} actual=${payload.usingDemoData}`);
    }

    if (typeof target.expectJson.minItems === 'number') {
      const items = Array.isArray(payload.items) ? payload.items.length : 0;
      if (items < target.expectJson.minItems) {
        throw new Error(`${target.path} devolvió ${items} items; mínimo esperado ${target.expectJson.minItems}`);
      }
    }
  }
}

(async () => {
  for (const target of targets) {
    await checkTarget(target);
    console.log(`OK ${target.path}`);
  }
  console.log(`Smoke test OK sobre ${baseUrl}`);
})().catch((error) => {
  console.error(`Smoke test FAILED: ${error.message}`);
  process.exit(1);
});
