import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import formData from 'express-form-data';
import helmet from 'helmet';
import morgan from 'morgan';
import os from 'os';
import config from './config/index.ts';
import openapi from './docs/openapi.ts';
import swaggerUiRouter from './docs/swagger-ui.ts';
import errorHandler from './middlewares/error-handler.ts';
import authRoutes from './modules/auth/auth.routes.ts';
import documentTypeRoutes from './modules/document-type/document-type.routes.ts';
import mediaRoutes from './modules/media/media.routes.ts';
import menuRoutes from './modules/menu/menu.routes.ts';
import schoolRoutes from './modules/school/school.routes.ts';
import userRoutes from './modules/user/user.routes.ts';

const app = express();
const options = {
  uploadDir: os.tmpdir(),
  autoClean: true,
  maxFileSize: 120 * 1024 * 1024,
  maxFilesSize: 120 * 1024 * 1024
}

app.use(helmet());
app.use(
  cors({
    origin: config.cors.origins.length ? config.cors.origins : config.cors.allowAnyOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }),
);
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(formData.parse(options))
app.use(formData.stream());
app.use(express.urlencoded({ extended: true }))
app.use(express.json({ limit: 120 * 1024 * 1024 }))
app.use(morgan('tiny'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (config.docs.enabled) {
  app.get('/api/docs.json', (req, res) => {
    res.json(openapi);
  });
  app.use('/api/docs', swaggerUiRouter);
}
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/user', userRoutes);
app.use('/api/document-types', documentTypeRoutes);
app.use('/api/schools', schoolRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});
app.use(errorHandler);

export default app;
