# MFE Dubbing Quality Survey

## Quick start
1. Install dependencies: `npm install`
2. Launch the survey: `npm start`
3. Visit [http://localhost:3000](http://localhost:3000) with a valid `?uid=CODE` query parameter.

## Configuration
- Edit **`config/seedConfig.json`** to update the list of 15 `userCodes` and the 10 `videos` (each entry has an `id`, optional `title`, and `url`).
- The front-end and API both read from this single file, so updating it keeps everything in sync.

## Data storage
- Survey progress and submissions are saved to **`data/responses.json`**.
- Each response includes the user code, video id, AI guess, rating, timestamp, and user agent.
- Completion events are tracked in the same file. Download all results as CSV from `/api/export`.

## Notes
- Session secrets can be overridden with the `SESSION_SECRET` environment variable.
- The survey requires a valid code in the URL (for example: `http://localhost:3000/?uid=MFE2024A`).
