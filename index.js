const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5000', 'https://blagofu-frontend.onrender.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Data file paths
const dataDir = path.join(__dirname, 'data');
const productPath = path.join(dataDir, 'products.json');
const materialPath = path.join(dataDir, 'materials.json');
const galleryPath = path.join(dataDir, 'gallery.json');
const messagePath = path.join(dataDir, 'messages.json');
const adminPath = path.join(dataDir, 'admin.json');

// Helper functions to read/write JSON files
const readFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
};

const writeFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// Authentication middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = readFile(adminPath);

    if (username !== admin.username) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get stats
app.get('/api/stats', verifyToken, (req, res) => {
  try {
    const products = readFile(productPath);
    const materials = readFile(materialPath);
    const gallery = readFile(galleryPath);
    const messages = readFile(messagePath);

    const unreadMessages = messages.filter(m => !m.read).length;

    res.json({
      products: products.length,
      materials: materials.length,
      gallery: gallery.length,
      messages: messages.length,
      unreadMessages
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// PRODUCTS ENDPOINTS
app.get('/api/products', verifyToken, (req, res) => {
  try {
    const products = readFile(productPath);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

app.post('/api/products', verifyToken, upload.single('image'), (req, res) => {
  try {
    const products = readFile(productPath);
    const { title, category, description } = req.body;
    const image = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : '';

    const newProduct = {
      id: Date.now().toString(),
      title,
      category,
      description,
      image,
      createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    writeFile(productPath, products);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating product' });
  }
});

app.put('/api/products/:id', verifyToken, upload.single('image'), (req, res) => {
  try {
    const products = readFile(productPath);
    const { id } = req.params;
    const { title, category, description } = req.body;

    const index = products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ message: 'Product not found' });
    }

    products[index] = {
      ...products[index],
      title,
      category,
      description,
      ...(req.file && { image: `http://localhost:5000/uploads/${req.file.filename}` }),
      updatedAt: new Date().toISOString()
    };

    writeFile(productPath, products);
    res.json(products[index]);
  } catch (error) {
    res.status(500).json({ message: 'Error updating product' });
  }
});

app.delete('/api/products/:id', verifyToken, (req, res) => {
  try {
    let products = readFile(productPath);
    const { id } = req.params;

    products = products.filter(p => p.id !== id);
    writeFile(productPath, products);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product' });
  }
});

// MATERIALS ENDPOINTS
app.get('/api/materials', verifyToken, (req, res) => {
  try {
    const materials = readFile(materialPath);
    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching materials' });
  }
});

app.post('/api/materials', verifyToken, upload.single('image'), (req, res) => {
  try {
    const materials = readFile(materialPath);
    const { title, category, description } = req.body;
    const image = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : '';

    const newMaterial = {
      id: Date.now().toString(),
      title,
      category,
      description,
      image,
      createdAt: new Date().toISOString()
    };

    materials.push(newMaterial);
    writeFile(materialPath, materials);
    res.status(201).json(newMaterial);
  } catch (error) {
    res.status(500).json({ message: 'Error creating material' });
  }
});

app.put('/api/materials/:id', verifyToken, upload.single('image'), (req, res) => {
  try {
    const materials = readFile(materialPath);
    const { id } = req.params;
    const { title, category, description } = req.body;

    const index = materials.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ message: 'Material not found' });
    }

    materials[index] = {
      ...materials[index],
      title,
      category,
      description,
      ...(req.file && { image: `http://localhost:5000/uploads/${req.file.filename}` }),
      updatedAt: new Date().toISOString()
    };

    writeFile(materialPath, materials);
    res.json(materials[index]);
  } catch (error) {
    res.status(500).json({ message: 'Error updating material' });
  }
});

app.delete('/api/materials/:id', verifyToken, (req, res) => {
  try {
    let materials = readFile(materialPath);
    const { id } = req.params;

    materials = materials.filter(m => m.id !== id);
    writeFile(materialPath, materials);
    res.json({ message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting material' });
  }
});

// GALLERY ENDPOINTS
app.get('/api/gallery', verifyToken, (req, res) => {
  try {
    const gallery = readFile(galleryPath);
    res.json(gallery);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching gallery' });
  }
});

app.post('/api/gallery', verifyToken, upload.single('image'), (req, res) => {
  try {
    const gallery = readFile(galleryPath);
    const { caption } = req.body;
    const image = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : '';

    const newImage = {
      id: Date.now().toString(),
      image,
      caption,
      createdAt: new Date().toISOString()
    };

    gallery.push(newImage);
    writeFile(galleryPath, gallery);
    res.status(201).json(newImage);
  } catch (error) {
    res.status(500).json({ message: 'Error uploading image' });
  }
});

app.put('/api/gallery/:id', verifyToken, upload.single('image'), (req, res) => {
  try {
    const gallery = readFile(galleryPath);
    const { id } = req.params;
    const { caption } = req.body;

    const index = gallery.findIndex(g => g.id === id);
    if (index === -1) {
      return res.status(404).json({ message: 'Gallery image not found' });
    }

    gallery[index] = {
      ...gallery[index],
      caption,
      ...(req.file && { image: `http://localhost:5000/uploads/${req.file.filename}` }),
      updatedAt: new Date().toISOString()
    };

    writeFile(galleryPath, gallery);
    res.json(gallery[index]);
  } catch (error) {
    res.status(500).json({ message: 'Error updating gallery image' });
  }
});

app.delete('/api/gallery/:id', verifyToken, (req, res) => {
  try {
    let gallery = readFile(galleryPath);
    const { id } = req.params;

    gallery = gallery.filter(g => g.id !== id);
    writeFile(galleryPath, gallery);
    res.json({ message: 'Gallery image deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting image' });
  }
});

// MESSAGES ENDPOINTS
app.get('/api/messages', verifyToken, (req, res) => {
  try {
    const messages = readFile(messagePath);
    res.json(messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

app.post('/api/messages', (req, res) => {
  try {
    const messages = readFile(messagePath);
    const { name, email, phone, message } = req.body;

    const newMessage = {
      id: Date.now().toString(),
      name,
      email,
      phone,
      message,
      createdAt: new Date().toISOString(),
      read: false
    };

    messages.push(newMessage);
    writeFile(messagePath, messages);
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Error saving message' });
  }
});

app.patch('/api/messages/:id/read', verifyToken, (req, res) => {
  try {
    const messages = readFile(messagePath);
    const { id } = req.params;

    const index = messages.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ message: 'Message not found' });
    }

    messages[index].read = true;
    writeFile(messagePath, messages);
    res.json(messages[index]);
  } catch (error) {
    res.status(500).json({ message: 'Error updating message' });
  }
});

app.delete('/api/messages/:id', verifyToken, (req, res) => {
  try {
    let messages = readFile(messagePath);
    const { id } = req.params;

    messages = messages.filter(m => m.id !== id);
    writeFile(messagePath, messages);
    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// PUBLIC ENDPOINTS (No authentication required)
// Public products endpoint for frontend
app.get('/api/public/products', (req, res) => {
  try {
    const products = readFile(productPath);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Public materials endpoint for frontend
app.get('/api/public/materials', (req, res) => {
  try {
    const materials = readFile(materialPath);
    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching materials' });
  }
});

// Public gallery endpoint for frontend
app.get('/api/public/gallery', (req, res) => {
  try {
    const gallery = readFile(galleryPath);
    res.json(gallery);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching gallery' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 BLAGOFU.K Backend API running on http://localhost:${PORT}`);
  console.log(`📊 Admin credentials: username "admin", password "password"`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
