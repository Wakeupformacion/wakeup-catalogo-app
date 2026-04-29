require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const { pool } = require('./db');

const schemaPath = path.resolve(__dirname, '../wakeup-catalogo-tecnico/schema.sql');
const coursesPath = path.resolve(__dirname, '../wakeup-catalogo-tecnico/output/courses.json');
const summaryPath = path.resolve(__dirname, '../wakeup-catalogo-tecnico/output/import-summary.json');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(fs.readFileSync(schemaPath, 'utf8'));

    const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

    const batchId = randomUUID();
    await client.query(
      `insert into import_batches (
        id, source_file, source_hash, status, total_rows_seen, total_courses_imported, total_courses_updated, total_errors, notes
      ) values ($1,$2,$3,'running',$4,0,0,0,$5)`,
      [
        batchId,
        summary.source_file,
        sha256File(path.resolve(__dirname, '../Catalogo.xlsx')),
        summary.total_rows_in_range,
        'Initial load from generated JSON import output',
      ]
    );

    let inserted = 0;
    let updated = 0;

    for (const course of courses) {
      const existing = await client.query('select id from courses where course_code = $1 limit 1', [course.course_code]);
      if (existing.rows.length) {
        await client.query(
          `update courses set
             source_file = $2,
             source_sheet = $3,
             source_row_number = $4,
             import_batch_id = $5,
             title = $6,
             title_normalized = $7,
             slug = $8,
             category_raw = $9,
             category_normalized = $10,
             hours = $11,
             delivery_mode = $12,
             detail_url = $13,
             language = $14,
             is_active = $15,
             search_text = $16,
             search_vector =
               setweight(to_tsvector('simple', coalesce($6, '')), 'A') ||
               setweight(to_tsvector('simple', coalesce($9, '')), 'B') ||
               setweight(to_tsvector('simple', coalesce($16, '')), 'C'),
             embedding_status = $17,
             updated_at = now()
           where course_code = $1`,
          [
            course.course_code,
            course.source_file,
            course.source_sheet,
            course.source_row_number,
            batchId,
            course.title,
            course.title_normalized,
            course.slug,
            course.category_raw,
            course.category_normalized,
            course.hours,
            course.delivery_mode,
            course.detail_url,
            course.language,
            course.is_active,
            course.search_text,
            course.embedding_status,
          ]
        );
        updated += 1;
      } else {
        await client.query(
          `insert into courses (
             id, source_file, source_sheet, source_row_number, import_batch_id,
             course_code, title, title_normalized, slug,
             category_raw, category_normalized, hours, delivery_mode,
             detail_url, language, is_active, search_text, search_vector, embedding_status
           ) values (
             $1,$2,$3,$4,$5,
             $6,$7,$8,$9,
             $10,$11,$12,$13,
             $14,$15,$16,$17,
             setweight(to_tsvector('simple', coalesce($7, '')), 'A') ||
             setweight(to_tsvector('simple', coalesce($10, '')), 'B') ||
             setweight(to_tsvector('simple', coalesce($17, '')), 'C'),
             $18
           )`,
          [
            randomUUID(),
            course.source_file,
            course.source_sheet,
            course.source_row_number,
            batchId,
            course.course_code,
            course.title,
            course.title_normalized,
            course.slug,
            course.category_raw,
            course.category_normalized,
            course.hours,
            course.delivery_mode,
            course.detail_url,
            course.language,
            course.is_active,
            course.search_text,
            course.embedding_status,
          ]
        );
        inserted += 1;
      }
    }

    await client.query(
      `update import_batches
       set status = 'completed', finished_at = now(), total_courses_imported = $2, total_courses_updated = $3
       where id = $1`,
      [batchId, inserted, updated]
    );

    await client.query('commit');
    console.log(JSON.stringify({ ok: true, batchId, inserted, updated }, null, 2));
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
