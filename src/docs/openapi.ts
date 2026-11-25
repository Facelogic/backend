// OpenAPI 3 spec served by Swagger UI at /api/docs (raw JSON at /api/docs.json).
// Keep it in sync with the routes in src/modules/*/*.routes.ts.

import { ValidationMethod } from '../db/models/enums.ts';
import {
  APP_ADMIN_SETTINGS_FIELDS,
  SUPERADMIN_SETTINGS_FIELDS,
  type SchoolSettingsField,
} from '../interfaces/school-settings.interface.ts';

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

// Either the session cookie (browsers, Swagger after login) or a bearer token.
const bearer = [{ cookieAuth: [] }, { bearerAuth: [] }];
const unauthorized = errorResponse('No autenticado / token inválido o expirado');
const forbidden = errorResponse('Rol sin permiso');

const nullableString = (extra: object = {}) => ({ type: 'string', nullable: true, ...extra });
const nullableDate = { type: 'string', format: 'date-time', nullable: true };

const FACE_NUMERIC_FIELDS = [
  'recongnitionMinimumSimilarityStudent',
  'recongnitionMinimalLeadStudent',
  'recognitionConsecutiveMatchStudent',
  'recongnitionMinimumAntiFraudStudent',
  'recongnitionMinimumSimilarityStaff',
  'recongnitionMinimalLeadStaff',
  'recognitionConsecutiveMatchStaff',
  'recongnitionMinimumAntiFraudStaff',
  'enrollHeadOn',
  'enrollMinimalLateral',
  'enrollMaximumLateral',
  'learningTemplatePerPerson',
  'learningMinimumConfidence',
  'learningAdvantageOnSecondPlace',
  'learningMinimumSimilarityThreePoses',
  'learningMaximumSimilarityTemplates',
  'learningMinimumAntiFraud',
  'learningMaximumHeadRotation',
  'learningMinimumFaceSize',
  'learningFrequencyPerPerson',
];
const paginationParams = [
  query('page', { type: 'integer', minimum: 1, default: 1 }, 'Número de página (desde 1)'),
  query('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 10 }, 'Elementos por página (máximo 100)'),
];
// Paginated lists answer `{ status: true, data: [...], pagination: {...} }`.
const okPage = (description: string, item: object) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['status', 'data', 'pagination'],
        properties: {
          status: { type: 'boolean', example: true },
          data: { type: 'array', items: item },
          pagination: ref('Pagination'),
        },
      },
    },
  },
});
const schoolIdParam = { name: 'schoolId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const intProp = (min: number, def: number, description: string) => ({ type: 'integer', minimum: min, default: def, description });
const boolProp = (description: string) => ({ type: 'boolean', default: true, description });
// Every editable setting; which role can change each one comes from SUPERADMIN_SETTINGS_FIELDS and
// APP_ADMIN_SETTINGS_FIELDS (src/interfaces/school-settings.interface.ts), so the docs follow the code.
const settingsProps: Record<SchoolSettingsField, object> = {
  photoOnlyWithConsent: boolProp('Solo se envían/guardan fotos de apoderados con consentimiento firmado'),
  photoRetentionDays: intProp(1, 30, 'Días que se conservan las fotos de los retiros'),
  flagUnopened: boolProp('Marcar notificaciones no abiertas'),
  unopenedMinutes: intProp(1, 10, 'Minutos sin abrir tras los que se marca una notificación'),
  disputeButtonEnabled: boolProp('Botón para que el apoderado dispute un retiro'),
  reminderEnabled: boolProp('Enviar recordatorios'),
  reminderMinutes: intProp(1, 30, 'Minutos tras la salida para el primer recordatorio'),
  reminderRepeats: intProp(0, 2, 'Repeticiones del recordatorio'),
  reminderIntervalMin: intProp(1, 30, 'Minutos entre repeticiones'),
  codeEnabled: boolProp('Permitir códigos de retiro para terceros'),
  codeValidity: { type: 'string', enum: ['UNTIL_18H', 'FOUR_HOURS'], default: 'UNTIL_18H', description: 'Vigencia del código' },
  codesPerStudentPerDay: intProp(1, 1, 'Códigos por alumno por día'),
  codeIssuer: {
    type: 'string',
    enum: ['PRIMARY_GUARDIANS', 'ALL_GUARDIANS'],
    default: 'PRIMARY_GUARDIANS',
    description: 'Quién puede generar códigos',
  },
  attemptsBeforeLock: intProp(1, 3, 'Intentos fallidos antes de bloquear el código'),
  validateFaceOnArrival: boolProp('Validar rostro en la llegada'),
  notifyArrival: boolProp('Notificar la llegada al apoderado'),
  allowNationalId: boolProp('Permitir DNI como método alternativo'),
  notificationShowsValidation: boolProp('La notificación muestra el método de validación'),
  notificationShowsPhoto: boolProp('La notificación incluye la foto'),
};
const pickSettings = (fields: readonly SchoolSettingsField[]) =>
  Object.fromEntries(fields.map((field) => [field, settingsProps[field]]));
const superadminSettingsProps = pickSettings(SUPERADMIN_SETTINGS_FIELDS);
const appAdminSettingsProps = pickSettings(APP_ADMIN_SETTINGS_FIELDS);
// Fields one role can change and the other can't (both can change the ones in both lists).
const superadminOnlySettings = SUPERADMIN_SETTINGS_FIELDS.filter((f) => !(APP_ADMIN_SETTINGS_FIELDS as readonly string[]).includes(f));
const appAdminOnlySettings = APP_ADMIN_SETTINGS_FIELDS.filter((f) => !(SUPERADMIN_SETTINGS_FIELDS as readonly string[]).includes(f));
const sharedSettings = SUPERADMIN_SETTINGS_FIELDS.filter((f) => (APP_ADMIN_SETTINGS_FIELDS as readonly string[]).includes(f));
const codeList = (fields: readonly string[]) => (fields.length ? fields.map((f) => `\`${f}\``).join(', ') : 'ninguno');
const versionParam = { name: 'version', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } };
const faceParameterProps = {
  ...Object.fromEntries(FACE_NUMERIC_FIELDS.map((field) => [field, { type: 'number', example: 0.75, description: 'NUMERIC(12,4)' }])),
  autoLearning: { type: 'boolean', default: true },
  learOnlyPersonnelRecognitions: { type: 'boolean', default: true },
};

const timePattern = String.raw`^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$`;

const scheduleFields = {
  level: { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY'] },
  startTime: {
    type: 'string',
    pattern: timePattern,
    example: '07:45',
    description: 'HH:MM o HH:MM:SS (24 h). Debe ser anterior a endTime.',
  },
  endTime: { type: 'string', pattern: timePattern, example: '13:30', description: 'HH:MM o HH:MM:SS (24 h)' },
};

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
  phone: nullableString({
    maxLength: 15,
    example: '+5114567890',
    description: 'Dígitos con "+" opcional al inicio (6–14 dígitos). Se eliminan espacios, guiones y paréntesis. null o "" lo borra.',
  }),
  // photoService: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE'] },
  // photoServiceSince: nullableDate,
  // photoServiceCancelledAt: nullableDate,
  // photoServiceNote: nullableString({ maxLength: 160 }),
  // appPublishedAt: nullableDate,
  // contractSignedAt: nullableDate,
};

