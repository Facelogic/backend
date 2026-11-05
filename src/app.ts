import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import config from './config/index.ts';
import openapi from './docs/openapi.ts';
import errorHandler from './middlewares/error-handler.ts';
import authRoutes from './modules/auth/auth.routes.ts';
import documentTypeRoutes from './modules/document-type/document-type.routes.ts';
import mediaRoutes from './modules/media/media.routes.ts';
import menuRoutes from './modules/menu/menu.routes.ts';
import schoolRoutes from './modules/school/school.routes.ts';
import userRoutes from './modules/user/user.routes.ts';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
if (config.docs.enabled) {
  app.get('/api/docs.json', (req, res) => {
    res.json(openapi);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: true } }));
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
