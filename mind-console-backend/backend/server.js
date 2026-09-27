require('dotenv').config();
const dns = require('dns');

// Fix for Windows / certain ISP DNS resolvers refusing SRV queries (querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  console.warn('Notice: Could not set custom DNS servers:', err.message);
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const summaryRoutes = require('./routes/summary');
const { requireAuth } = require('./middleware/auth');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const configured = (process.env.FRONTEND_ORIGIN || '*').split(',').map((o) => o.trim());
      if (
        configured.includes('*') ||
        configured.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  })
);
app.use(express.json({ limit: '100kb' }));

// General ceiling on top of the tighter per-route limiters (login, summary).
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/items', requireAuth, itemRoutes);
app.use('/api/summary', requireAuth, summaryRoutes);

// Serve frontend static files if present in the workspace
const frontendDir = path.resolve(__dirname, '../../mind-console-frontend/frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running at: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
