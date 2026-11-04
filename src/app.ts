import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import config from './config/index.ts';
import openapi from './docs/openapi.ts';
import authRoutes from './modules/auth/auth.routes.ts';
import mediaRoutes from './modules/media/media.routes.ts';
import menuRoutes from './modules/menu/menu.routes.ts';
import errorHandler from './middlewares/error-handler.ts';

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

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});
app.use(errorHandler);

export default app;
