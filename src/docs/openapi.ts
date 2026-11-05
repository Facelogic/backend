// OpenAPI 3 spec served by Swagger UI at /api/docs (raw JSON at /api/docs.json).
// Keep it in sync with the routes in src/modules/*/*.routes.ts.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } },
});

const json = (name: string) => ({ 'application/json': { schema: ref(name) } });

// Most controllers answer `{ status: true, data: ... }`.
const envelope = (data: object) => ({
  type: 'object',
  required: ['status', 'data'],
  properties: { status: { type: 'boolean', example: true }, data },
});
const ok = (description: string, data: object) => ({
  description,
  content: { 'application/json': { schema: envelope(data) } },
});
const okId = (description: string) => ok(description, { type: 'string', format: 'uuid' });

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const query = (name: string, schema: object, description: string) => ({ name, in: 'query', required: false, schema, description });

const bearer = [{ bearerAuth: [] }];
const unauthorized = errorResponse('No autenticado / token inválido o expirado');
const forbidden = errorResponse('Rol sin permiso');

const nullableString = (extra: object = {}) => ({ type: 'string', nullable: true, ...extra });
const nullableDate = { type: 'string', format: 'date-time', nullable: true };

const schoolFields = {
  slug: {
    type: 'string',
    maxLength: 40,
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    example: 'colegio-san-jose',
    description: 'Minúsculas, dígitos y guiones. En POST se deriva del nombre si no se envía.',
  },
  name: { type: 'string', maxLength: 120, example: 'Colegio San José' },
  modularCode: { type: 'string', pattern: '^\\d{7}$', example: '1234567', description: 'Código modular (7 dígitos), único' },
  taxId: { type: 'string', pattern: '^\\d{11}$', example: '20123456789', description: 'RUC (11 dígitos)' },
  address: nullableString({ maxLength: 200 }),
  region: { type: 'string', maxLength: 60, example: 'Lima' },
  province: { type: 'string', maxLength: 60, example: 'Lima' },
  district: { type: 'string', maxLength: 60, example: 'Miraflores' },
  principalName: nullableString({ maxLength: 120 }),
  registrationStatus: { type: 'string', enum: ['DRAFT', 'COMPLETE'] },
  photoService: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE'] },
  photoServiceSince: nullableDate,
  photoServiceCancelledAt: nullableDate,
  photoServiceNote: nullableString({ maxLength: 160 }),
  appPublishedAt: nullableDate,
  contractSignedAt: nullableDate,
};

