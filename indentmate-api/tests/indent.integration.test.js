import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, test } from 'node:test'
import jwt from 'jsonwebtoken'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

if (!testDatabaseUrl) {
  test('indent integration tests', { skip: 'Set TEST_DATABASE_URL to run database integration tests.' }, () => {})
} else {
  process.env.DATABASE_URL = testDatabaseUrl
  process.env.JWT_SECRET ??= 'indentmate-test-secret'
  process.env.CORS_ORIGIN ??= 'http://localhost:5173'
  process.env.NODE_ENV = 'test'

  describe('POST /api/indents integration', () => {
    let baseUrl
    let pool
    let query
    let server
    let token

    before(async () => {
      const appModule = await import('../src/app.js')
      const dbModule = await import('../src/db/pool.js')
      const schemaModule = await import('../src/db/ensureSchema.js')

      pool = dbModule.pool
      query = dbModule.query

      await schemaModule.ensureSchema()
      await cleanupTestData()
      await seedTestUser()

      token = jwt.sign(
        {
          login_name: 'ENG-QA',
          employee_name: 'QA Engineer',
          primary_role: 'SIE',
        },
        process.env.JWT_SECRET,
      )

      server = createServer(appModule.createApp())
      await new Promise((resolve) => server.listen(0, resolve))
      baseUrl = `http://127.0.0.1:${server.address().port}`
    })

    after(async () => {
      if (query) {
        await cleanupTestData()
      }

      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        })
      }

      if (pool) {
        await pool.end()
      }
    })

    test('happy path creates one indent header and all line items', async () => {
      const payload = buildPayload('REQ-QA-HAPPY-001')
      const response = await postIndent(payload)
      const body = await response.json()

      assert.equal(response.status, 201)
      assert.equal(body.app_request_id, payload.app_request_id)
      assert.match(body.indent_no, /^IND-\d{4}-\d{4}$/)

      const headerResult = await query(
        'SELECT id, indent_no FROM indent_headers WHERE app_request_id = $1',
        [payload.app_request_id],
      )
      assert.equal(headerResult.rowCount, 1)

      const lineResult = await query(
        'SELECT line_number, item_code, required_qty FROM indent_lines WHERE indent_header_id = $1 ORDER BY line_number',
        [headerResult.rows[0].id],
      )
      assert.equal(lineResult.rowCount, 2)
      assert.equal(lineResult.rows[0].item_code, 'QA-ITEM-001')
      assert.equal(Number(lineResult.rows[1].required_qty), 30)
    })

    test('transaction rollback prevents header insert when a line item is invalid', async () => {
      const payload = buildPayload('REQ-QA-ROLLBACK-001')
      delete payload.items[1].item_code

      const response = await postIndent(payload)

      assert.equal(response.status, 400)

      const headerResult = await query(
        'SELECT id FROM indent_headers WHERE app_request_id = $1',
        [payload.app_request_id],
      )
      assert.equal(headerResult.rowCount, 0)
    })

    test('idempotency returns the existing indent number without duplicate headers', async () => {
      const payload = buildPayload('REQ-QA-IDEMPOTENT-001')

      const firstResponse = await postIndent(payload)
      const firstBody = await firstResponse.json()
      const secondResponse = await postIndent(payload)
      const secondBody = await secondResponse.json()

      assert.equal(firstResponse.status, 201)
      assert.equal(secondResponse.status, 200)
      assert.equal(secondBody.indent_no, firstBody.indent_no)
      assert.equal(secondBody.app_request_id, payload.app_request_id)

      const headerResult = await query(
        'SELECT id FROM indent_headers WHERE app_request_id = $1',
        [payload.app_request_id],
      )
      assert.equal(headerResult.rowCount, 1)
    })

    async function postIndent(payload) {
      return fetch(`${baseUrl}/api/indents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    }

    async function seedTestUser() {
      await query(
        `
          INSERT INTO users (login_name, employee_name, primary_role, password_hash)
          VALUES ('ENG-QA', 'QA Engineer', 'SIE', 'not-used-in-tests')
          ON CONFLICT (login_name) DO UPDATE
          SET employee_name = EXCLUDED.employee_name,
              primary_role = EXCLUDED.primary_role,
              password_hash = EXCLUDED.password_hash
        `,
      )
    }

    async function cleanupTestData() {
      await query(`
        DELETE FROM indent_headers
        WHERE app_request_id LIKE 'REQ-QA-%'
           OR created_by = 'ENG-QA'
      `)
      await query(`
        DELETE FROM indents
        WHERE indent_no LIKE 'IND-%'
          AND created_by = 'ENG-QA'
      `)
      await query("DELETE FROM users WHERE login_name = 'ENG-QA'")
    }
  })
}

function buildPayload(appRequestId) {
  return {
    app_request_id: appRequestId,
    project_code: 'QA-PROJECT',
    source_warehouse: 'QA-WH',
    delivery_location: 'QA-ZONE-A',
    requirement_type: 'Issue',
    indent_type: 'Issue',
    items: [
      {
        item_code: 'QA-ITEM-001',
        make: 'QA Make',
        uom: 'MT',
        required_qty: 0.5,
        remarks: 'Rollback and idempotency test item',
      },
      {
        item_code: 'QA-ITEM-002',
        make: 'QA Make',
        uom: 'Bags',
        required_qty: 30,
        remarks: '',
      },
    ],
  }
}
