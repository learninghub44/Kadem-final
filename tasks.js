const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate, requireActive } = require('../middleware/auth');

// GET /api/tasks — get all active tasks
router.get('/', authenticate, requireActive, async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get user's submissions for these tasks
    const taskIds = tasks.map(t => t.id);
    const { data: submissions } = await supabase
      .from('task_submissions')
      .select('task_id, status, earning_amount, views_count')
      .eq('user_id', req.user.id)
      .in('task_id', taskIds);

    const submissionMap = {};
    (submissions || []).forEach(s => { submissionMap[s.task_id] = s; });

    const tasksWithStatus = tasks.map(t => ({
      ...t,
      my_submission: submissionMap[t.id] || null,
    }));

    res.json({ tasks: tasksWithStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks/:taskId/submit — submit screenshot
router.post('/:taskId/submit', authenticate, requireActive, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { screenshot_url, views_count } = req.body;

    if (!screenshot_url || !views_count) {
      return res.status(400).json({ error: 'Screenshot URL and views count required' });
    }
    if (views_count < 1) return res.status(400).json({ error: 'Views count must be at least 1' });

    // Check task exists
    const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Check not already submitted
    const { data: existing } = await supabase
      .from('task_submissions')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('task_id', taskId)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Already submitted for this task' });

    const MULTIPLIERS = { none: 1, starter: 1, bronze: 1.5, silver: 2, gold: 3 };
    const multiplier = MULTIPLIERS[req.user.package_level] || 1;
    const earning_amount = 20 * views_count * multiplier;

    const { data: submission, error } = await supabase
      .from('task_submissions')
      .insert({
        user_id: req.user.id,
        task_id: taskId,
        screenshot_url,
        views_count,
        earning_amount,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Submission received! Pending admin review.',
      submission,
      potential_earning: earning_amount,
    });
  } catch (err) {
    console.error('Submit task error:', err);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// GET /api/tasks/my-submissions
router.get('/my-submissions', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('task_submissions')
      .select('*, tasks(title, image_url)')
      .eq('user_id', req.user.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    res.json({ submissions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

module.exports = router;
