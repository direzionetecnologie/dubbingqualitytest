const express = require('express');
const session = require('express-session');
const path = require('path');
const fsp = require('fs/promises');

const seedConfig = require('./config/seedConfig.json');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'mfe-survey-secret';
const DATA_PATH = path.join(__dirname, 'data', 'responses.json');

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      sameSite: 'lax'
    }
  })
);
app.use(express.static(path.join(__dirname, 'public')));

async function writeDataSafely(data) {
  await fsp.mkdir(path.dirname(DATA_PATH), { recursive: true });
  const tempPath = `${DATA_PATH}.tmp`;
  await fsp.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fsp.rename(tempPath, DATA_PATH);
}

async function readDataStore() {
  try {
    const file = await fsp.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const initial = { responses: [], completions: [] };
      await writeDataSafely(initial);
      return initial;
    }
    throw error;
  }
}

function isValidCode(code) {
  if (typeof code !== 'string') {
    return false;
  }
  return seedConfig.userCodes.includes(code.trim());
}

function ensureAuthenticated(req, res, next) {
  if (!req.session || !req.session.userCode) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return next();
}

app.post('/api/validate', (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing survey code.' });
  }
  const trimmed = code.trim();
  if (!isValidCode(trimmed)) {
    return res.status(403).json({ error: 'Invalid survey code. Please contact the organizer.' });
  }
  req.session.userCode = trimmed;
  return res.json({ success: true, userCode: trimmed });
});

app.get('/api/bootstrap', ensureAuthenticated, async (req, res) => {
  try {
    const dataStore = await readDataStore();
    const userCode = req.session.userCode;
    const userResponses = dataStore.responses.filter((item) => item.user_code === userCode);
    const completion = dataStore.completions.find((item) => item.user_code === userCode);
    return res.json({
      userCode,
      videos: seedConfig.videos,
      responses: userResponses,
      totalVideos: seedConfig.videos.length,
      completed: Boolean(completion)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load survey data.' });
  }
});

app.post('/api/save', ensureAuthenticated, async (req, res) => {
  const { videoId, isAi, qualityRating } = req.body || {};
  const userCode = req.session.userCode;

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'Missing video identifier.' });
  }

  const videoExists = seedConfig.videos.some((video) => video.id === videoId);
  if (!videoExists) {
    return res.status(400).json({ error: 'Unknown video identifier.' });
  }

  if (typeof isAi !== 'boolean') {
    return res.status(400).json({ error: 'Invalid value for AI classification.' });
  }

  const ratingNumber = Number(qualityRating);
  if (!Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
    return res.status(400).json({ error: 'Quality rating must be an integer between 1 and 5.' });
  }

  try {
    const dataStore = await readDataStore();
    const timestamp = new Date().toISOString();
    const userAgent = req.get('user-agent') || '';
    const existingIndex = dataStore.responses.findIndex(
      (item) => item.user_code === userCode && item.video_id === videoId
    );
    const record = {
      user_code: userCode,
      video_id: videoId,
      is_ai: Boolean(isAi),
      quality_rating: ratingNumber,
      timestamp,
      user_agent: userAgent
    };
    if (existingIndex >= 0) {
      dataStore.responses[existingIndex] = record;
    } else {
      dataStore.responses.push(record);
    }
    await writeDataSafely(dataStore);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to save response.' });
  }
});

app.post('/api/complete', ensureAuthenticated, async (req, res) => {
  try {
    const dataStore = await readDataStore();
    const userCode = req.session.userCode;
    const answeredCount = dataStore.responses.filter((item) => item.user_code === userCode).length;
    const totalVideos = seedConfig.videos.length;

    if (answeredCount < totalVideos) {
      return res.status(400).json({ error: 'Please answer all videos before submitting.' });
    }

    const timestamp = new Date().toISOString();
    const completionIndex = dataStore.completions.findIndex((item) => item.user_code === userCode);
    if (completionIndex >= 0) {
      dataStore.completions[completionIndex].completed_at = timestamp;
    } else {
      dataStore.completions.push({ user_code: userCode, completed_at: timestamp });
    }
    await writeDataSafely(dataStore);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to complete survey.' });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const dataStore = await readDataStore();
    const completionLookup = new Map();
    dataStore.completions.forEach((item) => {
      completionLookup.set(item.user_code, item.completed_at || '');
    });
    const header = [
      'user_code',
      'video_id',
      'is_ai',
      'quality_rating',
      'timestamp',
      'user_agent',
      'completed_at'
    ];
    const rows = dataStore.responses.map((item) => {
      const completedAt = completionLookup.get(item.user_code) || '';
      return [
        item.user_code,
        item.video_id,
        item.is_ai,
        item.quality_rating,
        item.timestamp,
        item.user_agent,
        completedAt
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const stringValue = value === undefined || value === null ? '' : String(value);
            const escaped = stringValue.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="survey-results.csv"');
    return res.send(csv);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Unable to export survey data');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MFE survey app listening on http://localhost:${PORT}`);
});

module.exports = app;
