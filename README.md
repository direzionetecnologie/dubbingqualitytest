# MFE Dubbing Quality Survey

A single-page survey for evaluating AI-dubbed videos. The app now runs entirely in the browser, so you can host the contents of `public/` on GitHub Pages or any other static hosting service.

## Configure the survey
- Update **`public/config.js`** to edit the `userCodes` array and the list of `videos` (each entry needs an `id`, optional `title`, and a direct video `url`).
- Rebuild links to your hosted videos before sharing. The query parameter `?uid=CODE` must match one of the configured `userCodes`.

## Publish with GitHub Pages
1. Commit and push the repository (or just the `public/` folder) to GitHub.
2. Enable GitHub Pages for the repository and choose the `main` branch with the `/public` folder as the source.
3. Visit `https://<username>.github.io/<repo>/?uid=YOUR_CODE` to load the survey.

## Collecting responses
- Participants' answers are stored in their browser's local storage under their unique code.
- After they complete the survey, they must click **Download responses** to export a CSV file and send it back to you.
- To clear data for a code on a specific device, remove the site's local storage or use the browser's storage inspector.

## Local preview
- Open `public/index.html` directly in a browser, or
- Run `npm install` followed by `npm start` to serve the static files at [http://localhost:3000](http://localhost:3000) for testing.

## Notes
- There is no server-side database. Make sure participants export and share their CSV files if you need centralized results.
- Codes are case-sensitive and must match the values declared in `public/config.js`.
