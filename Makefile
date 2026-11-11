.PHONY: dev build lint typecheck db-up db-down db-migrate db-seed

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

typecheck:
	npm run typecheck

db-up:
	npm run db:up

db-down:
	npm run db:down

db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed
