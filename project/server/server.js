const express = require('express');
const cors = require('cors');
const { initDB, insertReview, queryReviews, queryTeachers } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 允許的前端來源（本地 + GitHub Pages + 自訂網域）
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];
const extraOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
const allowedOrigins = [...defaultOrigins, ...extraOrigins];

app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
);


function sendSuccess(res, data, meta = {}) {
  res.json({ success: true, ...meta, data });
}

function sendError(res, statusCode, message) {
  res.status(statusCode).json({ success: false, message });
}

function asRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Professor specialty and review API is running.',
    version: '1.1.0',
    endpoints: {
      teachers: 'GET /api/teachers?q=<keyword>&category=<category>',
      categories: 'GET /api/categories',
      reviews: 'GET /api/teachers/:id/reviews',
      createReview: 'POST /api/teachers/:id/reviews',
    },
  });
});

app.get('/api/teachers', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    const teachers = await queryTeachers(q, category);

    sendSuccess(res, teachers, { total: teachers.length });
  } catch (err) {
    console.error('[API] /api/teachers failed:', err.message);
    sendError(res, 500, 'Unable to load teacher data.');
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const allTeachers = await queryTeachers('', '');
    const categories = [...new Set(allTeachers.map((teacher) => teacher.category).filter(Boolean))];

    sendSuccess(res, categories);
  } catch (err) {
    console.error('[API] /api/categories failed:', err.message);
    sendError(res, 500, 'Unable to load categories.');
  }
});

app.get('/api/teachers/:id/reviews', async (req, res) => {
  try {
    const teacherId = Number(req.params.id);
    if (!Number.isInteger(teacherId) || teacherId < 1) {
      return sendError(res, 400, 'Invalid teacher id.');
    }

    const reviews = await queryReviews(teacherId);
    sendSuccess(res, reviews, { total: reviews.length });
  } catch (err) {
    console.error('[API] GET reviews failed:', err.message);
    sendError(res, 500, 'Unable to load reviews.');
  }
});

app.post('/api/teachers/:id/reviews', async (req, res) => {
  try {
    const teacherId = Number(req.params.id);
    if (!Number.isInteger(teacherId) || teacherId < 1) {
      return sendError(res, 400, 'Invalid teacher id.');
    }

    const kindness = asRating(req.body.kindness_rating);
    const recommendation = asRating(req.body.recommendation_rating);
    const workload = asRating(req.body.workload_rating);
    const content = (req.body.content || '').trim();
    const department = (req.body.department || '').trim().slice(0, 60);

    if (!kindness || !recommendation || !workload) {
      return sendError(res, 400, 'Ratings must be integers from 1 to 5.');
    }

    if (content.length < 4) {
      return sendError(res, 400, 'Please write a little more detail for the review.');
    }

    if (content.length > 1500) {
      return sendError(res, 400, 'Review content is too long.');
    }

    const reviewId = await insertReview(teacherId, {
      department,
      kindness_rating: kindness,
      recommendation_rating: recommendation,
      workload_rating: workload,
      content,
    });

    const [createdReview] = await queryReviews(teacherId).then((reviews) =>
      reviews.filter((review) => review.id === reviewId),
    );

    sendSuccess(res.status(201), createdReview || { id: reviewId });
  } catch (err) {
    console.error('[API] POST review failed:', err.message);
    sendError(res, 500, 'Unable to save review.');
  }
});

app.use((req, res) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.path}`);
});

(async () => {
  try {
    await initDB();

    app.listen(PORT, () => {
      console.log(`[Server] API running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    //process.exit(1);
  }
})();
