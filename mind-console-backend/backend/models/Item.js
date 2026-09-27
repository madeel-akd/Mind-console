const mongoose = require('mongoose');

const progressNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low', 'none'],
      default: 'none'
    },
    deadline: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'in_progress', 'done'],
      default: 'active'
    },
    progressNotes: { type: [progressNoteSchema], default: [] },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Fast sort for the main "Now" view: active/in_progress first, then by priority, then soonest deadline.
itemSchema.index({ status: 1, priority: 1, deadline: 1 });

module.exports = mongoose.model('Item', itemSchema);
