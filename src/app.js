const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mediaRoutes = require('./modules/media/media.routes');
const errorHandler = require('./middlewares/error-handler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/media', mediaRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use(errorHandler);

module.exports = app;
