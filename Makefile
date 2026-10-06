# Developer shortcuts. Customers never need these — see README.md.
.PHONY: install migrate dev-api dev-web test check build serve

install:
	cd backend && uv sync
	cd frontend && pnpm install

migrate:
	cd backend && uv run alembic upgrade head

dev-api: migrate
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev-web:
	cd frontend && pnpm dev

test:
	cd backend && uv run pytest -q
	cd frontend && pnpm test

# Everything CI should run.
check:
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest -q
	cd frontend && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test

build:
	cd frontend && pnpm build

# Single-process production-style run: the API serves the built frontend on :8000.
serve: build migrate
	cd backend && ENVIRONMENT=$${ENVIRONMENT:-development} uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
