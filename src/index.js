require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const runMigrations = require('./config/migrate');
const userRoutes = require('./routes/user.routes');
const authRoutes = require('./routes/auth.routes');
const forumRoutes = require('./routes/forum.routes');
const cors = require('cors');
const videoRoutes = require('./routes/video.routes');
const newsRoutes = require('./routes/news.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/users', userRoutes);

app.use('/api/auth', authRoutes);

app.use('/api/forum', forumRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/news', newsRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API corriendo', docs: '/api-docs' });
});

async function start() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`Servidor en http://localhost:${PORT}`);
      console.log(`Swagger en  http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error('Error al iniciar:', err); // Prints the full stack trace
    process.exit(1);
  }
}

start();
