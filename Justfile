# sub2api Justfile - Development & Build Tasks
# Tools provided by pixi: node/go/pnpm

set dotenv-path := ".env.dev"
set dotenv-load := true
set dotenv-override := true
set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["sh", "-euo", "pipefail", "-c"]

# Project root directory (absolute) — used to resolve relative paths in .env.dev
root := justfile_directory()

# Re-export paths as absolute so they work under any [working-directory]
export DATA_DIR  := root / ".dev-data" / "app"
export PGDATA    := root / ".dev-data" / "postgres"
export REDIS_DIR := root / ".dev-data" / "redis"

# List all recipes
default:
    @just --list

# ── Setup ─────────────────────────────────────

# Install all project dependencies (pixi + frontend)
setup:
    pixi install

# ── Development Database ────────────────────────

# Initialize PostgreSQL data directory (first time only)
db-init:
    rust-script scripts/dbmgr.rs pg init

# Start PostgreSQL and Redis
db-up:
    rust-script scripts/dbmgr.rs up

# Stop PostgreSQL and Redis
db-down:
    rust-script scripts/dbmgr.rs down

# Show PostgreSQL and Redis status
db-status:
    rust-script scripts/dbmgr.rs pg status
    rust-script scripts/dbmgr.rs redis status

# Check PostgreSQL and Redis are running (exits non-zero if not)
db-check:
    rust-script scripts/dbmgr.rs pg check
    rust-script scripts/dbmgr.rs redis check

# Initialize database schema and admin account
[working-directory('backend')]
db-install:
    pixi run go run ./cmd/install

# Reset database (wipe data and reinitialize)
db-reset:
    rust-script scripts/dbmgr.rs reset
    rm -rf "$DATA_DIR"
    just db-install

# ── Development Servers ─────────────────────────

# Start backend development server
[working-directory('backend')]
dev-be:
    pixi run go run ./cmd/server

# ── Frontend (Vue) ───────────────────────────────

# Install Vue frontend dependencies
[working-directory('frontend')]
dev-install-vue:
    pixi run pnpm install

# Start Vue frontend development server
[working-directory('frontend')]
dev-vue:
    pixi run pnpm run dev

# Build Vue frontend
[working-directory('frontend')]
build-vue:
    pixi run pnpm run build

# ── Frontend (React) ────────────────────────────

# Install React frontend dependencies
[working-directory('frontend-react')]
dev-install-react:
    pixi run pnpm install

# Start React frontend development server
[working-directory('frontend-react')]
dev-react:
    pixi run pnpm run dev

# Build React frontend (output to backend/internal/web/dist-react/)
[working-directory('frontend-react')]
build-react:
    pixi run pnpm run build

# React frontend lint + type check
[working-directory('frontend-react')]
test-react:
    pixi run pnpm run lint
    pixi run pnpm run build

# ── Build ───────────────────────────────────────

# Build frontend and backend (default: Vue)
build: build-backend build-vue

# Build backend only
[working-directory('backend')]
build-backend:
    pixi run go build -o bin/server ./cmd/server

# ── Embedded Build (Frontend + Go Single Binary) ─

# Build Vue embedded binary (default: -tags embed)
[working-directory('backend')]
build-embed-vue: build-vue
    pixi run go build -tags embed -ldflags="-s -w" -o bin/server-vue ./cmd/server

# Build React embedded binary (-tags "embed react")
[working-directory('backend')]
build-embed-react: build-react
    pixi run go build -tags "embed react" -ldflags="-s -w" -o bin/server-react ./cmd/server

# ── Run Embedded Binary ──────────────────────────

# Run Vue embedded binary (build first with: just build-embed-vue)
[working-directory('backend')]
dev-serve-vue port=env("EMBED_PORT", "8081"):
    SERVER_PORT={{ port }} ./bin/server-vue

# Run React embedded binary (build first with: just build-embed-react)
[working-directory('backend')]
dev-serve-react port=env("EMBED_PORT", "8081"):
    SERVER_PORT={{ port }} ./bin/server-react

# ── Testing ──────────────────────────────────────

# Run all tests (backend + Vue)
test: test-backend test-vue

# Vue frontend lint + type check
[working-directory('frontend')]
test-vue:
    pixi run pnpm run lint:check
    pixi run pnpm run typecheck

# Backend tests
[working-directory('backend')]
test-backend:
    pixi run go test ./...

# ── Git & Collaboration ──────────────────────────

# Create PR to upstream (VIDLG/sub2api) from current branch
pr-upstream title body:
    gh pr create --repo VIDLG/sub2api --base main --head daleydeng:$(git branch --show-current) --title "{{ title }}" --body "{{ body }}" --web
