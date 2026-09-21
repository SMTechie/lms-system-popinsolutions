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
	docker compose up -d db

db-down:
	docker compose down

db-migrate:
	powershell -NoProfile -Command "$$env:DATABASE_URL=(Get-Content .env.docker | Where-Object { $$_ -like 'DATABASE_URL=*' } | ForEach-Object { $$_ -replace '^DATABASE_URL=', '' }).Trim('\\\"'); npm run db:migrate"

db-seed:
	powershell -NoProfile -Command "$$env:DATABASE_URL=(Get-Content .env.docker | Where-Object { $$_ -like 'DATABASE_URL=*' } | ForEach-Object { $$_ -replace '^DATABASE_URL=', '' }).Trim('\\\"'); npm run db:seed"
