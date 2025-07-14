const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Calculate account age in human-readable format
function calculateAccountAge(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  return years > 0 ? `${years} years, ${months} months` : `${months} months`;
}

// Calculate age in days
function calculateAgeDays(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Root endpoint
app.get('/', (req, res) => {
  res.send('Facebook Account Age Checker API is running');
});

// Facebook age checker endpoint (POST)
app.post('/api/facebook/:username', async (req, res) => {
  try {
    // Verify reCAPTCHA
    const recaptchaResponse = req.body.recaptcha;
    if (!recaptchaResponse) {
      return res.status(400).json({ error: 'reCAPTCHA required' });
    }
    const recaptchaVerify = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: recaptchaResponse,
      })
    );
    if (!recaptchaVerify.data.success) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }

    // Fetch Facebook Page/user data
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${req.params.username}?fields=id,username,name,created_time,followers_count,verified,about,location,picture&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`
    );
    const user = response.data;
    if (!user) throw new Error('User or Page not found');

    console.log('Facebook API Response:', JSON.stringify(user, null, 2)); // Log for debugging

    res.json({
      username: user.username || req.params.username,
      nickname: user.name || 'N/A',
      estimated_creation_date: user.created_time ? new Date(user.created_time).toLocaleDateString() : 'N/A',
      account_age: user.created_time ? calculateAccountAge(user.created_time) : 'N/A',
      age_days: user.created_time ? calculateAgeDays(user.created_time) : 0,
      followers: user.followers_count || 0,
      total_posts: 0, // Graph API doesn't provide post count directly
      verified: user.verified ? 'Yes' : 'No',
      description: user.about || 'N/A',
      region: user.location?.name || 'N/A',
      user_id: user.id || 'N/A',
      avatar: user.picture?.data?.url || 'https://via.placeholder.com/50',
    });
  } catch (error) {
    console.error('Facebook API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || 'Failed to fetch Facebook data',
      details: error.response?.data || 'No additional details',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Facebook Server running on port ${PORT}`);
});
