# Oleksandr Pokryshchuk Portfolio

Static portfolio site. No build step: open `index.html` in a browser or push the folder to GitHub Pages.

## Structure

```
index.html          page markup and content
css/styles.css      design tokens (light and dark), layout, motion
js/i18n.js          Ukrainian strings and the language switch
js/main.js          theme switch, mobile menu, copy email, scroll reveal
js/board.js         interactive 3D model of the fan control board (Three.js)
assets/             favicon, CV (PDF), link preview image (og.png)
```

## Editing

- Texts, projects, links: `index.html`.
- Colors and fonts: the `:root` blocks at the top of `css/styles.css`.
- 3D board: component placement is in the "Layout" block of `js/board.js`, coordinates in millimetres.

Three.js r128 is loaded from cdnjs. If it cannot load or WebGL is unavailable, the 3D block hides itself and the rest of the page works.

## Deploy to GitHub Pages

Copy the files into the `Ethereall-Pluto.github.io` repository root, commit and push.
