const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint (required by ECS ALB)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'backend-api', timestamp: new Date().toISOString() });
});

// Sample API routes
app.get('/api/items', (req, res) => {
  res.json({
    items: [
      { id: 1, name: 'Product A', price: 29.99, category: 'Electronics' },
      { id: 2, name: 'Product B', price: 49.99, category: 'Clothing' },
      { id: 3, name: 'Product C', price: 9.99,  category: 'Books' },
    ],
    total: 3,
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    service: 'Two-Tier App Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'local'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API running on port ${PORT}`);
});