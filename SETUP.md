# Athena – kom igång

**Appen:** <https://echvibez.github.io/athena/> – publiceras automatiskt från `main` (se `.github/workflows/deploy.yml`).

Athena är din plugg-app med två valv, **Fysik** och **Matte** (plus en **Inkorg** för osorterat).
Allt sparas först på enheten och synkas sedan via Supabase, så samma anteckningar finns på
laptop och mobil.

## 1. Supabase (synk mellan enheter) – görs en gång

1. Skapa ett gratis konto på <https://supabase.com> och ett nytt projekt (välj region *EU – Stockholm/Frankfurt*).
2. Öppna **SQL Editor → New query**, klistra in hela `supabase/schema.sql` och tryck **Run**.
   Det skapar tabellerna, skyddet (bara du ser din data) och en privat bildlagring.
3. Gå till **Project Settings → API** och kopiera
   - **Project URL** (`https://….supabase.co`)
   - **anon / publishable key** (den publika nyckeln – *aldrig* `service_role`).
4. Lägg dem i en fil `.env.local` här i mappen (se `.env.example`) och bygg om – eller klistra in
   dem i appen under **Inställningar → Konto och synk**.
5. Skapa ditt konto i appen (**Inställningar → Skapa konto**).
6. Stäng sedan för nya konton i Supabase: **Authentication → Sign In / Providers → Allow new users to sign up: av**.
   (Om Supabase kräver e-postbekräftelse: bekräfta mailet och logga sedan in i appen.)

## 2. Lägg in fysikmaterialet

**Inställningar → Importera paket** och välj `E:\skola saker\Athena – Fysik kap 1-5.zip`
(37 anteckningar, 146 sidor: lärarens genomgångar kap 1–5, diagnoser, repetitionsuppgifter med
lösningar, laborationer och en sammanfattning med länkar). Gör det på *en* enhet – när du är
inloggad synkas det till de andra.

Paketet byggs om med:

```
powershell -File scripts/render-pages.ps1 -XpsPath "E:\skola saker\kap 1-5 fysik.xps" -OutDir import/fysik/img -Pages …
node scripts/build-fysik-import.mjs
```

## 3. Köra och publicera

- Utveckling: `npm run dev` (Node finns i `D:\Website stuff\Node`, lägg den först i PATH).
- Bygg: `npm run build` → mappen `dist/` är hela appen (statiska filer, fungerar på vilken
  webbhost som helst, t.ex. Netlify, Cloudflare Pages eller GitHub Pages).
- På mobilen: öppna adressen i Chrome/Safari → **Lägg till på hemskärmen**, så blir det en app
  som även fungerar offline.

## Snabbkommandon

| | |
|---|---|
| `Ctrl K` | Sök / hoppa till anteckning / kommandon |
| `Ctrl N` | Ny anteckning |
| `Ctrl Z` / `Ctrl Y` | Ångra / gör om i ritblocket |
| `Ctrl +` / `Ctrl −` / `Ctrl 0` | Zooma / anpassa bredd |
| `Mellanslag + dra` | Flytta vyn med musen |
| `Delete` | Ta bort markering |
| `Shift` när du drar en linje | Lås vinkeln i steg om 15° |

## Hur ritblocket fungerar

- **Penna** (tryckkänslig med penna), **överstrykning**, **suddgummi** (pennans suddknapp funkar också),
  **markera** (lasso: flytta, kopiera, byt färg, ta bort).
- **Former**: linje, pil (kraftpilar!), rektangel, ellips – fäster mot rutnätet och visar längd i rutor och vinkel.
- **Text**, **Formel** (LaTeX med färdiga fysik- och matteformler), **Graf** (skriv `f(x) = x² − 3`,
  `y = 2x + 1`, `A = (1; 2)` eller `x = 3`; nollställen, max/min och skärningar räknas ut).
- **Linjal** (rita längs kanten för raka streck) och **gradskiva** under ⋯-menyn.
- Med penna: fingret flyttar och zoomar. Utan penna (mobil): ett finger ritar, två fingrar flyttar/zoomar.
