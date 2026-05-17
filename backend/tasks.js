const express = require('express');
const router = express.Router();
const supabase = require('./supabase');
const { authenticate, requireActive } = require('./auth');

// GET /api/tasks
router.get('/', authenticate, requireActive, async (req, res) => {
  try {
    const { data: tasks, error } = await supabase.from('tasks').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (error) throw error;
    const { data: submissions } = await supabase.from('task_submissions').select('task_id, status, earning_amount, views_count').eq('user_id', req.user.id).in('task_id', tasks.map(t => t.id));
    const submissionMap = {};
    (submissions || []).forEach(s => { submissionMap[s.task_id] = s; });
    res.json({ tasks: tasks.map(t => ({ ...t, my_submission: submissionMap[t.id] || null })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks/:taskId/submit — base64 upload via backend to Supabase Storage
router.post('/:taskId/submit', authenticate, requireActive, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { screenshot_base64, screenshot_mime, views_count } = req.body;

    if (!screenshot_base64) return res.status(400).json({ error: 'Screenshot photo is required' });
    if (!views_count || parseInt(views_count) < 1) return res.status(400).json({ error: 'Views count must be at least 1' });

    const { data: task } = await supabase.from('tasks').select('id').eq('id', taskId).maybeSingle();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { data: existing } = await supabase.from('task_submissions').select('id').eq('user_id', req.user.id).eq('task_id', taskId).maybeSingle();
    if (existing) return res.status(409).json({ error: 'You have already submitted for this task' });

    // Upload to Supabase Storage via service role (no frontend env vars needed)
    const ext = (screenshot_mime || 'image/jpeg').split('/')[1]?.split('+')[0] || 'jpg';
    const filename = `submissions/${req.user.id}/${taskId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(screenshot_base64, 'base64');

    const { error: uploadErr } = await supabase.storage.from('screenshots').upload(filename, buffer, {
      contentType: screenshot_mime || 'image/jpeg', upsert: false,
    });
    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return res.status(500).json({ error: 'Photo upload failed. Make sure the "screenshots" storage bucket exists in Supabase and is public.' });
    }

    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(filename);
    const screenshot_url = urlData.publicUrl;

    const MULTIPLIERS = { none: 1, starter: 1, bronze: 1.5, silver: 2, gold: 3 };
    const earning_amount = 20 * parseInt(views_count) * (MULTIPLIERS[req.user.package_level] || 1);

    const { data: submission, error } = await supabase.from('task_submissions').insert({
      user_id: req.user.id, task_id: taskId, screenshot_url,
      views_count: parseInt(views_count), earning_amount, status: 'pending',
    }).select('*').single();
    if (error) throw error;

    res.status(201).json({ message: 'Submitted! Awaiting admin review.', submission, potential_earning: earning_amount });
  } catch (err) {
    console.error('Submit task error:', err);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// POST /api/tasks/upload-image — admin uploads task image
router.post('/upload-image', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { image_base64, image_mime } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'No image provided' });

    const ext = (image_mime || 'image/jpeg').split('/')[1]?.split('+')[0] || 'jpg';
    const filename = `tasks/${Date.now()}.${ext}`;
    const buffer = Buffer.from(image_base64, 'base64');

    const { error: uploadErr } = await supabase.storage.from('screenshots').upload(filename, buffer, {
      contentType: image_mime || 'image/jpeg', upsert: false,
    });
    if (uploadErr) return res.status(500).json({ error: 'Image upload failed: ' + uploadErr.message });

    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(filename);
    res.json({ image_url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/tasks/my-submissions — only own submissions
router.get('/my-submissions', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from('task_submissions').select('*, tasks(title, image_url)').eq('user_id', req.user.id).order('submitted_at', { ascending: false });
    if (error) throw error;
    res.json({ submissions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

module.exports = router;
