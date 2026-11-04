// OpenAPI 3 spec served by Swagger UI at /api/docs (raw JSON at /api/docs.json).
// Keep it in sync with the routes in src/modules/*/*.routes.ts.

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const json = (ref: string) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } });

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'ReconoFacial API',
    version: '1.0.0',
    description: 'API backend ReconoFacial. Autenticación con `Authorization: Bearer <token>` obtenido en `POST /api/auth/login`.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Sesiones y cuentas' },
    { name: 'Menus', description: 'Menú del usuario autenticado según su rol' },
    { name: 'Media', description: 'Subida de archivos con URL prefirmada' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Token opaco devuelto por /api/auth/login' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string', example: 'Invalid credentials' } },
        required: ['error'],
      },
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          roleId: { type: 'string', format: 'uuid', nullable: true },
          role: { type: 'string', enum: ['SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'], nullable: true },
          schoolId: { type: 'string', format: 'uuid', nullable: true },
          status: { type: 'string', enum: ['INVITED', 'ACTIVE', 'DISABLED'] },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@reconofacial.local' },
          password: { type: 'string', format: 'password', example: 'ChangeMe123!' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
          user: { $ref: '#/components/schemas/PublicUser' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'name', 'password', 'roleId'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          password: { type: 'string', format: 'password', minLength: 8 },
          roleId: { type: 'string', format: 'uuid' },
          schoolId: {
            type: 'string',
            format: 'uuid',
            description: 'Obligatorio salvo para el rol SUPERADMIN (se ignora en ese caso)',
          },
        },
      },
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          name: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          path: { type: 'string', example: '/proveedor/colegios' },
          area: { type: 'string', enum: ['provider', 'school'] },
          section: { type: 'string', example: 'colegios' },
        },
      },
      CreateUploadRequest: {
        type: 'object',
        required: ['mimeType'],
        properties: {
          mimeType: { type: 'string', example: 'image/jpeg' },
          originalName: { type: 'string', example: 'foto.jpg' },
        },
      },
      CreateUploadResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          storageKey: { type: 'string' },
          uploadUrl: { type: 'string', format: 'uri', description: 'Hacer PUT del archivo a esta URL' },
          method: { type: 'string', enum: ['PUT'] },
        },
      },
      Media: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          kind: { type: 'string', enum: ['image', 'video'] },
          status: { type: 'string', enum: ['pending', 'uploaded', 'processing', 'ready', 'failed'] },
          bucket: { type: 'string' },
          storageKey: { type: 'string' },
          originalName: { type: 'string', nullable: true },
          mimeType: { type: 'string' },
          sizeBytes: { type: 'integer', nullable: true },
          checksumSha256: { type: 'string', nullable: true },
          width: { type: 'integer', nullable: true },
          height: { type: 'integer', nullable: true },
          durationMs: { type: 'integer', nullable: true },
          variants: { type: 'object', additionalProperties: { type: 'string' } },
          ownerId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      MediaWithUrl: {
        allOf: [
          { $ref: '#/components/schemas/Media' },
          {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri', nullable: true, description: 'URL prefirmada de descarga; null si está pending' },
            },
          },
        ],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Estado del servicio',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        requestBody: { required: true, content: json('LoginRequest') },
        responses: {
          200: { description: 'Sesión creada', content: json('LoginResponse') },
          400: errorResponse('Faltan email o password'),
          401: errorResponse('Credenciales inválidas'),
          403: errorResponse('Cuenta no activa'),
          423: errorResponse('Cuenta bloqueada temporalmente'),
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Crear una cuenta (solo SUPERADMIN / APP_ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: json('RegisterRequest') },
        responses: {
          201: { description: 'Usuario creado', content: json('PublicUser') },
          400: errorResponse('Datos inválidos'),
          401: errorResponse('No autenticado'),
          403: errorResponse('Rol sin permiso'),
          409: errorResponse('Email ya registrado'),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar la sesión actual',
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: 'Sesión cerrada satisfactoriamente' },
          401: errorResponse('No autenticado'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Usuario', content: json('PublicUser') },
          401: errorResponse('No autenticado'),
        },
      },
    },
    '/api/menus': {
      get: {
        tags: ['Menus'],
        summary: 'Menú del usuario según su rol',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Items de menú activos',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MenuItem' } } } },
          },
          401: errorResponse('No autenticado'),
          403: errorResponse('La cuenta no tiene rol asignado'),
        },
      },
    },
    '/api/media/uploads': {
      post: {
        tags: ['Media'],
        summary: '1. Solicitar URL prefirmada de subida',
        requestBody: { required: true, content: json('CreateUploadRequest') },
        responses: {
          201: { description: 'Registro creado en estado pending', content: json('CreateUploadResponse') },
          415: errorResponse('Tipo de archivo no soportado'),
        },
      },
    },
    '/api/media/{id}/confirm': {
      post: {
        tags: ['Media'],
        summary: '2. Confirmar la subida tras el PUT al storage',
        parameters: [idParam],
        responses: {
          200: { description: 'Media marcada como uploaded y encolada para procesamiento', content: json('Media') },
          404: errorResponse('Media no encontrada'),
          409: errorResponse('El objeto aún no existe en el storage'),
        },
      },
    },
    '/api/media/{id}': {
      get: {
        tags: ['Media'],
        summary: 'Obtener media con URL de descarga',
        parameters: [idParam],
        responses: {
          200: { description: 'Media', content: json('MediaWithUrl') },
          404: errorResponse('Media no encontrada'),
        },
      },
    },
  },
};

export default openapi;
