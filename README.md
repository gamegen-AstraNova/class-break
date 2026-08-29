# Class Break

An AstraNova classroom risk-and-reward game built for the GameGen noskin platform with React 19 and TypeScript.

## Play online

[Play Class Break](https://gamegen-astranova.github.io/class-break/)

## Open the game

Do not open the root `index.html` with a `file://` URL. Browser security prevents a Vite TypeScript application from loading that way.

On Windows, double-click `preview.cmd`. It builds the current source, starts a local HTTP preview at `http://127.0.0.1:8765/`, and opens the game automatically. Close the command window to stop the preview server.

## Gameplay

- Choose Asteria, Nyx, or Lumi.
- Hold the classroom, the main control, or the Space key while the teacher writes.
- Release during the warning before the teacher faces the class.
- One catch immediately ends the round.
- Reach 8,000 points within 60 seconds to win. Continuous holds accelerate the score rate.
- Each character has caught, time-up, and victory CGs stored in the local gallery, for nine scenes in total.

## Commands

```text
npm install
npm run dev
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 8765 --strictPort
```

## GameGen layout

- Replaceable images: `public/common/textures/`
- Replaceable music and sound effects: `public/common/audio/`
- Bundled chalk typeface: `public/common/fonts/chalk_jp.otf`
- Asset manifest: `public/config/asset-manifest.json`
- General configuration: `public/config/generalConfiguration.json`
- Locales: `public/config/language/{en,zh-TW,zh-CN,ja}.json`
- Production output: `dist/`

Every image and audio file independently probes `style`, `commonPath`, local `common/`, then local public paths. Locale files independently probe `style`, `commonPath`, then the local language file. Invalid or incomplete remote skins fall through without blocking the game.

The release backend should merge its normalized `assets.baseUrl` into `commonPath` so that `commonPath + relativePath` points directly to the published `textures/` directory.
