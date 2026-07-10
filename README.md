# Simple Box Prize Wheel

A static, image-only, weighted prize wheel for GitHub Pages.

The visible game screen contains only:

- A regular rectangular wheel box
- Flat image tiles
- A center selection lane
- A left arrow
- A Spin button

The customization drawer and recent-results panel can both be completely hidden and reopened from the floating buttons in the upper-right corner.

## Features

- Three-column flat image board inspired by a game-show wheel
- Center tile determines the result
- Add, remove, duplicate, and reorder choices
- Upload an image for each choice
- Set an individual probability weight for every choice
- Customize the background, box, borders, selection line, arrow, button, drawer, accent, and text colors
- Choose 3, 5, or 7 visible rows
- Optional result popup, admin labels, percentages, history, sound, and confetti
- Browser saving through IndexedDB with localStorage fallback
- Export/import the full setup, including uploaded images
- Optional public `wheel-config.json`
- No framework, server, database, or build process required

## Publish through GitHub Pages

1. Create a new GitHub repository.
2. Extract the ZIP.
3. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `.nojekyll`
   - `README.md` is optional
4. Commit the files.
5. Open **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Choose the `main` branch and `/ (root)`.
8. Click **Save**.

The site address will normally be:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## Publish your customized wheel for everyone

1. Open the published site.
2. Use the gear button to customize it.
3. Open **Behavior**.
4. Click **Export wheel file**.
5. Rename the downloaded file to:
   `wheel-config.json`
6. Upload `wheel-config.json` to the same repository beside `index.html`.
7. Commit the change.

New visitors will load that configuration. Existing local browser changes take priority until **Clear local changes** is used.

## Test locally

From the extracted folder, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
