# Sadhana Reiki Rounds (MVP)

Een Next.js app waarin een volledige 7-chakra sessie wordt doorlopen en het resultaat in Postgres wordt opgeslagen via Prisma.

## 1. Vereisten

- Node.js 20+
- npm 10+
- Docker + Docker Compose

## 2. Omgevingsvariabelen

Maak een `.env` bestand op basis van `.env.example`.

```bash
cp .env.example .env
```

## 3. Database starten (Docker)

```bash
docker compose up -d db
```

Controleer of de container draait:

```bash
docker compose ps
```

## 4. Prisma migraties uitvoeren

```bash
npx prisma migrate deploy
```

Voor lokale ontwikkelworkflows kan ook:

```bash
npx prisma migrate dev
```

## 5. App lokaal starten

```bash
npm run dev
```

Open daarna `http://localhost:3000`.

## 6. MVP-flow (huidige implementatie)

1. Disclaimer accepteren.
2. In auth-scherm kiezen voor "Start als Gast".
3. Per chakra: breathing -> retention -> meditation.
4. Na chakra 7 naar summary.
5. Bij summary wordt de sessie opgeslagen via `POST /api/sessions`.

## 7. Kwaliteitschecks

```bash
npm run lint
npx tsc --noEmit
```

## 8. Troubleshooting

- Als DB-connectie faalt, controleer `DATABASE_URL` in `.env`.
- Als migraties falen, controleer of `docker compose ps` de `db` service als "running" toont.
- `src/app/page1.tsx` is als backup uitgesloten van linting.

## 9. GitHub push (eerste keer)

Als je lokaal al commits hebt maar nog geen remote:

```bash
git remote add origin git@github.com:nero-ai-nl/srr.git
git push -u origin main
```

Als je na nieuwe wijzigingen wilt updaten:

```bash
git add .
git commit -m "Beschrijf je wijziging"
git push
```
