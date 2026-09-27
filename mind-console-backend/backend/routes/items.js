const express = require('express');
const Item = require('../models/Item');

const router = express.Router();

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

function sortItems(items) {
  return items.sort((a, b) => {
    if (a.priority !== b.priority) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return aDeadline - bDeadline;
  });
}

// GET /api/items - everything that isn't done, sorted for the "Now" view
router.get('/', async (req, res) => {
  const items = await Item.find({ status: { $ne: 'done' } }).lean();
  res.json(sortItems(items));
});

// GET /api/items/history - completed items, most recent first
router.get('/history', async (req, res) => {
  const items = await Item.find({ status: 'done' })
    .sort({ completedAt: -1 })
    .limit(200)
    .lean();
  res.json(items);
});

// POST /api/items - quick-capture a new thought/task
router.post('/', async (req, res) => {
  const { content, priority, deadline } = req.body || {};

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required.' });
  }

  const item = await Item.create({
    content: content.trim(),
    priority: priority || 'none',
    deadline: deadline || null
  });

  res.status(201).json(item);
});

// PATCH /api/items/:id - update priority, deadline, status, or content
router.patch('/:id', async (req, res) => {
  const { priority, deadline, status, content } = req.body || {};
  const update = {};

  if (priority !== undefined) update.priority = priority;
  if (deadline !== undefined) update.deadline = deadline;
  if (content !== undefined) update.content = content.trim();
  if (status !== undefined) {
    update.status = status;
    update.completedAt = status === 'done' ? new Date() : null;
  }

  const item = await Item.findByIdAndUpdate(req.params.id, update, {
    new: true
  });

  if (!item) return res.status(404).json({ error: 'Item not found.' });
  res.json(item);
});

// POST /api/items/:id/progress - add a short progress note to an item
router.post('/:id/progress', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Progress note text is required.' });
  }

  const item = await Item.findByIdAndUpdate(
    req.params.id,
    { $push: { progressNotes: { text: text.trim() } } },
    { new: true }
  );

  if (!item) return res.status(404).json({ error: 'Item not found.' });
  res.json(item);
});

// DELETE /api/items/:id
router.delete('/:id', async (req, res) => {
  const item = await Item.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  res.status(204).end();
});

module.exports = router;
