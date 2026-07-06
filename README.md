# MT Pay Ledger

A static, no-build calculator for modeling proposed contract raises against the
MT-03–MT-08 pay scale, using 2025-10-01 as the base year.

## What it does

- **Contract length** — pick how many years the deal runs (1–15).
- **Raise structure**
  - *Consistent %* — one flat percentage applied every year.
  - *Stepped %* — a different percentage per year of the term (Y1, Y2, …).
  - Either way, each year's raise is applied to **the year before it**, not to the 2025 base.
- **Level view**
  - *All levels* — an overview table showing each level's lowest and highest step per year.
  - *A specific level (e.g. MT-05)* — every step, every year.
- **Wage basis** — toggle between annual salary and hourly wage
  (`annual ÷ (hours/week × 52.176)`); hours/week is editable.

Every cell shows the dollar change from the year before it, and every year
column shows the cumulative percent change versus 2025.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | All styling |
| `app.js` | Projection math + rendering |
| `data.js` | Pay scale data as a JS constant (generated from `payscales.json`) |
| `payscales.json` | Source data, kept for reference/editing |

## Updating the pay data

Edit `payscales.json`, then regenerate `data.js` with:

```bash
python3 -c "
import json
with open('payscales.json') as f:
    data = json.load(f)
with open('data.js', 'w') as f:
    f.write('const PAYSCALES = ')
    f.write(json.dumps(data, indent=2))
    f.write(';\n')
"
```

(Or just hand-edit `data.js` directly — it's a plain JS object.)

To add a new MT level or a new pay-scale date, just add it to the JSON; the
app reads levels and steps dynamically. It always uses whichever entry's
`date` starts with `2025` as the base year — update `BASE_YEAR` in `app.js`
if the base year ever changes.

## Deploying to GitHub Pages

1. Create a new repo (or use an existing one) and push these files to it:
   ```bash
   git init
   git add .
   git commit -m "MT pay ledger"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source** → set to
   `Deploy from a branch`, branch `main`, folder `/ (root)`. Save.
3. GitHub gives you a URL like `https://<your-username>.github.io/<repo-name>/`
   within a minute or two. Share that link with your fellow MTs.

No build step, no dependencies, no server required — it's plain HTML/CSS/JS.
