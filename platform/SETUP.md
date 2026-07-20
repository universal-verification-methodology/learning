# Platform site setup (GA4)

Keys live in [`assets/site-config.js`](assets/site-config.js). Leave them empty to keep analytics off.

## 1. Google Analytics 4 (GA4)

1. Open [Google Analytics](https://analytics.google.com/) → **Admin** → create a **GA4** property (or use an existing one).
2. Under **Data streams** → **Web**, add your site URL(s), for example:
   - `https://universal-verification-methodology.github.io/learning/`
   - `https://yongfu-li.github.io/digital-design-verification/` (if you mirror)
3. Copy the **Measurement ID** (`G-XXXXXXXXXX`).
4. In `platform/assets/site-config.js`, set:

```js
ga4MeasurementId: "G-XXXXXXXXXX",
```

5. Deploy / hard-refresh. The site loads `gtag` only when this id looks like `G-…`.
6. Optional: confirm page views in GA4 **Reports → Realtime**.

Video play / lab-complete events fire when GA4 is configured (`lab_complete`, `community_feedback`).

## 2. Community feedback

Feedback forms on [`community/feedback/`](community/feedback/index.html) open a pre-filled GitHub issue. Set `feedbackIssuesUrl` in `platform/assets/site-config.js` if you use a different repo.

## 3. GitHub Pages deploy (org site)

The live site is **`platform/`** published by Actions — **not** a `gh-pages` branch.

| | |
|--|--|
| Workflow | [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) |
| URL | https://universal-verification-methodology.github.io/learning/ |
| Trigger | Push to `main` that touches `platform/**`, or **Actions → Deploy platform → Run workflow** |

**One-time (repo Settings → Pages):**

1. **Build and deployment → Source:** **GitHub Actions** (not “Deploy from a branch”).
2. Push this workflow (or run it manually once).
3. Optional: delete the old **`gh-pages`** branch so it cannot confuse anyone.

### Dual / personal mirror (optional)

Publish the same `platform/` tree to:

| Site | Example URL |
|------|-------------|
| Org (this workflow) | `https://universal-verification-methodology.github.io/learning/` |
| Personal | `https://yongfu-li.github.io/digital-design-verification/` |

Personal mirror: same Actions pattern in that repo, or copy `platform/` there. Relative links already work on both hosts.

## 4. Local preview

```bash
python -m http.server 8080 --directory platform
```

Open http://127.0.0.1:8080/
