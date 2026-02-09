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
2. Optioneel: knop "Beluister Instructies" speelt `public/audio/instructions.m4a`.
3. In auth-scherm: inloggen met testaccount of starten als gast.
4. Ingelogde gebruiker krijgt een persoonlijk dashboard met statistieken.
5. Per chakra: breathing -> retention -> meditation.
6. Na chakra 7 naar summary.
7. Bij summary wordt de sessie opgeslagen via `POST /api/sessions`.

## 6.1 Test login

- Gebruikersnaam: `testuser`
- Wachtwoord: `sadhana123`
- Deze testuser wordt automatisch aangemaakt in migratie `20260209193000_add_user_auth_and_session_relation`.

## 6.2 Chakra-afbeeldingen

Upload per chakra een afbeelding naar:

- `public/images/chakras/chakra-1.jpg`
- `public/images/chakras/chakra-2.jpg`
- `public/images/chakras/chakra-3.jpg`
- `public/images/chakras/chakra-4.jpg`
- `public/images/chakras/chakra-5.jpg`
- `public/images/chakras/chakra-6.jpg`
- `public/images/chakras/chakra-7.jpg`

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
