# Front-Facing Square Prize Wheel

A static, image-first, weighted vertical reel for GitHub Pages. It spins like a front-facing game-show wheel or large slot-machine reel. The selected center position is a regular square tile.

## Features

- Front-facing vertical 3D reel
- Square image-only winning tile
- Add, duplicate, delete, and reorder choices
- Upload an image for each choice
- Give each choice its own tile color and probability weight
- Customize the background, machine, trim, pointer, lights, button, and interface colors
- Optional result popup, label, probability display, history, confetti, and sound
- Presentation and full-screen modes
- Browser saving using IndexedDB, with localStorage fallback
- Export and import the entire wheel, including uploaded images
- Optional `wheel-config.json` public configuration
- No framework, build process, account system, or backend required

## Publish the site through GitHub Pages

1. Create a new GitHub repository.
2. Extract the ZIP.
3. Upload the contents of the extracted folder—not the ZIP itself—to the root of the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `.nojekyll`
   - `README.md` is optional
4. Commit the files.
5. Open the repository's **Settings**.
6. Open **Pages** under **Code and automation**.
7. Under **Build and deployment**, choose **Deploy from a branch**.
8. Select the `main` branch and `/ (root)`.
9. Click **Save**.

Your address will normally look like:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## Publish your customized choices and images

GitHub Pages cannot automatically write browser changes back into the repository.

1. Open your published wheel.
2. Customize the choices, images, probabilities, and appearance.
3. Open **Customize → Behavior**.
4. Click **Export wheel file**.
5. Rename the downloaded JSON file to exactly:
   `wheel-config.json`
6. Upload `wheel-config.json` to the repository root beside `index.html`.
7. Commit the change.

New visitors will load that configuration. A browser that already customized the site locally will keep its local setup until **Clear local changes** is used.

## Update the website later

Upload the replacement files to the same repository and commit them. GitHub Pages republishes the site from the selected branch.

## Test locally

From the extracted folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