const userWritableFields = {
  email: { type: 'string', format: 'email' },
  name: { type: 'string' },
  phone: nullableString({
    maxLength: 15,
    example: '+51987654321',
    description: 'Dígitos con "+" opcional al inicio (6–14 dígitos). Se eliminan espacios, guiones y paréntesis. null o "" lo borra.',
  }),
  document: nullableString({ description: 'Número de documento; su longitud debe coincidir con el `size` del tipo de documento' }),
  documentTypeId: { type: 'string', format: 'uuid', nullable: true },
  roleId: { type: 'string', format: 'uuid', description: 'No puede ser el rol SUPERADMIN' },
  schoolId: { type: 'string', format: 'uuid', nullable: true },
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'ReconoFacial API',
    version: '1.0.0',
    description:
      'API backend ReconoFacial.\n\n' +
      'Autenticación con `Authorization: Bearer <token>` obtenido en `POST /api/auth/login` (botón **Authorize**).\n\n' +
      'Las respuestas exitosas tienen la forma `{ "status": true, "data": ... }` (salvo `/health` y `/api/media`). ' +
      'Los errores devuelven `{ "error": "<mensaje>" }`.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Sesiones y cuentas' },
    { name: 'Users', description: 'Gestión de usuarios (SUPERADMIN / APP_ADMIN)' },
    { name: 'Schools', description: 'Gestión de colegios (solo SUPERADMIN)' },
    { name: 'Document Types', description: 'Catálogo de tipos de documento' },
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

      // ---- Auth
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          roleId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'], nullable: true },
          schoolId: { type: 'string', format: 'uuid', nullable: true },
          status: { type: 'integer', enum: [0, 1, 2], description: '0 = DISABLED, 1 = ACTIVE, 2 = INVITED' },
          lastLoginAt: nullableDate,
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
          user: ref('PublicUser'),
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

      // ---- Users
      UserItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          document: nullableString(),
          documentType: nullableString({ example: 'DNI', description: 'Nombre del tipo de documento' }),
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          phone: nullableString(),
          role: { type: 'string', enum: ['SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'] },
          school: nullableString({ description: 'Nombre del colegio' }),
          status: { type: 'string', enum: ['DISABLED', 'ACTIVE', 'INVITED'] },
          createdDate: { type: 'string', example: '05/11/2026', description: 'dd/mm/yyyy' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['email', 'name', 'roleId'],
        properties: userWritableFields,
      },
      UpdateUserRequest: {
        type: 'object',
        description: 'Solo se modifican los campos enviados; null o "" borra los opcionales.',
        properties: {
          ...userWritableFields,
          status: { type: 'integer', enum: [0, 1, 2], description: '0 = DISABLED, 1 = ACTIVE, 2 = INVITED' },
        },
      },

      // ---- Schools
      SchoolItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ...schoolFields,
          status: { type: 'string', enum: ['INACTIVE', 'ACTIVE'] },
          createdDate: { type: 'string', example: '05/11/2026', description: 'dd/mm/yyyy' },
        },
      },
      CreateSchoolRequest: {
        type: 'object',
        required: ['name', 'modularCode', 'taxId', 'region', 'province', 'district'],
        properties: {
          ...schoolFields,
          status: { type: 'integer', enum: [0, 1], description: '0 = INACTIVE, 1 = ACTIVE' },
        },
      },
      UpdateSchoolRequest: {
        type: 'object',
        description: 'Solo se modifican los campos enviados; null o "" borra los opcionales (los obligatorios no pueden vaciarse).',
        properties: {
          ...schoolFields,
          status: { type: 'integer', enum: [0, 1], description: '0 = INACTIVE, 1 = ACTIVE' },
        },
      },

      // ---- Document types
      DocumentTypeItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'DNI' },
          size: { type: 'integer', example: 8, description: 'Longitud exacta del número de documento' },
          description: nullableString(),
        },
      },

      // ---- Menus
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          name: { type: 'string' },
          title: { type: 'string' },
          description: nullableString(),
          path: { type: 'string', example: '/proveedor/colegios' },
          area: { type: 'string', enum: ['provider', 'school'] },
          section: { type: 'string', example: 'colegios' },
        },
      },

      // ---- Media
      CreateUploadRequest: {
        type: 'object',
        required: ['mimeType'],
        properties: {
          mimeType: {
            type: 'string',
            enum: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
            example: 'image/jpeg',
          },
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
          originalName: nullableString(),
          mimeType: { type: 'string' },
          sizeBytes: { type: 'integer', nullable: true },
          checksumSha256: nullableString(),
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
          ref('Media'),
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

    // ---- Auth
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        requestBody: { required: true, content: json('LoginRequest') },
        responses: {
          200: ok('Sesión creada', ref('LoginResponse')),
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
        summary: 'Crear una cuenta con contraseña (SUPERADMIN / APP_ADMIN)',
        security: bearer,
        requestBody: { required: true, content: json('RegisterRequest') },
        responses: {
          201: ok('Usuario creado', ref('PublicUser')),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: forbidden,
          409: errorResponse('Email ya registrado'),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar la sesión actual',
        security: bearer,
        responses: {
          204: { description: 'Sesión cerrada satisfactoriamente (sin cuerpo)' },
          401: unauthorized,
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Usuario autenticado',
        security: bearer,
        responses: {
          200: ok('Usuario', ref('PublicUser')),
          401: unauthorized,
        },
      },
    },

    // ---- Users
    '/api/user': {
      get: {
        tags: ['Users'],
        summary: 'Listar usuarios',
        description:
          'Excluye a los SUPERADMIN. Un SUPERADMIN ve todos los colegios; otro rol solo ve los usuarios de su colegio ' +
          '(el filtro `schoolId` se ignora). Solo incluye usuarios con rol y colegio activos.',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre (sin distinguir mayúsculas)'),
          query('roleId', { type: 'string', format: 'uuid' }, 'Rol exacto'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto (solo SUPERADMIN)'),
          query('status', { type: 'integer', enum: [0, 1, 2] }, '0 = DISABLED, 1 = ACTIVE, 2 = INVITED'),
        ],
        responses: {
          200: ok('Usuarios ordenados por fecha de creación', { type: 'array', items: ref('UserItem') }),
          400: errorResponse('Filtro inválido'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Crear usuario',
        security: bearer,
        requestBody: { required: true, content: json('CreateUserRequest') },
        responses: {
          200: okId('Id del usuario creado'),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o intento de asignar el rol SUPERADMIN'),
          409: errorResponse('Email o documento ya registrado'),
        },
      },
    },
    '/api/user/{id}': {
      put: {
        tags: ['Users'],
        summary: 'Actualizar usuario',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('UpdateUserRequest') },
        responses: {
          200: okId('Id del usuario actualizado'),
          400: errorResponse('Datos inválidos, documento con longitud incorrecta o FK inexistente'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o intento de asignar el rol SUPERADMIN'),
          404: errorResponse('Usuario no encontrado'),
          409: errorResponse('Email o documento ya registrado'),
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Deshabilitar usuario (soft delete)',
        description: 'Marca la cuenta como DISABLED y cierra todas sus sesiones. No se puede eliminar la propia cuenta.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id del usuario deshabilitado'),
          400: errorResponse('No puedes eliminar tu propia cuenta'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Usuario no encontrado'),
        },
      },
    },

    // ---- Schools
    '/api/schools': {
      get: {
        tags: ['Schools'],
        summary: 'Listar colegios',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre (sin distinguir mayúsculas)'),
          query('status', { type: 'integer', enum: [0, 1] }, '0 = INACTIVE, 1 = ACTIVE'),
        ],
        responses: {
          200: ok('Colegios ordenados por nombre', { type: 'array', items: ref('SchoolItem') }),
          400: errorResponse('Filtro inválido'),
          401: unauthorized,
          403: forbidden,
        },
      },
      post: {
        tags: ['Schools'],
        summary: 'Crear colegio',
        security: bearer,
        requestBody: { required: true, content: json('CreateSchoolRequest') },
        responses: {
          201: okId('Id del colegio creado'),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: forbidden,
          409: errorResponse('Código modular o slug ya registrado'),
        },
      },
    },
    '/api/schools/{id}': {
      get: {
        tags: ['Schools'],
        summary: 'Obtener colegio',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok('Colegio', ref('SchoolItem')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Colegio no encontrado'),
        },
      },
      put: {
        tags: ['Schools'],
        summary: 'Actualizar colegio',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('UpdateSchoolRequest') },
        responses: {
          200: okId('Id del colegio actualizado'),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Colegio no encontrado'),
          409: errorResponse('Código modular o slug ya registrado'),
        },
      },
      delete: {
        tags: ['Schools'],
        summary: 'Desactivar colegio (soft delete)',
        description: 'Marca el colegio como INACTIVE; la fila se conserva porque otras tablas la referencian.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id del colegio desactivado'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Colegio no encontrado'),
        },
      },
    },

    // ---- Document types
    '/api/document-types': {
      get: {
        tags: ['Document Types'],
        summary: 'Listar tipos de documento',
        security: bearer,
        responses: {
          200: ok('Tipos de documento ordenados por nombre', { type: 'array', items: ref('DocumentTypeItem') }),
          401: unauthorized,
        },
      },
    },

    // ---- Menus
    '/api/menus': {
      get: {
        tags: ['Menus'],
        summary: 'Menú del usuario según su rol',
        security: bearer,
        responses: {
          200: ok('Items de menú activos', { type: 'array', items: ref('MenuItem') }),
          401: unauthorized,
          403: errorResponse('La cuenta no tiene rol asignado'),
        },
      },
    },

    // ---- Media (respuestas sin envoltorio { status, data })
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
