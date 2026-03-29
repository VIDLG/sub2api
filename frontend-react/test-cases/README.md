# Permanent Test Cases (No DevTools)

This directory stores **permanent, versioned test cases** as JSON files.

## Workflow

1. Add or update a case file in `test-cases/cases/*.json`.
2. Run seed script to upsert required data.
3. Run manual or automated tests against the seeded data.

## Commands

```bash
pnpm seed:case -- admin-users-basic
pnpm seed:case -- admin-content-basic
pnpm seed:cases
```

## Environment

- `TEST_ADMIN_TOKEN` (required): admin JWT token.
- `TEST_API_BASE_URL` (optional): defaults to `http://127.0.0.1:8080/api/v1`.

Example:

```bash
$env:TEST_ADMIN_TOKEN="<your-admin-token>"
pnpm seed:case -- admin-users-basic
```

## Supported operation types

- `ensure_group`
- `ensure_user`
- `ensure_announcement`
- `ensure_promo_code`

All operations are idempotent: they find existing fixtures first, then create or update.
