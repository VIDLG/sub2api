import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const casesDir = path.join(projectRoot, 'test-cases', 'cases')

function parseArgs(argv) {
  const result = {
    caseId: '',
    all: false,
    baseUrl: process.env.TEST_API_BASE_URL || 'http://127.0.0.1:8080/api/v1',
    token: process.env.TEST_ADMIN_TOKEN || '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--all') {
      result.all = true
      continue
    }
    if (arg === '--case' && argv[i + 1]) {
      result.caseId = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--base-url' && argv[i + 1]) {
      result.baseUrl = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--token' && argv[i + 1]) {
      result.token = argv[i + 1]
      i += 1
      continue
    }
    if (!arg.startsWith('-') && !result.caseId) {
      result.caseId = arg
    }
  }

  return result
}

function normalizeBaseUrl(baseUrl) {
  if (baseUrl.endsWith('/')) {
    return baseUrl.slice(0, -1)
  }
  return baseUrl
}

async function apiRequest({ baseUrl, token, method, endpoint, query, body }) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${endpoint}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue
      }
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { message: text }
    }
  }

  if (!response.ok) {
    const message = payload?.message || payload?.detail || `${method} ${endpoint} failed`
    throw new Error(`[HTTP ${response.status}] ${message}`)
  }

  if (payload && typeof payload === 'object' && 'code' in payload) {
    if (payload.code !== 0) {
      throw new Error(`[API ${payload.code}] ${payload.message || 'Unknown API error'}`)
    }
    return payload.data
  }

  return payload
}

async function listGroups(ctx, search = '') {
  return apiRequest({
    ...ctx,
    method: 'GET',
    endpoint: '/admin/groups',
    query: { page: 1, page_size: 200, search },
  })
}

async function listUsers(ctx, search = '') {
  return apiRequest({
    ...ctx,
    method: 'GET',
    endpoint: '/admin/users',
    query: { page: 1, page_size: 200, search },
  })
}

async function listAnnouncements(ctx, search = '') {
  return apiRequest({
    ...ctx,
    method: 'GET',
    endpoint: '/admin/announcements',
    query: { page: 1, page_size: 200, search },
  })
}

async function listPromoCodes(ctx, search = '') {
  return apiRequest({
    ...ctx,
    method: 'GET',
    endpoint: '/admin/promo-codes',
    query: { page: 1, page_size: 200, search },
  })
}

function toUnixSeconds(value) {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value === 'number') {
    return value
  }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date value: ${String(value)}`)
  }
  return Math.floor(ms / 1000)
}

async function ensureGroup(ctx, op) {
  const page = await listGroups(ctx, op.name)
  const existing = page.items.find((item) => item.name === op.name)

  const groupPayload = {
    name: op.name,
    description: op.description ?? null,
    platform: op.platform ?? 'anthropic',
    rate_multiplier: op.rate_multiplier ?? 1,
    is_exclusive: op.is_exclusive ?? false,
    subscription_type: op.subscription_type ?? 'standard',
  }

  if (!existing) {
    const created = await apiRequest({
      ...ctx,
      method: 'POST',
      endpoint: '/admin/groups',
      body: groupPayload,
    })
    console.log(`[create] group ${op.name} (#${created.id})`)
    return created
  }

  const updated = await apiRequest({
    ...ctx,
    method: 'PUT',
    endpoint: `/admin/groups/${existing.id}`,
    body: {
      ...groupPayload,
      status: op.status ?? 'active',
    },
  })
  console.log(`[update] group ${op.name} (#${updated.id})`)
  return updated
}

async function resolveGroupIdsByName(ctx, names) {
  if (!names || names.length === 0) {
    return null
  }

  const groups = await apiRequest({
    ...ctx,
    method: 'GET',
    endpoint: '/admin/groups/all',
  })

  const map = new Map(groups.map((g) => [g.name, g.id]))
  const ids = []
  for (const name of names) {
    const id = map.get(name)
    if (!id) {
      throw new Error(`Group not found for allowed_groups: ${name}`)
    }
    ids.push(id)
  }
  return ids
}

