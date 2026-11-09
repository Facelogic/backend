import { Router } from 'express';
import helmet from 'helmet';

// Swagger UI assets come from a CDN instead of swagger-ui-express's static middleware:
// Vercel's file tracing doesn't bundle node_modules/swagger-ui-dist, so those requests fell
// through to the HTML page ("MIME type 'text/html' is not executable").
const CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1';

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ReconoFacial API</title>
  <link rel="stylesheet" href="${CDN}/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${CDN}/swagger-ui-bundle.js" crossorigin></script>
  <script src="${CDN}/swagger-ui-standalone-preset.js" crossorigin></script>
  <script src="/api/docs/init.js"></script>
</body>
</html>`;

// Served as a file (not inline) so the CSP doesn't need 'unsafe-inline' for scripts.
const init = `window.ui = SwaggerUIBundle({
  url: '/api/docs.json',
  dom_id: '#swagger-ui',
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
  layout: 'StandaloneLayout',
  persistAuthorization: true,
});`;

const router = Router();

router.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      connectSrc: ["'self'"],
    },
  }),
);

router.get('/init.js', (req, res) => {
  res.type('application/javascript').send(init);
});
router.get('/', (req, res) => {
  res.type('html').send(html);
});

export default router;