const userWritableFields = {
  email: { type: 'string', format: 'email' },
  name: { type: 'string' },
  phone: nullableString({
    maxLength: 15,
    example: '+51987654321',
    description: 'Dígitos con "+" opcional al inicio (6–14 dígitos). Se eliminan espacios, guiones y paréntesis. null o "" lo borra.',
  }),
  position: nullableString({ maxLength: 80, example: 'Coordinadora', description: 'Cargo (opcional). null o "" lo borra.' }),
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
      'Autenticación por cookie httpOnly `session`: `POST /api/auth/login` la crea (Set-Cookie) y `POST /api/auth/logout` la elimina. ' +
      'Desde otro dominio, el frontend debe enviar las peticiones con credenciales (`credentials: "include"` / `withCredentials: true`). ' +
      'También se acepta `Authorization: Bearer <token>` para clientes que no son navegador.\n\n' +
      'Las respuestas exitosas tienen la forma `{ "status": true, "data": ... }` (salvo `/health` y `/api/media`). ' +
      'Los errores devuelven `{ "error": "<mensaje>" }`, con el mensaje siempre en español.\n\n' +
      'Errores generales (en cualquier ruta):\n' +
      '- `400` "El cuerpo de la solicitud no es un JSON válido" — body JSON mal formado.\n' +
      '- `413` "El cuerpo de la solicitud es demasiado grande" — body por encima del límite.\n' +
      '- `404` "Recurso no encontrado" — la ruta no existe.\n' +
      '- `500` "Error interno del servidor" — el detalle solo se registra en el log del servidor.\n\n' +
      'Exportación a Excel: `GET /api/schools/export`, `GET /api/stations/export` y `GET /api/user/export` devuelven ' +
      '`{ "status": true, "data": [ ...filas ] }` sin paginar; cada fila es plana y sus claves son los encabezados de columna ' +
      '(ver el esquema `ExportRow`), lista para `XLSX.utils.json_to_sheet(data)`.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Sesiones y cuentas' },
    { name: 'Users', description: 'Gestión y exportación a Excel de usuarios (SUPERADMIN / APP_ADMIN)' },
    { name: 'Schools', description: 'Gestión, cambio de estado y exportación a Excel de colegios (solo SUPERADMIN)' },
    { name: 'Stations', description: 'Gestión, cambio de estado y exportación a Excel de estaciones (solo SUPERADMIN)' },
    { name: 'Students', description: 'Gestión y exportación a Excel de estudiantes (SUPERADMIN: todos los colegios / APP_ADMIN: su colegio)' },
    { name: 'Pickups', description: 'Registro y listado de recojos de alumnos (SUPERADMIN: todos los colegios / APP_ADMIN y DOOR_STAFF: su colegio)' },
    {
      name: 'Staff',
      description:
        'Personal del colegio. Cada personal está relacionado con un usuario (`userId`), del que toma nombre, documento, correo, cargo y colegio. ' +
        'Crear: SUPERADMIN y APP_ADMIN; listado simple: también DOOR_STAFF (SUPERADMIN indica schoolId / el resto: su colegio)',
    },
    {
      name: 'Enrollments',
      description:
        'Enrolamiento facial de personal y apoderados (SUPERADMIN: todos los colegios / APP_ADMIN y DOOR_STAFF: su colegio; ' +
        'editar y eliminar solo SUPERADMIN / APP_ADMIN)',
    },
    { name: 'Attendance', description: 'Registro y listado de asistencia del personal (SUPERADMIN: todos los colegios / APP_ADMIN y DOOR_STAFF: su colegio)' },
    {
      name: 'Classrooms',
      description:
        'Aulas del colegio de la sesión (SUPERADMIN indica schoolId; APP_ADMIN: su colegio). Un alumno pertenece a una sola aula ' +
        '(`Student.classroomId`); un aula puede tener varios alumnos. Cada aula recibe automáticamente los horarios activos ' +
        'de su colegio con su mismo nivel (un aula puede tener varios horarios y un horario varias aulas, siempre del mismo colegio).',
    },
    {
      name: 'Shifts',
      description:
        'Turnos del personal del colegio de la sesión (SUPERADMIN indica schoolId). Gestión: SUPERADMIN y APP_ADMIN; ' +
        'listado simple: también DOOR_STAFF',
    },
    {
      name: 'Schedules',
      description:
        'Horarios por nivel de cada colegio (solo SUPERADMIN). Cada horario activo se aplica automáticamente a todas las aulas ' +
        'de su colegio con el mismo nivel.',
    },
    {
      name: 'School Settings',
      description:
        'Configuración de cada colegio. ' +
        `Solo SUPERADMIN (cualquier colegio): ${codeList(superadminOnlySettings)}. ` +
        `Solo APP_ADMIN (su colegio): ${codeList(appAdminOnlySettings)}. ` +
        `Ambos perfiles: ${codeList(sharedSettings)}.`,
    },
    { name: 'Face Parameters', description: 'Parámetros de reconocimiento facial, versionados (solo SUPERADMIN)' },
    { name: 'Document Types', description: 'Catálogo de tipos de documento' },
    { name: 'Roles', description: 'Catálogo de roles asignables' },
    { name: 'Dashboard', description: 'Indicadores de la consola del proveedor' },
    { name: 'Menus', description: 'Menú del usuario autenticado según su rol' },
    { name: 'Media', description: 'Archivos de cada colegio: subida directa (multipart) o con URL prefirmada' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'session', description: 'Cookie httpOnly creada por /api/auth/login' },
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Token opaco de sesión (clientes que no son navegador)' },
    },
    schemas: {
      Error: {
        type: 'object',
        description: 'Respuesta de error; el mensaje siempre está en español.',
        properties: { error: { type: 'string', example: 'Credenciales inválidas' } },
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
          school: {
            type: 'object',
            nullable: true,
            description: 'Colegio del usuario (APP_ADMIN / DOOR_STAFF); null para SUPERADMIN',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string', example: 'Colegio San José' },
              slug: { type: 'string', example: 'colegio-san-jose' },
            },
          },
          status: { type: 'integer', enum: [0, 1, 2], description: '0 = DISABLED, 1 = ACTIVE, 2 = INVITED' },
          lastLoginAt: nullableDate,
        },
      },
      ValidateInvitationRequest: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string', description: 'Token recibido en el fragmento del enlace del correo (#token=...)' } },
      },
      InvitationInfo: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: nullableString(),
          school: nullableString(),
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      AcceptInvitationRequest: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string', description: 'Token recibido en el fragmento del enlace del correo (#token=...)' },
          password: { type: 'string', format: 'password', minLength: 8 },
          confirmPassword: { type: 'string', format: 'password', description: 'Opcional; si se envía debe coincidir con password' },
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
          name: { type: 'string', example: 'María Pérez' },
          email: { type: 'string', format: 'email' },
          phone: nullableString({ example: '+51987654321' }),
          position: nullableString({ example: 'Coordinadora', description: 'Cargo' }),
          role: { type: 'string', enum: ['APP_ADMIN', 'DOOR_STAFF'] },
          school: nullableString({ description: 'Nombre del colegio' }),
          status: { type: 'string', enum: ['DISABLED', 'ACTIVE', 'INVITED'] },
        },
      },
      UserDetail: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'María Pérez' },
          email: { type: 'string', format: 'email' },
          phone: nullableString({ example: '+51987654321' }),
          document: nullableString({ example: '12345678', description: 'Número de documento' }),
          position: nullableString({ example: 'Coordinadora', description: 'Cargo' }),
          documentTypeId: nullableString({ format: 'uuid' }),
          roleId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['APP_ADMIN', 'DOOR_STAFF'] },
          schoolId: nullableString({ format: 'uuid' }),
          school: nullableString({ description: 'Nombre del colegio' }),
          status: { type: 'string', enum: ['DISABLED', 'ACTIVE', 'INVITED'] },
          lastLoginAt: nullableDate,
          createdDate: { type: 'string', example: '11/11/2026', description: 'dd/mm/yyyy' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['name', 'email', 'documentTypeId', 'document', 'roleId', 'schoolId'],
        properties: {
          name: { type: 'string', maxLength: 120, example: 'María Pérez', description: 'Nombre y apellido' },
          email: userWritableFields.email,
          documentTypeId: { type: 'string', format: 'uuid', description: 'Tipo de documento' },
          document: {
            type: 'string',
            example: '12345678',
            description: 'Número de documento; su longitud debe coincidir con el `size` del tipo de documento. Único.',
          },
          phone: userWritableFields.phone,
          position: userWritableFields.position,
          roleId: userWritableFields.roleId,
          schoolId: {
            type: 'string',
            format: 'uuid',
            description: 'Un rol distinto de SUPERADMIN solo puede crear usuarios de su propio colegio',
          },
        },
      },
      CreateStaffRequest: {
        type: 'object',
        description:
          'Crea el usuario (mismos campos y reglas que POST /api/user, con `position` obligatorio) y su registro de personal. ' +
          'Staff no guarda nombre, documento, correo, cargo ni colegio: se relaciona con el usuario por `userId` y solo guarda `department`, `shiftId` y `active`.',
        required: ['name', 'email', 'documentTypeId', 'document', 'roleId', 'position', 'department'],
        properties: {
          name: { type: 'string', maxLength: 120, example: 'Carlos Mendoza Ríos', description: 'Nombre y apellido (se guarda en el usuario)' },
          email: userWritableFields.email,
          documentTypeId: { type: 'string', format: 'uuid', description: 'Tipo de documento' },
          document: {
            type: 'string',
            example: '12345678',
            description: 'Número de documento; su longitud debe coincidir con el `size` del tipo de documento. Único.',
          },
          phone: userWritableFields.phone,
          position: { type: 'string', maxLength: 80, example: 'Docente', description: 'Cargo (se guarda en el usuario)' },
          roleId: userWritableFields.roleId,
          schoolId: {
            type: 'string',
            format: 'uuid',
            description: 'Colegio del usuario (y por lo tanto del personal). Obligatorio solo para SUPERADMIN; APP_ADMIN usa su colegio',
          },
          department: { type: 'string', maxLength: 60, example: 'Primaria', description: 'Área del personal' },
          shiftId: { type: 'string', format: 'uuid', nullable: true, description: 'Turno del mismo colegio (opcional)' },
        },
      },
      UpdateUserRequest: {
        type: 'object',
        description:
          'Solo se modifican los campos enviados; null o "" borra los opcionales. Si se envía document o documentTypeId, ' +
          'la longitud del documento se valida contra el `size` de su tipo. Para solo activar/desactivar usar PATCH /api/user/{id}/status.',
        properties: {
          ...userWritableFields,
          status: { type: 'integer', enum: [0, 1, 2], description: '0 = DISABLED, 1 = ACTIVE, 2 = INVITED' },
        },
      },

      // ---- Schools
      SchoolOption: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'I.E. San Martín' },
        },
      },
      SchoolItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ...schoolFields,
          // Returned by the API although they can't be sent in the requests yet (see schoolFields).
          photoService: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE'] },
          photoServiceSince: nullableDate,
          photoServiceCancelledAt: nullableDate,
          photoServiceNote: nullableString({ maxLength: 160 }),
          appPublishedAt: nullableDate,
          contractSignedAt: nullableDate,
          status: { type: 'string', enum: ['INACTIVE', 'ACTIVE'] },
          createdDate: { type: 'string', example: '05/11/2026', description: 'dd/mm/yyyy' },
          stationCount: { type: 'integer', example: 2, description: 'Cantidad de estaciones activas del colegio' },
          totalStationCount: { type: 'integer', example: 3, description: 'Cantidad total de estaciones del colegio, activas o no' },
          sendPhotos: { type: 'string', example: '-', description: 'Solo en GET /api/schools. Por ahora siempre "-".' },
          consentingAdults: { type: 'integer', example: 0, description: 'Solo en GET /api/schools. Por ahora siempre 0.' },
          lastSync: { type: 'string', example: '-', description: 'Solo en GET /api/schools. Por ahora siempre "-".' },
          schedules: {
            type: 'array',
            items: ref('ScheduleItem'),
            description: 'Solo en GET /api/schools/{id}: horarios activos ordenados por nivel.',
          },
        },
      },
      CreateSchoolRequest: {
        type: 'object',
        required: ['name', 'modularCode', 'taxId', 'region', 'province', 'district'],
        properties: {
          ...schoolFields,
          // status: { type: 'integer', enum: [0, 1], description: '0 = INACTIVE, 1 = ACTIVE' },
          schedules: {
            type: 'array',
            description:
              'Horarios del colegio; se crean con el schoolId del colegio nuevo, en la misma transacción que el colegio. ' +
              'Se aplican a las aulas del colegio según su nivel, incluidas las que se creen después.',
            items: ref('SchoolScheduleInput'),
          },
        },
      },
      UpdateSchoolRequest: {
        type: 'object',
        description:
          'Solo se modifican los campos enviados; null o "" borra los opcionales (los obligatorios no pueden vaciarse). ' +
          'El estado no se cambia aquí (si se envía status, se ignora): usar PATCH /api/schools/{id}/status.',
        properties: {
          ...schoolFields,
          schedules: {
            type: 'array',
            description:
              'Lista completa de horarios del colegio (si se omite, no se tocan). Los que traen id de un horario activo ' +
              'del colegio se actualizan, los que no traen id se crean y los horarios activos que no aparecen pasan a status 0. ' +
              'Un arreglo vacío desactiva todos. Se aplica en la misma transacción que los datos del colegio. ' +
              'Las aulas se revinculan según su nivel: los horarios nuevos se les agregan, los desactivados se les quitan ' +
              'y un horario que cambia de nivel pasa a las aulas del nuevo nivel.',
            items: ref('UpdateSchoolScheduleInput'),
          },
        },
      },
      ChangeUserStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'integer', enum: [0, 1], description: '0 = DISABLED (inactivo), 1 = ACTIVE' },
        },
      },
      ChangeSchoolStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'integer', enum: [0, 1], description: '0 = INACTIVE, 1 = ACTIVE' },
        },
      },
      ChangeStationStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'integer', enum: [0, 1], description: '0 = INACTIVE, 1 = ACTIVE' },
        },
      },
      StudentListItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          firstName: { type: 'string', example: 'Lucía' },
          lastName: { type: 'string', example: 'Ramírez Torres' },
          documentType: nullableString({ example: 'DNI' }),
          document: nullableString({ example: '71234567' }),
          level: { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY'] },
          grade: { type: 'string', example: '3' },
          section: nullableString({ example: 'A' }),
          canLeaveAlone: { type: 'boolean' },
          school: { type: 'string' },
        },
      },
      StudentDetail: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          documentTypeId: nullableString({ format: 'uuid' }),
          documentType: nullableString(),
          document: nullableString(),
          level: { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY'] },
          grade: { type: 'string' },
          section: nullableString(),
          canLeaveAlone: { type: 'boolean' },
          badgeCode: { type: 'string', example: 'EST-K7M2Q9XA' },
          schoolId: { type: 'string', format: 'uuid' },
          school: { type: 'string' },
          createdDate: { type: 'string' },
        },
      },
      StudentRequest: {
        type: 'object',
        description:
          'En POST son obligatorios firstName, lastName, level y grade (y schoolId si es SUPERADMIN; APP_ADMIN usa su colegio). ' +
          'En PUT solo se cambian los campos enviados (schoolId se ignora); null o vacío limpia los opcionales. ' +
          'document es opcional; si se envía requiere documentTypeId y debe tener la longitud del tipo (DNI 8, ...).',
        properties: {
          firstName: { type: 'string', maxLength: 80, example: 'Lucía' },
          lastName: { type: 'string', maxLength: 80, example: 'Ramírez Torres' },
          documentTypeId: nullableString({ format: 'uuid' }),
          document: nullableString({ maxLength: 12, example: '71234567' }),
          level: {
            type: 'string',
            enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY', 'INICIAL', 'PRIMARIA', 'SECUNDARIA'],
            description: 'Se guarda como PRESCHOOL / PRIMARY / SECONDARY',
          },
          grade: { type: 'string', maxLength: 20, example: '3' },
          section: nullableString({ maxLength: 10, example: 'A' }),
          canLeaveAlone: { type: 'boolean', default: false, description: 'Si puede salir solo del colegio' },
          schoolId: { type: 'string', format: 'uuid', description: 'Solo SUPERADMIN, solo en POST' },
        },
      },
      ValidationMethod: {
        type: 'string',
        enum: [...ValidationMethod],
        description:
          'Cómo se validó a quien recoge al alumno:\n' +
          '- `FACE`: reconocimiento facial del apoderado.\n' +
          '- `CODE`: código personal del apoderado.\n' +
          '- `NATIONAL_ID`: documento de identidad (DNI) del apoderado.\n' +
          '- `UNACCOMPANIED`: el alumno sale solo ("Salió solo"); no hay apoderado.\n' +
          '- `MANUAL`: registro manual del personal (status por defecto MANUAL, que exige `manualReason`).\n\n' +
          'FACE, CODE y NATIONAL_ID identifican a una persona: con status AUTHORIZED y guardianId, el apoderado debe tener una autorización vigente con canPickUp.',
      },
      PickupListItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', example: 'RET-20261122-000015' },
          occurredAt: { type: 'string', format: 'date-time' },
          date: { type: 'string', example: '22/11/2026', description: 'dd/mm/yyyy (Lima)' },
          time: { type: 'string', example: '13:05', description: 'HH:mm (Lima)' },
          studentId: { type: 'string', format: 'uuid' },
          student: { type: 'string', example: 'Ramírez Torres, Lucía', description: 'Apellidos, Nombres' },
          pickedUpBy: { type: 'string', example: 'María Torres', description: 'Quién recogió al alumno' },
          guardianId: nullableString({ format: 'uuid' }),
          photoUrl: nullableString({ format: 'uri', description: 'URL temporal de la foto; null si no hay foto o ya venció su retención' }),
          guardianNotified: { type: 'boolean', description: 'true si al menos un apoderado recibió la notificación del retiro' },
          status: { type: 'string', enum: ['AUTHORIZED', 'DENIED', 'MANUAL'] },
          method: ref('ValidationMethod'),
          station: nullableString(),
          school: { type: 'string' },
        },
      },
      PickupRequest: {
        type: 'object',
        required: ['studentId', 'method'],
        description:
          'Se envía como JSON o, para adjuntar la foto, como multipart/form-data con el archivo en `photo`. ' +
          'pickedUpBy es obligatorio salvo que se envíe guardianId (se usa su nombre) o method = UNACCOMPANIED ("Salió solo").',
        properties: {
          studentId: { type: 'string', format: 'uuid' },
          schoolId: { type: 'string', format: 'uuid', description: 'Solo SUPERADMIN; por defecto el colegio del alumno' },
          stationId: { type: 'string', format: 'uuid', description: 'Estación que registró el retiro (del mismo colegio)' },
          occurredAt: { type: 'string', format: 'date-time', description: 'Hora del retiro; por defecto ahora' },
          method: ref('ValidationMethod'),
          status: {
            type: 'string',
            enum: ['AUTHORIZED', 'DENIED', 'MANUAL'],
            description: 'Por defecto MANUAL si method = MANUAL, si no AUTHORIZED. MANUAL exige manualReason.',
          },
          guardianId: {
            type: 'string',
            format: 'uuid',
            description:
              'Apoderado que recoge. Con status AUTHORIZED y method FACE / CODE / NATIONAL_ID debe tener una autorización vigente con canPickUp.',
          },
          pickedUpBy: { type: 'string', maxLength: 120, example: 'María Torres' },
          confidence: { type: 'number', minimum: 0, maximum: 100, description: 'Similitud del reconocimiento facial' },
          manualReason: { type: 'string', maxLength: 160 },
          noPhotoReason: { type: 'string', maxLength: 160, description: 'Motivo por el que no hay foto' },
          mediaId: { type: 'string', format: 'uuid', description: 'Imagen ya subida por /api/media (alternativa a `photo`)' },
          photo: { type: 'string', format: 'binary', description: 'Solo multipart: jpg, png o webp' },
          photoType: { type: 'string', enum: ['FACE_VALIDATION', 'QR_SCAN', 'EXIT'], default: 'EXIT' },
          guardianNotified: {
            type: 'boolean',
            default: false,
            description:
              'true si ya se avisó a los apoderados: se registra una notificación EXIT por cada apoderado con autorización vigente y receivesNotifications',
          },
        },
      },
      PickupCreated: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', example: 'RET-20261122-000015' },
          photoType: { type: 'string', enum: ['FACE_VALIDATION', 'QR_SCAN', 'EXIT'], nullable: true },
          notifiedGuardians: { type: 'integer', description: 'Apoderados registrados como notificados' },
        },
      },
      EnrollmentListItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          personType: { type: 'string', enum: ['STAFF', 'GUARDIAN'], description: 'Personal o apoderado' },
          personId: { type: 'string', format: 'uuid', description: 'Id del personal o del apoderado' },
          name: { type: 'string', example: 'Carlos Mendoza Ríos', description: 'Nombre de la persona' },
          enrolledAt: { type: 'string', format: 'date-time' },
          enrolledDate: { type: 'string', example: '23/11/2026', description: 'Fecha de enrolado dd/mm/yyyy (Lima)' },
          poses: { type: 'integer', example: 3 },
          learnedTemplates: { type: 'integer', example: 2, description: 'Plantillas aprendidas con el uso' },
          lastTemplateAt: nullableDate,
          school: { type: 'string' },
        },
      },
      EnrollmentDetail: {
        allOf: [
          ref('EnrollmentListItem'),
          {
            type: 'object',
            properties: {
              schoolId: { type: 'string', format: 'uuid' },
              consentAt: { type: 'string', format: 'date-time', description: 'Fecha del consentimiento' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      EnrollmentRequest: {
        type: 'object',
        description:
          'POST: obligatorios staffId o guardianId (solo uno), poses y el consentimiento (consentAt, o consent = true para registrarlo ahora). ' +
          'Una persona solo puede tener un enrolamiento. ' +
          'PUT: solo se cambian los campos enviados (poses, enrolledAt, consentAt, learnedTemplates, lastTemplateAt; null o vacío limpia lastTemplateAt); ' +
          'no se puede cambiar la persona.',
        properties: {
          staffId: { type: 'string', format: 'uuid', description: 'Solo en POST' },
          guardianId: { type: 'string', format: 'uuid', description: 'Solo en POST' },
          poses: { type: 'integer', minimum: 1, maximum: 20, example: 3 },
          enrolledAt: { type: 'string', format: 'date-time', description: 'Por defecto ahora' },
          consentAt: { type: 'string', format: 'date-time' },
          consent: { type: 'boolean', description: 'true = consentimiento otorgado ahora (si no se envía consentAt)' },
          learnedTemplates: { type: 'integer', minimum: 0, maximum: 1000, default: 0, description: 'Plantillas aprendidas con el uso' },
          lastTemplateAt: { type: 'string', format: 'date-time', nullable: true, description: 'No puede ser anterior a enrolledAt' },
          schoolId: { type: 'string', format: 'uuid', description: 'Solo SUPERADMIN, solo en POST; por defecto el colegio de la persona' },
        },
      },
      AttendanceListItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          date: { type: 'string', example: '20/11/2026', description: 'dd/mm/yyyy (Lima)' },
          staffId: { type: 'string', format: 'uuid' },
          staff: { type: 'string', example: 'Carlos Mendoza Ríos', description: 'Nombre completo del personal' },
          shiftId: nullableString({ format: 'uuid', description: 'Turno de la asistencia; null solo en registros anteriores a la relación' }),
          shift: { type: 'string', example: 'Mañana', description: 'Nombre actual del turno (o el guardado al registrar, si no está relacionado)' },
          clockInAt: { type: 'string', format: 'date-time' },
          clockIn: { type: 'string', example: '08:25', description: 'Hora de entrada HH:mm (Lima)' },
          clockOutAt: nullableDate,
          clockOut: nullableString({ example: '17:30', description: 'Hora de salida HH:mm (Lima); null si aún no marca salida' }),
          isLate: { type: 'boolean', description: 'Tiene tardanza' },
          lateMin: { type: 'integer', example: 25, description: 'Minutos de tardanza' },
          workedMin: { type: 'integer', nullable: true, description: 'Minutos trabajados (descontando el refrigerio); null sin salida' },
          overtimeMin: { type: 'integer', example: 90, description: 'Minutos de horas extra' },
          overtime: { type: 'string', example: '01:30', description: 'Horas extra HH:mm' },
          status: {
            type: 'string',
            enum: ['ON_TIME', 'LATE', 'IN_PROGRESS', 'INCOMPLETE'],
            description: 'IN_PROGRESS = sin salida (hoy); INCOMPLETE = sin salida y el día ya pasó; LATE = cerrada con tardanza; ON_TIME = cerrada sin tardanza',
          },
          statusLabel: { type: 'string', enum: ['Puntual', 'Tardanza', 'En curso', 'Sin salida'] },
          remarks: nullableString({ description: 'Observación' }),
          manualReason: nullableString({ description: 'Motivo del registro manual' }),
          source: { type: 'string', enum: ['STATION', 'MANUAL'] },
          station: nullableString(),
        },
      },
      AttendanceRequest: {
        type: 'object',
        required: ['staffId', 'shiftId'],
        description:
          'El turno se elige al registrar la asistencia (no depende del personal); tardanza, horas trabajadas y horas extra se calculan con él (hora de Lima): ' +
          'tardanza solo en turnos FIXED, cuando la demora supera graceMin (cuenta toda la demora); el refrigerio (breakDeductionMin) ' +
          'se descuenta si la asistencia lo cubre completo; horas extra (si countOvertime) = minutos después de endTime en FIXED, ' +
          'o tiempo trabajado por encima del programado en FLEXIBLE. No se permite cruzarse con otra asistencia del mismo personal.',
        properties: {
          staffId: { type: 'string', format: 'uuid' },
          shiftId: { type: 'string', format: 'uuid', description: 'Turno de esta asistencia (del mismo colegio)' },
          schoolId: { type: 'string', format: 'uuid', description: 'Solo SUPERADMIN; por defecto el colegio del usuario del personal' },
          stationId: { type: 'string', format: 'uuid', description: 'Estación que registró la marcación (del mismo colegio)' },
          clockInAt: { type: 'string', format: 'date-time', description: 'Entrada; por defecto ahora' },
          clockOutAt: { type: 'string', format: 'date-time', description: 'Salida (opcional); posterior a la entrada y máximo 24 h después' },
          source: { type: 'string', enum: ['STATION', 'MANUAL'], description: 'Por defecto STATION si se envía stationId, si no MANUAL' },
          manualReason: { type: 'string', maxLength: 120, description: 'Obligatorio si source = MANUAL' },
          remarks: { type: 'string', maxLength: 300, description: 'Observación' },
          confidence: { type: 'number', minimum: 0, maximum: 100, description: 'Similitud del reconocimiento facial' },
        },
      },
      AttendanceCreated: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          lateMin: { type: 'integer' },
          workedMin: { type: 'integer', nullable: true },
          overtimeMin: { type: 'integer' },
          status: { type: 'string', enum: ['ON_TIME', 'LATE', 'IN_PROGRESS', 'INCOMPLETE'] },
        },
      },
      ClassroomItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: '1° A Primaria' },
          level: { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY'] },
          grade: { type: 'string', example: '1°' },
          section: { type: 'string', example: 'A' },
          staffId: { type: 'string', format: 'uuid', nullable: true, description: 'Tutor (personal del colegio)' },
          tutor: { type: 'string', nullable: true, example: 'Carlos Mendoza Ríos', description: 'Nombre completo del tutor' },
          students: { type: 'integer', example: 25, description: 'Total de alumnos relacionados al aula' },
          capacity: { type: 'integer', nullable: true, example: 30, description: 'Máximo de alumnos permitidos' },
          status: { type: 'integer', enum: [0, 1], description: '0 = inhabilitado, 1 = habilitado' },
          statusLabel: { type: 'string', example: 'Habilitado' },
        },
      },
      ClassroomDetail: {
        allOf: [
          ref('ClassroomItem'),
          {
            type: 'object',
            properties: {
              schoolId: { type: 'string', format: 'uuid' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      ClassroomRequest: {
        type: 'object',
        description:
          'POST: obligatorios name, level, grade y section (y schoolId para SUPERADMIN). ' +
          'PUT: solo se cambian los campos enviados; schoolId se ignora.',
        properties: {
          name: { type: 'string', maxLength: 60, example: '1° A Primaria', description: 'Único dentro del colegio' },
          level: { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY', 'INICIAL', 'PRIMARIA', 'SECUNDARIA'] },
          grade: { type: 'string', maxLength: 20, example: '1°' },
          section: { type: 'string', maxLength: 10, example: 'A' },
          staffId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Tutor: personal activo del mismo colegio (opcional; null o vacío lo quita)',
          },
          capacity: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            nullable: true,
            description: 'Máximo de alumnos (opcional; null o vacío lo quita). No puede ser menor que los alumnos actuales.',
          },
          status: { type: 'integer', enum: [0, 1], default: 1, description: '0 = inhabilitado, 1 = habilitado' },
          schoolId: { type: 'string', format: 'uuid', description: 'Solo SUPERADMIN (obligatorio en POST)' },
        },
      },
      ShiftItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Administrativo mañana' },
          type: { type: 'string', enum: ['FIXED', 'FLEXIBLE'] },
          startTime: nullableString({ example: '07:30' }),
          endTime: nullableString({ example: '16:00' }),
          includesBreak: { type: 'boolean' },
          breakStart: nullableString({ example: '12:30' }),
          breakEnd: nullableString({ example: '13:30' }),
          breakDeductionMin: { type: 'integer', example: 45 },
          graceMin: { type: 'integer', example: 10 },
          countOvertime: { type: 'boolean' },
        },
      },
      ShiftRequest: {
        type: 'object',
        required: ['name', 'type'],
        description:
          'El colegio se toma de la sesión (APP_ADMIN); SUPERADMIN debe enviar schoolId. ' +
          'FLEXIBLE exige startTime y endTime (en FIXED son opcionales, pero van juntos). ' +
          'Si includesBreak es true son obligatorios breakStart, breakEnd y breakDeductionMin; ' +
          'el refrigerio debe estar dentro del horario y los minutos no pueden superar la duración del refrigerio.',
        properties: {
          name: { type: 'string', maxLength: 60, example: 'Administrativo mañana' },
          type: { type: 'string', enum: ['FIXED', 'FLEXIBLE'] },
          startTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '07:30', description: 'Hora de entrada (HH:mm)' },
          endTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '16:00', description: 'Hora de salida (HH:mm)' },
          includesBreak: { type: 'boolean', default: false, description: 'Incluye refrigerio' },
          breakStart: { type: 'string', example: '12:30', description: 'Inicio del refrigerio (HH:mm)' },
          breakEnd: { type: 'string', example: '13:30', description: 'Fin del refrigerio (HH:mm)' },
          breakDeductionMin: { type: 'integer', minimum: 1, example: 45, description: 'Minutos de descanso que se descuentan' },
          graceMin: { type: 'integer', minimum: 0, maximum: 240, default: 0, description: 'Tolerancia de tardanza (minutos)' },
          countOvertime: { type: 'boolean', default: true, description: 'Contabilizar horas extras' },
          schoolId: { type: 'string', format: 'uuid', description: 'Solo SUPERADMIN' },
        },
      },
      ExportRow: {
        type: 'object',
        description:
          'Fila plana para Excel: cada clave es el encabezado de la columna (en español) y su valor la celda. ' +
          'Las fechas van como dd/mm/aaaa y los estados como texto ("Activo" / "Inactivo").',
        additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      },
      UpdateSchoolScheduleInput: {
        type: 'object',
        required: ['level', 'startTime', 'endTime'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Id del horario a actualizar; omitir para crear uno nuevo' },
          ...scheduleFields,
        },
      },

      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 42, description: 'Total de elementos que cumplen los filtros' },
          totalPages: { type: 'integer', example: 5 },
        },
      },

      // ---- School Settings
      SchoolSettings: {
        type: 'object',
        description: 'Configuración completa del colegio; ambos perfiles reciben todos los campos.',
        properties: {
          schoolId: { type: 'string', format: 'uuid' },
          ...settingsProps,
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UpdateSchoolSettingsSuperadminRequest: {
        type: 'object',
        properties: superadminSettingsProps,
        description:
          `Campos que puede modificar el SUPERADMIN: ${codeList(SUPERADMIN_SETTINGS_FIELDS)}. ` +
          'Solo se modifican los campos enviados; cualquier otro campo se ignora.',
      },
      UpdateSchoolSettingsAppAdminRequest: {
        type: 'object',
        properties: appAdminSettingsProps,
        description:
          `Campos que puede modificar el APP_ADMIN: ${codeList(APP_ADMIN_SETTINGS_FIELDS)}. ` +
          `Solo se modifican los campos enviados; los exclusivos del SUPERADMIN (${codeList(superadminOnlySettings)}) se ignoran.`,
      },

      // ---- Face Parameters
      FaceParameters: {
        type: 'object',
        properties: {
          version: { type: 'integer', example: 1 },
          ...faceParameterProps,
        },
      },
      CreateFaceParametersRequest: {
        type: 'object',
        required: [...FACE_NUMERIC_FIELDS],
        properties: faceParameterProps,
        description: 'Crea una nueva versión. Los numéricos admiten máximo 4 decimales; los booleanos son opcionales (por defecto true).',
      },
      UpdateFaceParametersRequest: {
        type: 'object',
        properties: faceParameterProps,
        description: 'Solo se modifican los campos enviados.',
      },

      // ---- Schedules
      SchoolScheduleInput: {
        type: 'object',
        required: ['level', 'startTime', 'endTime'],
        properties: scheduleFields,
      },
      CreateScheduleRequest: {
        type: 'object',
        required: ['schoolId', 'level', 'startTime', 'endTime'],
        properties: {
          schoolId: { type: 'string', format: 'uuid' },
          ...scheduleFields,
        },
      },
      ScheduleItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          level: scheduleFields.level,
          school: { type: 'string', format: 'uuid', description: 'Id del colegio' },
          startTime: { type: 'string', example: '07:45', description: 'HH:MM' },
          endTime: { type: 'string', example: '13:30', description: 'HH:MM' },
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

      // ---- Dashboard
      SchoolSummary: {
        type: 'object',
        properties: {
          totalSchools: { type: 'integer', example: 12, description: 'Colegios activos' },
          photoNotifications: { type: 'integer', example: 340, description: 'Avisos enviados con foto' },
          inactiveStations: { type: 'integer', example: 1, description: 'Estaciones inactivas' },
          stationsNeedingAttention: {
            type: 'integer',
            example: 0,
            description: 'Por ahora siempre 0 (criterio pendiente de definir)',
          },
        },
      },

      UserSummary: {
        type: 'object',
        description: 'Cuentas de usuario sin contar las SUPERADMIN',
        properties: {
          total: { type: 'integer', example: 40 },
          active: { type: 'integer', example: 30, description: 'Estado ACTIVE' },
          pending: { type: 'integer', example: 7, description: 'Estado INVITED' },
          inactive: { type: 'integer', example: 3, description: 'Estado DISABLED' },
        },
      },
      StationSummary: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 15 },
          active: { type: 'integer', example: 14 },
          inactive: { type: 'integer', example: 1 },
        },
      },

      // ---- Stations
      StationListItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Puerta principal' },
          code: { type: 'string', example: 'EST-001' },
          school: { type: 'string', description: 'Nombre del colegio' },
          version: { type: 'string', example: '1.0.0', description: 'Por ahora siempre "1.0.0"' },
          lastCommunication: { type: 'string', example: '-', description: 'Por ahora siempre "-"' },
          status: { type: 'string', enum: ['INACTIVE', 'ACTIVE'] },
        },
      },
      StationItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Puerta principal' },
          code: { type: 'string', example: 'EST-001' },
          schoolId: { type: 'string', format: 'uuid' },
          school: { type: 'string', description: 'Nombre del colegio' },
          version: nullableString({ example: '1.0.0' }),
          serialNumber: nullableString(),
          lastSyncAt: nullableDate,
          status: { type: 'string', enum: ['INACTIVE', 'ACTIVE'] },
          createdDate: { type: 'string', example: '11/11/2026', description: 'dd/mm/yyyy' },
        },
      },
      CreateStationRequest: {
        type: 'object',
        required: ['name', 'code', 'schoolId'],
        properties: {
          name: { type: 'string', maxLength: 80, example: 'Puerta principal' },
          code: { type: 'string', maxLength: 20, example: 'EST-001', description: 'Único entre todas las estaciones' },
          schoolId: { type: 'string', format: 'uuid' },
          version: nullableString({ maxLength: 20 }),
          serialNumber: nullableString({ maxLength: 60 }),
        },
        description: 'La estación se crea siempre ACTIVE (1); si se envía status, se ignora.',
      },
      UpdateStationRequest: {
        type: 'object',
        description: 'Solo se modifican los campos enviados; null o "" borra los opcionales.',
        properties: {
          name: { type: 'string', maxLength: 80 },
          code: { type: 'string', maxLength: 20 },
          schoolId: { type: 'string', format: 'uuid' },
          version: nullableString({ maxLength: 20 }),
          serialNumber: nullableString({ maxLength: 60 }),
          status: { type: 'integer', enum: [0, 1], description: '0 = INACTIVE, 1 = ACTIVE' },
        },
      },

      // ---- Roles
      RoleItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Portería' },
          code: { type: 'string', example: 'DOOR_STAFF' },
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
          schoolId: { type: 'string', format: 'uuid', description: 'SUPERADMIN: obligatorio salvo que envíe stationId (se usa su colegio). Otros roles: se usa su propio colegio (se ignora)' },
          stationId: { type: 'string', format: 'uuid', description: 'Opcional; estación que capturó el archivo (debe ser del mismo colegio)' },
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
          ownerId: { type: 'string', format: 'uuid', description: 'Usuario que subió el archivo' },
          schoolId: { type: 'string', format: 'uuid', description: 'Colegio al que pertenece el archivo' },
          stationId: { type: 'string', format: 'uuid', nullable: true, description: 'Estación que capturó el archivo (opcional)' },
          serialCode: { type: 'string', example: 'RC-20261119-000123', description: 'Código único autogenerado: RC + fecha de guardado (yyyymmdd) + número de 6 dígitos' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      MediaListItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          thumbnailUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description:
              'URL prefirmada (temporal) de la miniatura de la imagen o del poster del video; el original si aún no se procesó; null si está pending',
          },
          serialCode: { type: 'string', example: 'RC-20261119-000123', description: 'Código único: RC + fecha de guardado (yyyymmdd) + número de 6 dígitos' },
          code: { type: 'string', example: 'CSJ20261119', description: 'Iniciales del colegio + fecha de guardado (yyyymmdd)' },
          savedAt: { type: 'string', format: 'date-time', description: 'Fecha y hora de guardado' },
          date: { type: 'string', example: '19/11/2026', description: 'Fecha de guardado (dd/mm/yyyy, hora de Lima)' },
          time: { type: 'string', example: '14:35', description: 'Hora de guardado (HH:mm, hora de Lima)' },
          school: { type: 'string', description: 'Nombre del colegio' },
          station: { type: 'string', nullable: true, description: 'Nombre de la estación; null si no tiene' },
          status: { type: 'string', enum: ['pending', 'uploaded', 'processing', 'ready', 'failed'] },
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
          200: {
            ...ok('Sesión creada; el token va en la cookie httpOnly `session`', ref('LoginResponse')),
            headers: { 'Set-Cookie': { schema: { type: 'string', example: 'session=abc123; Path=/; HttpOnly; Secure; SameSite=None' } } },
          },
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
        summary: 'Cerrar la sesión actual y eliminar la cookie',
        security: bearer,
        responses: {
          200: {
            ...ok('Sesión cerrada; la cookie `session` se elimina (también si ya había expirado)', { type: 'string' }),
            headers: { 'Set-Cookie': { schema: { type: 'string', example: 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT' } } },
          },
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

    '/api/auth/invitation/validate': {
      post: {
        tags: ['Auth'],
        summary: 'Validar invitación (público)',
        description: 'Lo usa la página de establecer contraseña para comprobar el token del correo y mostrar a quién se invita.',
        requestBody: { required: true, content: json('ValidateInvitationRequest') },
        responses: {
          200: ok('Invitación vigente', ref('InvitationInfo')),
          400: errorResponse('Falta el token'),
          404: errorResponse('Invitación inexistente'),
          410: errorResponse('Invitación usada, expirada o usuario ya no invitado'),
        },
      },
    },
    '/api/auth/invitation/accept': {
      post: {
        tags: ['Auth'],
        summary: 'Aceptar invitación y establecer contraseña (público)',
        description: 'Guarda la contraseña, activa la cuenta (status ACTIVE) y marca la invitación como usada. Luego el usuario inicia sesión con /api/auth/login.',
        requestBody: { required: true, content: json('AcceptInvitationRequest') },
        responses: {
          200: ok('Cuenta activada', { type: 'object', properties: { email: { type: 'string', format: 'email' } } }),
          400: errorResponse('Token faltante, contraseña corta o no coincide'),
          404: errorResponse('Invitación inexistente'),
          410: errorResponse('Invitación usada, expirada o usuario ya no invitado'),
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
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de usuarios ordenados por fecha de creación', ref('UserItem')),
          400: errorResponse('Filtro o paginación inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Crear usuario',
        description:
          'El usuario se crea como INVITED (sin contraseña) y se le envía por Brevo un correo con el botón "Aceptar invitación", ' +
          'que lleva a la página de establecer contraseña. `invitationSent` es false si el correo no se pudo enviar ' +
          '(reintentar con POST /api/user/{id}/invitation).',
        security: bearer,
        requestBody: { required: true, content: json('CreateUserRequest') },
        responses: {
          200: {
            description: 'Id del usuario creado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'data', 'invitationSent'],
                  properties: {
                    status: { type: 'boolean', example: true },
                    data: { type: 'string', format: 'uuid' },
                    invitationSent: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          400: errorResponse('Datos inválidos, documento con longitud incorrecta o FK inexistente'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso, intento de asignar el rol SUPERADMIN o colegio ajeno'),
          409: errorResponse('Email o documento ya registrado'),
        },
      },
    },
    '/api/user/export': {
      get: {
        tags: ['Users'],
        summary: 'Exportar usuarios (Excel)',
        description:
          'Todos los usuarios que cumplen los filtros, sin paginar, como filas planas listas para una hoja de Excel. ' +
          'Mismas reglas que el listado: nunca incluye al SUPERADMIN; un SUPERADMIN ve todos los colegios y otro rol solo el suyo ' +
          '(el filtro `schoolId` se ignora); solo usuarios con rol y colegio activos. ' +
          'Columnas: Nombre, Correo electrónico, Tipo de documento, Documento, Teléfono, Cargo, Rol, Colegio, Estado, ' +
          'Último acceso, Fecha de registro.',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre (sin distinguir mayúsculas)'),
          query('roleId', { type: 'string', format: 'uuid' }, 'Rol exacto'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto (solo SUPERADMIN)'),
          query('status', { type: 'integer', enum: [0, 1, 2] }, '0 = DISABLED, 1 = ACTIVE, 2 = INVITED'),
        ],
        responses: {
          200: ok('Filas ordenadas por nombre', { type: 'array', items: ref('ExportRow') }),
          400: errorResponse('Filtro inválido'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
    },
    '/api/user/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Obtener usuario',
        description: 'No devuelve SUPERADMIN. Un rol distinto de SUPERADMIN solo puede ver usuarios de su colegio.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok('Usuario', ref('UserDetail')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Usuario no encontrado'),
        },
      },
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

    '/api/user/{id}/status': {
      patch: {
        tags: ['Users'],
        summary: 'Cambiar estado del usuario',
        description:
          'Activa (1) o desactiva (0) la cuenta. Al desactivarla también cierra todas sus sesiones. ' +
          'No se acepta INVITED (2) ni cambiar el estado de la propia cuenta. Un rol distinto de SUPERADMIN ' +
          'solo puede cambiar usuarios de su colegio.',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('ChangeUserStatusRequest') },
        responses: {
          200: okId('Id del usuario'),
          400: errorResponse('Estado inválido o intento de cambiar la propia cuenta'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Usuario no encontrado'),
        },
      },
    },

    '/api/user/{id}/invitation': {
      post: {
        tags: ['Users'],
        summary: 'Reenviar correo de invitación',
        description:
          'Genera un nuevo enlace (el anterior deja de funcionar) y lo envía por correo. Solo para usuarios INVITED. ' +
          'Un rol distinto de SUPERADMIN solo puede reenviar invitaciones de su colegio.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id del usuario'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Usuario no encontrado'),
          409: errorResponse('El usuario ya activó su cuenta o está deshabilitado'),
          502: errorResponse('No se pudo enviar el correo'),
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
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de colegios ordenados por nombre', ref('SchoolItem')),
          400: errorResponse('Filtro o paginación inválidos'),
          401: unauthorized,
          403: forbidden,
        },
      },
      post: {
        tags: ['Schools'],
        summary: 'Crear colegio (y opcionalmente sus horarios)',
        description:
          'Crea el colegio, su configuración por defecto y sus horarios en una sola transacción (si algo falla no se crea nada). ' +
          'Los horarios se aplicarán a las aulas del colegio según su nivel, también a las que se creen después.',
        security: bearer,
        requestBody: { required: true, content: json('CreateSchoolRequest') },
        responses: {
          201: okId('Id del colegio creado'),
          400: errorResponse('Datos inválidos del colegio o de algún horario (level, startTime/endTime HH:MM, startTime < endTime)'),
          401: unauthorized,
          403: forbidden,
          409: errorResponse('Código modular o slug ya registrado'),
        },
      },
    },
    '/api/schools/simple': {
      get: {
        tags: ['Schools'],
        summary: 'Listar colegios activos (solo id y nombre)',
        security: bearer,
        responses: {
          200: ok('Colegios activos ordenados por nombre', { type: 'array', items: ref('SchoolOption') }),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/api/schools/export': {
      get: {
        tags: ['Schools'],
        summary: 'Exportar colegios (Excel)',
        description:
          'Todos los colegios que cumplen los filtros, sin paginar, como filas planas listas para una hoja de Excel. ' +
          'Columnas: Nombre, Slug, Código modular, RUC, Dirección, Región, Provincia, Distrito, Teléfono, Servicio de fotos, ' +
          'Estaciones activas, Estaciones totales, Estado, Fecha de registro.',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre (sin distinguir mayúsculas)'),
          query('status', { type: 'integer', enum: [0, 1] }, '0 = INACTIVE, 1 = ACTIVE'),
        ],
        responses: {
          200: ok('Filas ordenadas por nombre', { type: 'array', items: ref('ExportRow') }),
          400: errorResponse('Filtro inválido'),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/api/schools/{id}': {
      get: {
        tags: ['Schools'],
        summary: 'Obtener colegio con sus horarios',
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
        summary: 'Desactivar colegio y sus horarios (soft delete)',
        description:
          'Marca el colegio como INACTIVE y sus horarios (Schedule) con status 0, en una sola transacción, y quita esos ' +
          'horarios de las aulas; las filas se conservan porque otras tablas referencian al colegio.',
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
    '/api/schools/{id}/status': {
      patch: {
        tags: ['Schools'],
        summary: 'Cambiar estado del colegio',
        description:
          'Activa (1) o desactiva (0) el colegio. Al desactivarlo también pasa sus horarios a status 0 y los quita de las aulas, ' +
          'en una sola transacción; ' +
          'al activarlo los horarios no se reactivan (se vuelven a cargar con PUT /api/schools/{id}).',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('ChangeSchoolStatusRequest') },
        responses: {
          200: okId('Id del colegio'),
          400: errorResponse('Estado inválido'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Colegio no encontrado'),
        },
      },
    },

    // ---- Stations
    // ---- Shifts
    // ---- Classrooms
    '/api/classrooms': {
      get: {
        tags: ['Classrooms'],
        summary: 'Listar aulas del colegio (paginado)',
        description:
          'Aulas del colegio de la sesión ordenadas por nombre, con el tutor y el total de alumnos. SUPERADMIN debe indicar `schoolId`.',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre del aula (sin distinguir mayúsculas)'),
          query('tutor', { type: 'string' }, 'Parte del nombre del tutor (sin distinguir mayúsculas)'),
          query('staffId', { type: 'string', format: 'uuid' }, 'Tutor exacto'),
          query('level', { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY', 'INICIAL', 'PRIMARIA', 'SECUNDARIA'] }, 'Nivel'),
          query('status', { type: 'integer', enum: [0, 1] }, '0 = inhabilitado, 1 = habilitado'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio (obligatorio y solo para SUPERADMIN)'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de aulas', ref('ClassroomItem')),
          400: errorResponse('Filtro, paginación o schoolId inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Classrooms'],
        summary: 'Crear aula',
        description: 'El aula recibe automáticamente los horarios activos de su colegio con su mismo nivel.',
        security: bearer,
        requestBody: { required: true, content: json('ClassroomRequest') },
        responses: {
          201: okId('Id del aula creada'),
          400: errorResponse('Datos inválidos o colegio inexistente'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          404: errorResponse('Tutor no encontrado en el colegio'),
          409: errorResponse('Ya existe un aula con ese nombre en el colegio'),
        },
      },
    },
    '/api/classrooms/{id}': {
      get: {
        tags: ['Classrooms'],
        summary: 'Obtener aula',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok('Aula', ref('ClassroomDetail')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Aula no encontrada (o de otro colegio)'),
        },
      },
      put: {
        tags: ['Classrooms'],
        summary: 'Actualizar aula',
        description:
          'Solo se cambian los campos enviados (staffId / capacity en null o vacío los quitan). El colegio no se puede cambiar. ' +
          'Si cambia el nivel, sus horarios se reemplazan por los horarios activos del nuevo nivel.',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('ClassroomRequest') },
        responses: {
          200: okId('Id del aula actualizada'),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Aula o tutor no encontrado (o de otro colegio)'),
          409: errorResponse('Nombre repetido en el colegio o capacidad menor que los alumnos actuales'),
        },
      },
      delete: {
        tags: ['Classrooms'],
        summary: 'Eliminar aula',
        description: 'Eliminación definitiva. No se permite mientras el aula tenga alumnos.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id del aula eliminada'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Aula no encontrada (o de otro colegio)'),
          409: errorResponse('El aula tiene alumnos'),
        },
      },
    },

    '/api/shifts': {
      get: {
        tags: ['Shifts'],
        summary: 'Listar turnos del colegio (paginado)',
        description: 'Turnos del colegio de la sesión, ordenados por nombre. SUPERADMIN debe indicar `schoolId`.',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre (sin distinguir mayúsculas)'),
          query('type', { type: 'string', enum: ['FIXED', 'FLEXIBLE'] }, 'Tipo de turno'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio (obligatorio y solo para SUPERADMIN)'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de turnos', ref('ShiftItem')),
          400: errorResponse('Filtro, paginación o schoolId inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Shifts'],
        summary: 'Registrar turno',
        security: bearer,
        requestBody: { required: true, content: json('ShiftRequest') },
        responses: {
          201: okId('Id del turno creado'),
          400: errorResponse('Datos inválidos (horas, refrigerio, tolerancia) o colegio inexistente'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          409: errorResponse('Ya existe un turno con ese nombre en el colegio'),
        },
      },
    },

    '/api/shifts/simple': {
      get: {
        tags: ['Shifts'],
        summary: 'Listado simple de turnos del colegio',
        description:
          'Todos los turnos del colegio, solo id y nombre, ordenados por nombre (sin paginar). ' +
          'APP_ADMIN / DOOR_STAFF reciben los de su colegio (`schoolId` se ignora); SUPERADMIN debe enviar `schoolId`.',
        security: bearer,
        parameters: [query('schoolId', { type: 'string', format: 'uuid' }, 'Obligatorio solo para SUPERADMIN')],
        responses: {
          200: ok('Turnos del colegio', {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', example: 'Mañana' },
              },
            },
          }),
          400: errorResponse('schoolId faltante o inválido (SUPERADMIN)'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
    },
    '/api/shifts/{id}': {
      get: {
        tags: ['Shifts'],
        summary: 'Obtener turno',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok('Turno', ref('ShiftItem')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Turno no encontrado (o de otro colegio)'),
        },
      },
      put: {
        tags: ['Shifts'],
        summary: 'Actualizar turno',
        description:
          'Solo se cambian los campos enviados; el resultado se valida con las mismas reglas que al crear ' +
          '(p. ej. pasar a FLEXIBLE exige horas; includesBreak false borra el refrigerio). schoolId se ignora.',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('ShiftRequest') },
        responses: {
          200: okId('Id del turno actualizado'),
          400: errorResponse('Datos inválidos (horas, refrigerio, tolerancia)'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Turno no encontrado (o de otro colegio)'),
          409: errorResponse('Ya existe un turno con ese nombre en el colegio'),
        },
      },
      delete: {
        tags: ['Shifts'],
        summary: 'Eliminar turno',
        description: 'Eliminación definitiva. No se permite si hay personal asignado al turno o asistencias registradas con él.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id del turno eliminado'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Turno no encontrado (o de otro colegio)'),
          409: errorResponse('El turno tiene personal asignado o asistencias registradas'),
        },
      },
    },

    // ---- Pickups
    '/api/pickups': {
      get: {
        tags: ['Pickups'],
        summary: 'Listar recojos de alumnos (paginado)',
        description:
          'Del más reciente al más antiguo: hora, alumno, quién lo recogió, enlace de la foto y si se avisó al apoderado. ' +
          'Un SUPERADMIN ve todos los colegios; otro rol solo el suyo (el filtro `schoolId` se ignora).',
        security: bearer,
        parameters: [
          query('studentName', { type: 'string' }, 'Parte de los nombres, apellidos o nombre completo del alumno'),
          query('studentId', { type: 'string', format: 'uuid' }, 'Alumno exacto'),
          query('dateFrom', { type: 'string', format: 'date' }, 'Desde (yyyy-mm-dd, Lima, inclusive)'),
          query('dateTo', { type: 'string', format: 'date' }, 'Hasta (yyyy-mm-dd, Lima, inclusive)'),
          query('status', { type: 'string', enum: ['AUTHORIZED', 'DENIED', 'MANUAL'] }, 'Estado'),
          query('method', ref('ValidationMethod'), 'Método de validación (ver el schema ValidationMethod)'),
          query('guardianNotified', { type: 'boolean' }, 'Solo avisados (true) o no avisados (false)'),
          query('stationId', { type: 'string', format: 'uuid' }, 'Estación'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto (solo SUPERADMIN)'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de recojos', ref('PickupListItem')),
          400: errorResponse('Filtro o paginación inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Pickups'],
        summary: 'Registrar recojo de alumno',
        description:
          'Genera el código `RET-{yyyymmdd}-{######}` (correlativo por día). La foto se envía como archivo `photo` (multipart) ' +
          'o como `mediaId`; su vencimiento sigue `photoRetentionDays` de la configuración del colegio.',
        security: bearer,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('PickupRequest') }, 'multipart/form-data': { schema: ref('PickupRequest') } },
        },
        responses: {
          201: ok('Recojo registrado', ref('PickupCreated')),
          400: errorResponse('Datos inválidos, apoderado no autorizado o estación/apoderado/imagen de otro colegio'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          404: errorResponse('Estudiante no encontrado (o de otro colegio)'),
          415: errorResponse('La foto no es jpg, png o webp'),
        },
      },
    },

    // ---- Staff
    '/api/staff': {
      post: {
        tags: ['Staff'],
        summary: 'Crear personal',
        description:
          'Crea el usuario (INVITED, sin contraseña) y el registro de personal relacionado por `userId`, en una sola transacción. ' +
          'Luego se envía el correo de invitación; `invitationSent` es false si no se pudo enviar ' +
          '(reintentar con POST /api/user/{userId}/invitation). Solo SUPERADMIN y APP_ADMIN.',
        security: bearer,
        requestBody: { required: true, content: json('CreateStaffRequest') },
        responses: {
          200: {
            description: 'Id del personal creado y de su usuario',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'data', 'userId', 'invitationSent'],
                  properties: {
                    status: { type: 'boolean', example: true },
                    data: { type: 'string', format: 'uuid', description: 'Id del personal (Staff)' },
                    userId: { type: 'string', format: 'uuid', description: 'Id del usuario creado' },
                    invitationSent: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          400: errorResponse('Datos inválidos, documento con longitud incorrecta o FK inexistente'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso, intento de asignar el rol SUPERADMIN o cuenta sin colegio asignado'),
          404: errorResponse('Turno no encontrado (o de otro colegio)'),
          409: errorResponse('Email o documento ya registrado'),
        },
      },
    },
    '/api/staff/simple': {
      get: {
        tags: ['Staff'],
        summary: 'Listado simple del personal del colegio',
        description:
          'Personal activo del colegio (según el colegio de su usuario), solo id y nombre completo del usuario, ordenado por nombre (sin paginar). ' +
          'APP_ADMIN / DOOR_STAFF reciben el de su colegio (`schoolId` se ignora); SUPERADMIN debe enviar `schoolId`.',
        security: bearer,
        parameters: [query('schoolId', { type: 'string', format: 'uuid' }, 'Obligatorio solo para SUPERADMIN')],
        responses: {
          200: ok('Personal del colegio', {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', example: 'Carlos Mendoza Ríos', description: 'Nombre completo' },
              },
            },
          }),
          400: errorResponse('schoolId faltante o inválido (SUPERADMIN)'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
    },

    // ---- Enrollments
    '/api/enrollments': {
      get: {
        tags: ['Enrollments'],
        summary: 'Listar enrolamientos (paginado)',
        description:
          'Del más reciente al más antiguo: nombre de la persona, fecha de enrolado, poses y plantillas aprendidas con el uso. ' +
          'Un SUPERADMIN ve todos los colegios; otro rol solo el suyo (el filtro `schoolId` se ignora).',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre de la persona (sin distinguir mayúsculas)'),
          query('personType', { type: 'string', enum: ['STAFF', 'GUARDIAN'] }, 'Personal o apoderado'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto (solo SUPERADMIN)'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de enrolamientos', ref('EnrollmentListItem')),
          400: errorResponse('Filtro o paginación inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Enrollments'],
        summary: 'Registrar enrolamiento',
        security: bearer,
        requestBody: { required: true, content: json('EnrollmentRequest') },
        responses: {
          201: okId('Id del enrolamiento creado'),
          400: errorResponse('Datos inválidos o falta el consentimiento'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          404: errorResponse('Personal o apoderado no encontrado (o de otro colegio)'),
          409: errorResponse('La persona ya tiene un enrolamiento registrado'),
        },
      },
    },
    '/api/enrollments/{id}': {
      get: {
        tags: ['Enrollments'],
        summary: 'Obtener enrolamiento',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok('Enrolamiento', ref('EnrollmentDetail')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Enrolamiento no encontrado (o de otro colegio)'),
        },
      },
      put: {
        tags: ['Enrollments'],
        summary: 'Actualizar enrolamiento (SUPERADMIN / APP_ADMIN)',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('EnrollmentRequest') },
        responses: {
          200: okId('Id del enrolamiento actualizado'),
          400: errorResponse('Datos inválidos o intento de cambiar la persona'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Enrolamiento no encontrado (o de otro colegio)'),
        },
      },
      delete: {
        tags: ['Enrollments'],
        summary: 'Eliminar enrolamiento (SUPERADMIN / APP_ADMIN)',
        description: 'Eliminación definitiva: la persona deja de estar enrolada.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id del enrolamiento eliminado'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Enrolamiento no encontrado (o de otro colegio)'),
        },
      },
    },

    // ---- Attendance
    '/api/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Listar asistencia del personal (paginado)',
        description:
          'De la más reciente a la más antigua: personal, turno, entrada, salida, tardanza, horas extra, estado y observación. ' +
          'Un SUPERADMIN ve todos los colegios; otro rol solo el suyo (el filtro `schoolId` se ignora).',
        security: bearer,
        parameters: [
          query('staffName', { type: 'string' }, 'Parte del nombre del personal (sin distinguir mayúsculas)'),
          query('staffId', { type: 'string', format: 'uuid' }, 'Personal exacto'),
          query('shiftId', { type: 'string', format: 'uuid' }, 'Turno exacto'),
          query('shift', { type: 'string' }, 'Parte del nombre del turno'),
          query('dateFrom', { type: 'string', format: 'date' }, 'Desde (yyyy-mm-dd, Lima, inclusive)'),
          query('dateTo', { type: 'string', format: 'date' }, 'Hasta (yyyy-mm-dd, Lima, inclusive)'),
          query('status', { type: 'string', enum: ['ON_TIME', 'LATE', 'IN_PROGRESS', 'INCOMPLETE'] }, 'Estado de la asistencia'),
          query('late', { type: 'boolean' }, 'Solo con tardanza (true) o sin tardanza (false)'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto (solo SUPERADMIN)'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de asistencias', ref('AttendanceListItem')),
          400: errorResponse('Filtro o paginación inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Registrar asistencia del personal',
        security: bearer,
        requestBody: { required: true, content: json('AttendanceRequest') },
        responses: {
          201: ok('Asistencia registrada', ref('AttendanceCreated')),
          400: errorResponse('Datos inválidos, o turno / estación de otro colegio'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          404: errorResponse('Personal no encontrado (o de otro colegio)'),
          409: errorResponse('El personal ya tiene una asistencia abierta o que se cruza con ese horario'),
        },
      },
    },

    // ---- Students
    '/api/students': {
      get: {
        tags: ['Students'],
        summary: 'Listar estudiantes (paginado)',
        description:
          'Solo estudiantes activos, ordenados por apellidos y nombres. Un SUPERADMIN ve todos los colegios; ' +
          'otro rol solo el suyo (el filtro `schoolId` se ignora).',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte de los nombres, apellidos o nombre completo (sin distinguir mayúsculas)'),
          query('level', { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY', 'INICIAL', 'PRIMARIA', 'SECUNDARIA'] }, 'Nivel'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto (solo SUPERADMIN)'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de estudiantes', ref('StudentListItem')),
          400: errorResponse('Filtro o paginación inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Students'],
        summary: 'Registrar estudiante',
        description: 'El código de carné (`badgeCode`) se genera automáticamente.',
        security: bearer,
        requestBody: { required: true, content: json('StudentRequest') },
        responses: {
          201: okId('Id del estudiante creado'),
          400: errorResponse('Datos inválidos, documento con longitud incorrecta o FK inexistente'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          409: errorResponse('Documento ya registrado en el colegio'),
        },
      },
    },
    '/api/students/export': {
      get: {
        tags: ['Students'],
        summary: 'Exportar estudiantes (Excel)',
        description:
          'Todos los estudiantes que cumplen los filtros, sin paginar, como filas planas listas para una hoja de Excel. ' +
          'Mismas reglas que el listado. Columnas: Apellidos, Nombres, Tipo de documento, Documento, Nivel, Grado, Sección, ' +
          'Puede salir solo, Código de carné, Colegio, Fecha de registro.',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte de los nombres, apellidos o nombre completo'),
          query('level', { type: 'string', enum: ['PRESCHOOL', 'PRIMARY', 'SECONDARY', 'INICIAL', 'PRIMARIA', 'SECUNDARIA'] }, 'Nivel'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto (solo SUPERADMIN)'),
        ],
        responses: {
          200: ok('Filas ordenadas por apellidos y nombres', { type: 'array', items: ref('ExportRow') }),
          400: errorResponse('Filtro inválido'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
    },
    '/api/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Obtener estudiante',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok('Estudiante', ref('StudentDetail')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Estudiante no encontrado (o de otro colegio)'),
        },
      },
      put: {
        tags: ['Students'],
        summary: 'Actualizar estudiante',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('StudentRequest') },
        responses: {
          200: okId('Id del estudiante actualizado'),
          400: errorResponse('Datos inválidos, documento con longitud incorrecta o FK inexistente'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Estudiante no encontrado (o de otro colegio)'),
          409: errorResponse('Documento ya registrado en el colegio'),
        },
      },
      delete: {
        tags: ['Students'],
        summary: 'Eliminar estudiante (soft delete)',
        description: 'Lo marca como inactivo: deja de aparecer en el listado y la exportación; su historial se conserva.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id del estudiante eliminado'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Estudiante no encontrado (o de otro colegio)'),
        },
      },
    },

    '/api/stations': {
      get: {
        tags: ['Stations'],
        summary: 'Listar estaciones',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre (sin distinguir mayúsculas)'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto'),
          query('status', { type: 'integer', enum: [0, 1] }, '0 = INACTIVE, 1 = ACTIVE'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de estaciones ordenadas por nombre', ref('StationListItem')),
          400: errorResponse('Filtro o paginación inválidos'),
          401: unauthorized,
          403: forbidden,
        },
      },
      post: {
        tags: ['Stations'],
        summary: 'Crear estación',
        security: bearer,
        requestBody: { required: true, content: json('CreateStationRequest') },
        responses: {
          201: okId('Id de la estación creada'),
          400: errorResponse('Datos inválidos o colegio inexistente'),
          401: unauthorized,
          403: forbidden,
          409: errorResponse('Código ya registrado'),
        },
      },
    },
    '/api/stations/simple': {
      get: {
        tags: ['Stations'],
        summary: 'Listado simple de estaciones del colegio',
        description:
          'Estaciones activas del colegio, solo id y nombre, ordenadas por nombre (sin paginar). ' +
          'Accesible para SUPERADMIN, APP_ADMIN y DOOR_STAFF. APP_ADMIN / DOOR_STAFF reciben las de su colegio ' +
          '(`schoolId` se ignora); SUPERADMIN debe enviar `schoolId`.',
        security: bearer,
        parameters: [query('schoolId', { type: 'string', format: 'uuid' }, 'Obligatorio solo para SUPERADMIN')],
        responses: {
          200: ok('Estaciones del colegio', {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'Puerta principal' } },
            },
          }),
          400: errorResponse('schoolId faltante o inválido (SUPERADMIN)'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
        },
      },
    },
    '/api/stations/export': {
      get: {
        tags: ['Stations'],
        summary: 'Exportar estaciones (Excel)',
        description:
          'Todas las estaciones que cumplen los filtros, sin paginar, como filas planas listas para una hoja de Excel. ' +
          'Columnas: Nombre, Código, Colegio, Versión, Número de serie, Última sincronización, Estado, Fecha de registro.',
        security: bearer,
        parameters: [
          query('name', { type: 'string' }, 'Parte del nombre (sin distinguir mayúsculas)'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Colegio exacto'),
          query('status', { type: 'integer', enum: [0, 1] }, '0 = INACTIVE, 1 = ACTIVE'),
        ],
        responses: {
          200: ok('Filas ordenadas por nombre', { type: 'array', items: ref('ExportRow') }),
          400: errorResponse('Filtro inválido'),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/api/stations/{id}/status': {
      patch: {
        tags: ['Stations'],
        summary: 'Cambiar estado de la estación',
        description: 'Activa (1) o desactiva (0) la estación.',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('ChangeStationStatusRequest') },
        responses: {
          200: okId('Id de la estación'),
          400: errorResponse('Estado inválido'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Estación no encontrada'),
        },
      },
    },

    '/api/stations/{id}': {
      get: {
        tags: ['Stations'],
        summary: 'Obtener estación',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok('Estación', ref('StationItem')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Estación no encontrada'),
        },
      },
      put: {
        tags: ['Stations'],
        summary: 'Actualizar estación',
        security: bearer,
        parameters: [idParam],
        requestBody: { required: true, content: json('UpdateStationRequest') },
        responses: {
          200: okId('Id de la estación actualizada'),
          400: errorResponse('Datos inválidos o colegio inexistente'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Estación no encontrada'),
          409: errorResponse('Código ya registrado'),
        },
      },
      delete: {
        tags: ['Stations'],
        summary: 'Desactivar estación (soft delete)',
        description:
          'Marca la estación como INACTIVE; la fila se conserva porque llegadas, retiros y marcaciones la referencian. ' +
          'Para reactivarla usa PATCH /api/stations/{id}/status con status 1.',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: okId('Id de la estación desactivada'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Estación no encontrada'),
        },
      },
    },

    // ---- School Settings
    '/api/school-settings': {
      get: {
        tags: ['School Settings'],
        summary: 'Obtener la configuración de mi colegio (APP_ADMIN)',
        security: bearer,
        responses: {
          200: ok('Configuración del colegio del usuario', ref('SchoolSettings')),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          404: errorResponse('Colegio no encontrado'),
        },
      },
      put: {
        tags: ['School Settings'],
        summary: 'Actualizar la configuración de mi colegio (APP_ADMIN)',
        description: `Modifica solo los campos del APP_ADMIN: ${codeList(APP_ADMIN_SETTINGS_FIELDS)}. Cualquier otro campo se ignora.`,
        security: bearer,
        requestBody: { required: true, content: json('UpdateSchoolSettingsAppAdminRequest') },
        responses: {
          200: okId('Id del colegio'),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: errorResponse('Rol sin permiso o cuenta sin colegio asignado'),
          404: errorResponse('Colegio no encontrado'),
        },
      },
    },
    '/api/school-settings/{schoolId}': {
      get: {
        tags: ['School Settings'],
        summary: 'Obtener la configuración de un colegio (SUPERADMIN)',
        security: bearer,
        parameters: [schoolIdParam],
        responses: {
          200: ok('Configuración del colegio', ref('SchoolSettings')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Colegio no encontrado'),
        },
      },
      put: {
        tags: ['School Settings'],
        summary: 'Actualizar la configuración de un colegio (SUPERADMIN)',
        description: `Modifica solo los campos del SUPERADMIN: ${codeList(SUPERADMIN_SETTINGS_FIELDS)}. Cualquier otro campo se ignora.`,
        security: bearer,
        parameters: [schoolIdParam],
        requestBody: { required: true, content: json('UpdateSchoolSettingsSuperadminRequest') },
        responses: {
          200: okId('Id del colegio'),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Colegio no encontrado'),
        },
      },
    },

    // ---- Face Parameters
    '/api/face-parameters': {
      get: {
        tags: ['Face Parameters'],
        summary: 'Obtener la última versión de parámetros',
        security: bearer,
        responses: {
          200: ok('Última versión (la de mayor "version")', ref('FaceParameters')),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('No hay parámetros registrados'),
        },
      },
      post: {
        tags: ['Face Parameters'],
        summary: 'Crear nueva versión de parámetros',
        security: bearer,
        requestBody: { required: true, content: json('CreateFaceParametersRequest') },
        responses: {
          201: ok('Número de versión creada', { type: 'integer', example: 2 }),
          400: errorResponse('Datos inválidos'),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/api/face-parameters/{version}': {
      get: {
        tags: ['Face Parameters'],
        summary: 'Obtener una versión de parámetros',
        security: bearer,
        parameters: [versionParam],
        responses: {
          200: ok('Versión solicitada', ref('FaceParameters')),
          400: errorResponse('Versión inválida'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Versión no encontrada'),
        },
      },
      put: {
        tags: ['Face Parameters'],
        summary: 'Actualizar una versión de parámetros',
        security: bearer,
        parameters: [versionParam],
        requestBody: { required: true, content: json('UpdateFaceParametersRequest') },
        responses: {
          200: ok('Número de versión actualizada', { type: 'integer', example: 1 }),
          400: errorResponse('Datos o versión inválidos'),
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Versión no encontrada'),
        },
      },
    },

    // ---- Schedules
    '/api/schedules': {
      post: {
        tags: ['Schedules'],
        summary: 'Crear horario',
        description: 'El horario se aplica a todas las aulas de su colegio con el mismo nivel (en la misma transacción).',
        security: bearer,
        requestBody: { required: true, content: json('CreateScheduleRequest') },
        responses: {
          201: ok('Horario creado', ref('ScheduleItem')),
          400: errorResponse('Datos inválidos (level, startTime/endTime HH:MM, startTime < endTime)'),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/api/schedules/bulk': {
      post: {
        tags: ['Schedules'],
        summary: 'Crear varios horarios',
        description:
          'Todos o ninguno (una sola transacción). Cada horario se aplica a las aulas de su colegio con el mismo nivel.',
        security: bearer,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'array', items: ref('CreateScheduleRequest') } } },
        },
        responses: {
          201: ok('Horarios creados', { type: 'array', items: ref('ScheduleItem') }),
          400: errorResponse('El body no es un array o algún horario es inválido; no se crea ninguno'),
          401: unauthorized,
          403: forbidden,
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

    // ---- Dashboard
    '/api/dashboard/school-summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Resumen de colegios y estaciones',
        security: bearer,
        responses: {
          200: ok('Indicadores', ref('SchoolSummary')),
          401: unauthorized,
          403: forbidden,
        },
      },
    },

    '/api/dashboard/user-summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Resumen de usuarios por estado',
        security: bearer,
        responses: {
          200: ok('Indicadores', ref('UserSummary')),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/api/dashboard/station-summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Resumen de estaciones por estado',
        security: bearer,
        responses: {
          200: ok('Indicadores', ref('StationSummary')),
          401: unauthorized,
          403: forbidden,
        },
      },
    },

    // ---- Roles
    '/api/roles': {
      get: {
        tags: ['Roles'],
        summary: 'Listar roles asignables (excluye SUPERADMIN)',
        security: bearer,
        responses: {
          200: ok('Roles activos ordenados por nombre', { type: 'array', items: ref('RoleItem') }),
          401: unauthorized,
        },
      },
    },
    '/api/roles/staff': {
      get: {
        tags: ['Roles'],
        summary: 'Listar roles por debajo de APP_ADMIN (excluye SUPERADMIN y APP_ADMIN)',
        security: bearer,
        responses: {
          200: ok('Roles activos ordenados por nombre', { type: 'array', items: ref('RoleItem') }),
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
    '/api/media': {
      get: {
        tags: ['Media'],
        summary: 'Listar media (paginado)',
        security: bearer,
        description:
          'A diferencia del resto de /api/media, responde con el envoltorio `{ status, data, pagination }`. ' +
          'Ordenado del más reciente al más antiguo. Un usuario que no es SUPERADMIN solo ve los archivos de su colegio (se ignora schoolId).',
        parameters: [
          query('serialCode', { type: 'string' }, 'Parte del código (sin distinguir mayúsculas), ej. RC-20261119'),
          query('schoolId', { type: 'string', format: 'uuid' }, 'Solo SUPERADMIN: colegio exacto'),
          query('stationId', { type: 'string', format: 'uuid' }, 'Estación exacta'),
          query('dateFrom', { type: 'string', format: 'date', example: '2026-11-01' }, 'Fecha de guardado desde (yyyy-mm-dd, hora de Lima, inclusive)'),
          query('dateTo', { type: 'string', format: 'date', example: '2026-11-30' }, 'Fecha de guardado hasta (yyyy-mm-dd, hora de Lima, inclusive)'),
          query('status', { type: 'string', enum: ['pending', 'uploaded', 'processing', 'ready', 'failed'] }, 'Estado'),
          ...paginationParams,
        ],
        responses: {
          200: okPage('Página de media ordenada por fecha de guardado (desc)', ref('MediaListItem')),
          400: errorResponse('Filtro o paginación inválidos (uuid, fecha yyyy-mm-dd, dateFrom > dateTo, status)'),
          401: unauthorized,
          403: errorResponse('Cuenta sin colegio asignado'),
        },
      },
      post: {
        tags: ['Media'],
        summary: 'Subir archivo (multipart/form-data)',
        security: bearer,
        description:
          'Sube el archivo a través del API y crea la media ya en estado `uploaded` (se encola su procesamiento). ' +
          'Útil para probar desde Swagger y para archivos pequeños: en Vercel el body está limitado a 4,5 MB, ' +
          'así que para videos usar el flujo con URL prefirmada (`/api/media/uploads` + `/confirm`). ' +
          'El tipo se toma de `mimeType` o, si no se envía, de la extensión del archivo.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'jpg, png, webp, mp4, webm o mov' },
                  mimeType: {
                    type: 'string',
                    enum: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
                    description: 'Opcional; por defecto se deduce de la extensión',
                  },
                  originalName: { type: 'string', description: 'Opcional; nombre con el que se registra el archivo' },
                  schoolId: { type: 'string', format: 'uuid', description: 'SUPERADMIN: obligatorio salvo que envíe stationId (se usa su colegio). Otros roles: se usa su propio colegio (se ignora)' },
                  stationId: { type: 'string', format: 'uuid', description: 'Opcional; estación que capturó el archivo (debe ser del mismo colegio)' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Media creada en estado uploaded', content: json('Media') },
          400: errorResponse('Falta el archivo o está vacío; schoolId/stationId inválidos, inexistentes o de colegios distintos'),
          401: unauthorized,
          403: errorResponse('Cuenta sin colegio asignado'),
          415: errorResponse('Tipo de archivo no soportado'),
        },
      },
    },
    '/api/media/uploads': {
      post: {
        tags: ['Media'],
        summary: '1. Solicitar URL prefirmada de subida',
        security: bearer,
        requestBody: { required: true, content: json('CreateUploadRequest') },
        responses: {
          201: { description: 'Registro creado en estado pending', content: json('CreateUploadResponse') },
          400: errorResponse('schoolId/stationId inválidos, inexistentes o de colegios distintos'),
          401: unauthorized,
          403: errorResponse('Cuenta sin colegio asignado'),
          415: errorResponse('Tipo de archivo no soportado'),
        },
      },
    },
    '/api/media/{id}/confirm': {
      post: {
        tags: ['Media'],
        summary: '2. Confirmar la subida tras el PUT al storage',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: { description: 'Media marcada como uploaded y encolada para procesamiento', content: json('Media') },
          401: unauthorized,
          404: errorResponse('Media no encontrada (o de otro colegio)'),
          409: errorResponse('El objeto aún no existe en el storage'),
        },
      },
    },
    '/api/media/{id}': {
      get: {
        tags: ['Media'],
        summary: 'Obtener media con URL de descarga',
        security: bearer,
        parameters: [idParam],
        responses: {
          200: { description: 'Media', content: json('MediaWithUrl') },
          401: unauthorized,
          404: errorResponse('Media no encontrada (o de otro colegio)'),
        },
      },
    },
  },
};

export default openapi;