async function ensureUser(ctx, op) {
  const page = await listUsers(ctx, op.email)
  const existing = page.items.find((item) => item.email === op.email)
  const allowedGroups = await resolveGroupIdsByName(ctx, op.allowed_group_names)

  const createPayload = {
    email: op.email,
    password: op.password,
    balance: op.balance ?? 0,
    concurrency: op.concurrency ?? 1,
    allowed_groups: allowedGroups,
  }

  if (!existing) {
    if (!op.password) {
      throw new Error(`Missing password for new user: ${op.email}`)
    }
    const created = await apiRequest({
      ...ctx,
      method: 'POST',
      endpoint: '/admin/users',
      body: createPayload,
    })
    console.log(`[create] user ${op.email} (#${created.id})`)
    return created
  }

  const updatePayload = {
    email: op.email,
    role: op.role ?? existing.role,
    status: op.status ?? 'active',
    balance: op.balance ?? existing.balance,
    concurrency: op.concurrency ?? existing.concurrency,
    notes: op.notes ?? existing.notes ?? '',
    allowed_groups: allowedGroups,
  }

  if (op.password_on_update && op.password) {
    updatePayload.password = op.password
  }

  const updated = await apiRequest({
    ...ctx,
    method: 'PUT',
    endpoint: `/admin/users/${existing.id}`,
    body: updatePayload,
  })
  console.log(`[update] user ${op.email} (#${updated.id})`)
  return updated
}

async function ensureAnnouncement(ctx, op) {
  const page = await listAnnouncements(ctx, op.title)
  const existing = page.items.find((item) => item.title === op.title)

  const payload = {
    title: op.title,
    content: op.content,
    status: op.status ?? 'active',
    targeting: op.targeting ?? {},
    starts_at: toUnixSeconds(op.starts_at),
    ends_at: toUnixSeconds(op.ends_at),
  }

  if (!existing) {
    const created = await apiRequest({
      ...ctx,
      method: 'POST',
      endpoint: '/admin/announcements',
      body: payload,
    })
    console.log(`[create] announcement ${op.title} (#${created.id})`)
    return created
  }

  const updated = await apiRequest({
    ...ctx,
    method: 'PUT',
    endpoint: `/admin/announcements/${existing.id}`,
    body: payload,
  })
  console.log(`[update] announcement ${op.title} (#${updated.id})`)
  return updated
}

async function ensurePromoCode(ctx, op) {
  const page = await listPromoCodes(ctx, op.code)
  const existing = page.items.find((item) => item.code === op.code)

  const payload = {
    code: op.code,
    bonus_amount: op.bonus_amount,
    max_uses: op.max_uses ?? 100,
    status: op.status ?? 'active',
    expires_at: toUnixSeconds(op.expires_at),
    notes: op.notes ?? '',
  }

  if (!existing) {
    const created = await apiRequest({
      ...ctx,
      method: 'POST',
      endpoint: '/admin/promo-codes',
      body: payload,
    })
    console.log(`[create] promo ${op.code} (#${created.id})`)
    return created
  }

  const updated = await apiRequest({
    ...ctx,
    method: 'PUT',
    endpoint: `/admin/promo-codes/${existing.id}`,
    body: payload,
  })
  console.log(`[update] promo ${op.code} (#${updated.id})`)
  return updated
}

async function runOperation(ctx, op) {
  switch (op.type) {
    case 'ensure_group':
      return ensureGroup(ctx, op)
    case 'ensure_user':
      return ensureUser(ctx, op)
    case 'ensure_announcement':
      return ensureAnnouncement(ctx, op)
    case 'ensure_promo_code':
      return ensurePromoCode(ctx, op)
    default:
      throw new Error(`Unsupported operation type: ${op.type}`)
  }
}

async function loadCaseFile(caseId) {
  const filePath = path.join(casesDir, `${caseId}.json`)
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function listCaseIds() {
  const files = await readdir(casesDir)
  return files
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5))
    .sort()
}

async function runCase(ctx, caseId) {
  const testCase = await loadCaseFile(caseId)
  if (!Array.isArray(testCase.operations)) {
    throw new Error(`Case ${caseId} is invalid: operations must be an array`)
  }

  console.log(`\n=== Case: ${testCase.id || caseId} ===`)
  if (testCase.description) {
    console.log(testCase.description)
  }

  for (const op of testCase.operations) {
    await runOperation(ctx, op)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.token) {
    console.error('Missing admin token. Set TEST_ADMIN_TOKEN or pass --token <token>.')
    process.exit(1)
  }

  const ctx = {
    baseUrl: args.baseUrl,
    token: args.token,
  }

  if (args.all) {
    const caseIds = await listCaseIds()
    for (const caseId of caseIds) {
      await runCase(ctx, caseId)
    }
    console.log(`\nDone. Executed ${caseIds.length} case(s).`)
    return
  }

  if (!args.caseId) {
    console.error('Usage: pnpm seed:case -- <caseId> [--base-url <url>] [--token <token>]')
    console.error('   or: pnpm seed:cases -- [--base-url <url>] [--token <token>]')
    process.exit(1)
  }

  await runCase(ctx, args.caseId)
  console.log('\nDone. Executed 1 case.')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
