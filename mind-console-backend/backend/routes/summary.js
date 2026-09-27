const express = require('express');
const rateLimit = require('express-rate-limit');
const Item = require('../models/Item');

const router = express.Router();

// Summaries call a paid API - keep this modest even though the person is the only user.
const summaryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down on summary requests - try again shortly.' }
});

router.post('/', summaryLimiter, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res
      .status(500)
      .json({ error: 'ANTHROPIC_API_KEY is not set on the server.' });
  }

  const [active, recentHistory] = await Promise.all([
    Item.find({ status: { $ne: 'done' } }).lean(),
    Item.find({ status: 'done' })
      .sort({ completedAt: -1 })
      .limit(15)
      .lean()
  ]);

  if (active.length === 0 && recentHistory.length === 0) {
    return res.json({
      summary: 'Nothing captured yet - add a few thoughts or tasks first.'
    });
  }

  const activeList = active
    .map(
      (i) =>
        `- [${i.priority}] ${i.content}${
          i.deadline ? ` (due ${new Date(i.deadline).toDateString()})` : ''
        }${i.status === 'in_progress' ? ' - in progress' : ''}`
    )
    .join('\n');

  const doneList = recentHistory
    .map((i) => `- ${i.content} (done ${new Date(i.completedAt).toDateString()})`)
    .join('\n');

  const prompt = `Here is my current list of open thoughts/tasks and my recently completed items.

OPEN:
${activeList || '(none)'}

RECENTLY DONE:
${doneList || '(none)'}

Give me a short, direct summary: what's most urgent right now, anything that looks stuck or overdue, and one suggested next action. Keep it under 150 words, no filler, plain text.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'AI summary request failed.' });
    }

    const data = await response.json();
    const summary = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({ summary });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Could not reach the AI summary service.' });
  }
});

module.exports = router;
