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
  res.send('Instagram Account Age Checker API is running');
});

// Instagram age checker endpoint (POST for frontend with reCAPTCHA)
app.post('/api/instagram/:username', async (req, res) => {
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

    // Fetch user ID by username
    const userResponse = await axios.get(
      `https://graph.instagram.com/v21.0/ig_users/search?q=${req.params.username}&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`
    );
    const user = userResponse.data.data.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
    if (!user) throw new Error('User not found');

    // Fetch user details
    const userDetails = await axios.get(
      `https://graph.instagram.com/v21.0/${user.id}?fields=id,username,name,followers_count,media_count,profile_picture_url&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`
    );
    const userData = userDetails.data;

    // Estimate creation date by fetching oldest media
    let estimatedCreationDate = 'N/A';
    let ageDays = 0;
    try {
      const mediaResponse = await axios.get(
        `https://graph.instagram.com/v21.0/${user.id}/media?fields=timestamp&limit=1&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`
      );
      if (mediaResponse.data.data.length > 0) {
        estimatedCreationDate = new Date(mediaResponse.data.data[0].timestamp).toLocaleDateString();
        ageDays = calculateAgeDays(mediaResponse.data.data[0].timestamp);
      }
    } catch (mediaError) {
      console.error('Media fetch error:', mediaError.message);
    }

    console.log('Instagram API Response:', JSON.stringify(userData, null, 2)); // Log for debugging

    res.json({
      username: userData.username || req.params.username,
      nickname: userData.name || 'N/A',
      estimated_creation_date: estimatedCreationDate,
      account_age: estimatedCreationDate !== 'N/A' ? calculateAccountAge(estimatedCreationDate) : 'N/A',
      age_days: ageDays,
      followers: userData.followers_count || 0,
      total_posts: userData.media_count || 0,
      verified: userData.is_verified ? 'Yes' : 'No', // Instagram Graph API uses is_verified
      description: 'N/A', // Instagram Graph API doesn't provide bio
      region: 'N/A', // Instagram Graph API doesn't provide location
      user_id: userData.id || 'N/A',
      avatar: userData.profile_picture_url || 'https://via.placeholder.com/50',
    });
  } catch (error) {
    console.error('Instagram API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || 'Failed to fetch Instagram data',
      details: error.response?.data || 'No additional details',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Instagram Server running on port ${PORT}`);
});
