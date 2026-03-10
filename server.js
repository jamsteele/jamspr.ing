const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Link-in-bio page at /insta
app.get('/insta', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Redirect root to /insta for now
app.get('/', (req, res) => {
  res.redirect(301, '/insta');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
