import crypto from "node:crypto";
import path from "node:path";
import { col, fn, ForeignKeyConstraintError, literal, Op, QueryTypes, where as sqlWhere, type Transaction, type WhereOptions } from "sequelize";
import { PhotoType, PickupStatus, ValidationMethod } from "../../db/models/enums.ts";
import {
    Authorization,
    Guardian,
    Media,
    Notification,
    Pickup,
    PickupPhoto,
    School,
    SchoolSettings,
    Station,
    Student,
    sequelize,
} from "../../db/models/index.ts";
import { isSuperadmin, resolveSchoolId } from "../../helper/school-scope.helper.ts";
import { kindFor } from "../../helper/media.helper.ts";
import type { PickupAttributes, PickupInstance } from "../../interfaces/models/pickup.interface.ts";
import type { StudentInstance } from "../../interfaces/models/student.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import type { PickupCreated, PickupInput, PickupListFilters, PickupListItem, PickupPhotoFile } from "../../interfaces/pickup.interface.ts";
import storage from "../../services/storage/index.ts";
import { limaCompactDate, limaDate, limaDayStart, limaIsoDate, limaTime } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { parseBoolean } from "../../utils/parse.util.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PHOTO_RETENTION_DAYS = 30;
// Clock skew tolerated for an occurredAt sent by a station.
const MAX_FUTURE_MS = 5 * 60 * 1000;
// Methods that identify the person who picks up: a guardian sent with them must be authorized for the student.
const IDENTIFIED_METHODS: readonly ValidationMethod[] = ['FACE', 'CODE', 'NATIONAL_ID'];
const UNACCOMPANIED_LABEL = 'Salió solo';

// ---- Parsing helpers

function parseUuid(field: string, raw: unknown, required = false): string | null {
    const value = String(raw ?? '').trim();
    if (!value) {
        if (required) throw new HttpError(400, `${field} es obligatorio`);
        return null;
    }
    if (!isUuid(value)) throw new HttpError(400, `${field} inválido`);
    return value;
}

function parseEnum<T extends string>(field: string, raw: unknown, values: readonly T[]): T | null {
    const value = String(raw ?? '').trim().toUpperCase();
    if (!value) return null;
    if (!(values as readonly string[]).includes(value)) throw new HttpError(400, `${field} debe ser uno de ${values.join(', ')}`);
    return value as T;
}

function parseText(field: string, raw: unknown, max: number): string | null {
    const value = String(raw ?? '').trim();
    if (!value) return null;
    if (value.length > max) throw new HttpError(400, `${field} debe tener como máximo ${max} caracteres`);
    return value;
}

function parseOccurredAt(raw: unknown): Date {
    const text = String(raw ?? '').trim();
    if (!text) return new Date();
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, 'occurredAt debe ser una fecha ISO 8601 válida');
    if (date.getTime() > Date.now() + MAX_FUTURE_MS) throw new HttpError(400, 'occurredAt no puede ser una fecha futura');
    return date;
}

function parseConfidence(raw: unknown): number | null {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new HttpError(400, 'confidence debe ser un número entre 0 y 100');
    return value;
}

// "yyyy-mm-dd" (Lima day) -> start of that day; with endOfDay, the start of the next day (exclusive bound).
function parseDayFilter(field: string, raw: unknown, endOfDay = false): Date | undefined {
    const value = String(raw ?? '').trim();
    if (!value) return undefined;
    const start = limaDayStart(value);
    if (!start) throw new HttpError(400, `${field} debe tener el formato yyyy-mm-dd`);
    return endOfDay ? new Date(start.getTime() + DAY_MS) : start;
}

// "yyyy-mm-dd" of today in Lima, to compare with "Authorization"."validUntil" (DATE).
const limaToday = () => limaIsoDate(new Date());

// Active authorizations of a student (not revoked, not past validUntil).
function activeAuthorizationWhere(studentId: string) {
    return {
        studentId,
        revokedAt: null,
        [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gte]: limaToday() } }],
    };
}

// ---- Code: "RET-{yyyymmdd}-{######}", consecutive per Lima day ("PickupCounter").
async function nextCode(occurredAt: Date, transaction: Transaction): Promise<string> {
    const date = limaCompactDate(occurredAt);
    const [row] = await sequelize.query<{ value: number }>(
        `INSERT INTO "PickupCounter" ("date", "value") VALUES (:date, 1)
         ON CONFLICT ("date") DO UPDATE SET "value" = "PickupCounter"."value" + 1
         RETURNING "value"`,
        { replacements: { date }, type: QueryTypes.SELECT, transaction },
    );
    return `RET-${date}-${String(row!.value).padStart(6, '0')}`;
}

// pickups/{schoolId}/{yyyy}/{mm}/{dd}/{pickupId}-{sequence}.{ext}
function photoKey(schoolId: string, pickupId: string, occurredAt: Date, originalName: string): string {
    const d = limaCompactDate(occurredAt);
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    return `pickups/${schoolId}/${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}/${pickupId}-1${ext}`;
}

// ---- Create

interface ResolvedPhoto {
    storageKey: string;
    uploaded: boolean; // true when this request put the object in storage (removed again if the insert fails)
}

// Records a pickup (exit) of a student.
// Required: studentId, method (and schoolId for SUPERADMIN). pickedUpBy defaults to the guardian's name
// (or "Salió solo" for UNACCOMPANIED). Photo: a multipart `photo` file or `mediaId` (image uploaded via /api/media).
// With guardianNotified = true an EXIT notification is recorded for every guardian that receives notifications.
export async function create(input: PickupInput, photoFile: PickupPhotoFile | null, currentUser?: UserInstance): Promise<PickupCreated> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');

    const studentId = parseUuid('studentId', input.studentId, true)!;
    const student = await Student.findByPk(studentId);
    if (!student || !student.active) throw new HttpError(404, 'Estudiante no encontrado');

    // A SUPERADMIN may omit schoolId: the student's school is used.
    const schoolId = isSuperadmin(currentUser)
        ? resolveSchoolId(currentUser, input.schoolId ?? student.schoolId)
        : resolveSchoolId(currentUser);
    if (student.schoolId !== schoolId) throw new HttpError(404, 'Estudiante no encontrado');

    const stationId = parseUuid('stationId', input.stationId);
    if (stationId) {
        const station = await Station.findByPk(stationId, { attributes: ['id', 'schoolId'] });
        if (!station || station.schoolId !== schoolId) throw new HttpError(400, 'Estación no encontrada en el colegio');
    }

    const method = parseEnum('method', input.method, ValidationMethod);
    if (!method) throw new HttpError(400, `method es obligatorio (${ValidationMethod.join(', ')})`);
    const status = parseEnum('status', input.status, PickupStatus) ?? (method === 'MANUAL' ? 'MANUAL' : 'AUTHORIZED');
    const manualReason = parseText('manualReason', input.manualReason, 160);
    if (status === 'MANUAL' && !manualReason) throw new HttpError(400, 'manualReason es obligatorio para un retiro manual');
    if (method === 'UNACCOMPANIED' && status === 'AUTHORIZED' && !student.canLeaveAlone) {
        throw new HttpError(400, 'El estudiante no está autorizado a salir solo');
    }

    const guardianId = parseUuid('guardianId', input.guardianId);
    let guardianName: string | null = null;
    if (guardianId) {
        const guardian = await Guardian.findByPk(guardianId, { attributes: ['id', 'schoolId', 'name'] });
        if (!guardian || guardian.schoolId !== schoolId) throw new HttpError(400, 'Apoderado no encontrado en el colegio');
        guardianName = guardian.name;
        if (status === 'AUTHORIZED' && IDENTIFIED_METHODS.includes(method)) {
            const authorization = await Authorization.findOne({
                where: { ...activeAuthorizationWhere(studentId), guardianId, canPickUp: true },
                attributes: ['id'],
            });
            if (!authorization) throw new HttpError(400, 'El apoderado no está autorizado a recoger al estudiante');
        }
    }

    const pickedUpBy = parseText('pickedUpBy', input.pickedUpBy, 120)
        ?? guardianName
        ?? (method === 'UNACCOMPANIED' ? UNACCOMPANIED_LABEL : null);
    if (!pickedUpBy) throw new HttpError(400, 'pickedUpBy es obligatorio cuando no se envía guardianId');

    const occurredAt = parseOccurredAt(input.occurredAt);
    const confidence = parseConfidence(input.confidence);
    const photoType = parseEnum('photoType', input.photoType, PhotoType) ?? 'EXIT';
    const guardianNotified = input.guardianNotified === undefined || input.guardianNotified === ''
        ? false
        : parseBoolean('guardianNotified', input.guardianNotified);

    // Photo: uploaded file or an existing media of the same school.
    const pickupId = crypto.randomUUID();
    const mediaId = parseUuid('mediaId', input.mediaId);
    if (photoFile && mediaId) throw new HttpError(400, 'Envía photo o mediaId, no ambos');
    let photo: ResolvedPhoto | null = null;
    if (mediaId) {
        const media = await Media.findByPk(mediaId, { attributes: ['id', 'schoolId', 'kind', 'status', 'storageKey'] });
        if (!media || media.schoolId !== schoolId) throw new HttpError(400, 'Archivo multimedia no encontrado en el colegio');
        if (media.kind !== 'image') throw new HttpError(400, 'mediaId debe ser una imagen');
        if (media.status === 'pending' || media.status === 'failed') throw new HttpError(400, 'La imagen aún no está disponible');
        photo = { storageKey: media.storageKey, uploaded: false };
    }
    const noPhotoReason = parseText('noPhotoReason', input.noPhotoReason, 160);

    const settings = await SchoolSettings.findByPk(schoolId, { attributes: ['photoRetentionDays', 'notificationShowsPhoto'] });
    const retentionDays = settings?.photoRetentionDays ?? DEFAULT_PHOTO_RETENTION_DAYS;

    // Guardians to record as notified (only when the client says it notified them).
    const recipients = guardianNotified
        ? await Authorization.findAll({
            where: { ...activeAuthorizationWhere(studentId), receivesNotifications: true },
            attributes: ['guardianId'],
            include: [{ model: Guardian, as: 'guardian', attributes: ['id', 'receivesPhotos'] }],
        })
        : [];

    // Uploaded last, right before the insert, so a validation error doesn't leave an orphan object.
    if (photoFile) {
        if (kindFor(photoFile.mimeType) !== 'image') throw new HttpError(415, `La foto debe ser jpg, png o webp (${photoFile.mimeType})`);
        if (!photoFile.buffer.length) throw new HttpError(400, 'La foto está vacía');
        const storageKey = photoKey(schoolId, pickupId, occurredAt, photoFile.originalName);
        await storage.upload(storageKey, photoFile.buffer, photoFile.mimeType);
        photo = { storageKey, uploaded: true };
    }

    try {
        return await sequelize.transaction(async (transaction) => {
            const code = await nextCode(occurredAt, transaction);
            await Pickup.create({
                id: pickupId,
                code,
                schoolId,
                stationId,
                studentId,
                occurredAt,
                status,
                method,
                guardianId,
                pickedUpBy,
                confidence,
                recordedById: currentUser.id,
                manualReason,
                noPhotoReason: photo ? null : noPhotoReason,
                photosExpireAt: photo ? new Date(occurredAt.getTime() + retentionDays * DAY_MS) : null,
            }, { transaction });

            if (photo) {
                await PickupPhoto.create({
                    pickupId,
                    sequence: 1,
                    type: photoType,
                    takenAt: occurredAt,
                    storageKey: photo.storageKey,
                }, { transaction });
            }

            const uniqueRecipients = [...new Map(recipients.map((a) => [a.guardianId, a])).values()];
            if (uniqueRecipients.length) {
                const sentAt = new Date();
                const showsPhoto = settings?.notificationShowsPhoto ?? true;
                await Notification.bulkCreate(uniqueRecipients.map((a) => ({
                    schoolId,
                    studentId,
                    guardianId: a.guardianId,
                    type: 'EXIT' as const,
                    pickupId,
                    sentAt,
                    delivered: true,
                    withPhoto: Boolean(photo) && showsPhoto && (a.guardian?.receivesPhotos ?? false),
                })), { transaction });
            }

            return { id: pickupId, code, photoType: photo ? photoType : null, notifiedGuardians: uniqueRecipients.length };
        });
    } catch (err) {
        if (photo?.uploaded) await storage.remove(photo.storageKey).catch(() => undefined);
        if (err instanceof HttpError) throw err;
        if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio, estudiante, estación o apoderado no encontrado');
        throw err;
    }
}

// ---- List

function buildWhere(filters: PickupListFilters, currentUser: UserInstance): WhereOptions<PickupAttributes> {
    const conditions: WhereOptions<PickupAttributes>[] = [];

    if (isSuperadmin(currentUser)) {
        const schoolId = parseUuid('schoolId', filters.schoolId);
        if (schoolId) conditions.push({ schoolId });
    } else {
        if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
        conditions.push({ schoolId: currentUser.schoolId });
    }

    const studentId = parseUuid('studentId', filters.studentId);
    if (studentId) conditions.push({ studentId });
    const stationId = parseUuid('stationId', filters.stationId);
    if (stationId) conditions.push({ stationId });

    const status = parseEnum('status', filters.status, PickupStatus);
    if (status) conditions.push({ status });
    const method = parseEnum('method', filters.method, ValidationMethod);
    if (method) conditions.push({ method });

    const dateFrom = parseDayFilter('dateFrom', filters.dateFrom);
    const dateTo = parseDayFilter('dateTo', filters.dateTo, true);
    if (dateFrom && dateTo && dateFrom >= dateTo) throw new HttpError(400, 'dateFrom no puede ser posterior a dateTo');
    if (dateFrom || dateTo) {
        conditions.push({ occurredAt: { ...(dateFrom && { [Op.gte]: dateFrom }), ...(dateTo && { [Op.lt]: dateTo }) } });
    }

    const name = String(filters.studentName ?? '').trim().replace(/\s+/g, ' ');
    if (name) {
        const pattern = containsPattern(name);
        conditions.push({
            [Op.or]: [
                sqlWhere(col('student.firstName'), { [Op.iLike]: pattern }),
                sqlWhere(col('student.lastName'), { [Op.iLike]: pattern }),
                sqlWhere(fn('concat', col('student.firstName'), ' ', col('student.lastName')), { [Op.iLike]: pattern }),
                sqlWhere(fn('concat', col('student.lastName'), ' ', col('student.firstName')), { [Op.iLike]: pattern }),
            ],
        } as WhereOptions<PickupAttributes>);
    }

    const notifiedText = String(filters.guardianNotified ?? '').trim();
    if (notifiedText) {
        const notified = parseBoolean('guardianNotified', notifiedText);
        conditions.push(literal(
            `${notified ? '' : 'NOT '}EXISTS (SELECT 1 FROM "Notification" n WHERE n."pickupId" = "Pickup"."id" AND n."delivered")`,
        ) as unknown as WhereOptions<PickupAttributes>);
    }

    return { [Op.and]: conditions };
}

// First available photo of each pickup (lowest sequence, not deleted), as a temporary URL.
async function photoUrls(pickups: PickupInstance[]): Promise<Map<string, string>> {
    const now = new Date();
    const ids = pickups.filter((p) => !p.photosExpireAt || p.photosExpireAt > now).map((p) => p.id);
    if (!ids.length) return new Map();

    const photos = await PickupPhoto.findAll({
        where: { pickupId: ids, deletedAt: null, storageKey: { [Op.ne]: null } },
        attributes: ['pickupId', 'storageKey'],
        order: [['pickupId', 'ASC'], ['sequence', 'ASC']],
    });
    const keys = new Map<string, string>();
    for (const photo of photos) if (!keys.has(photo.pickupId)) keys.set(photo.pickupId, photo.storageKey!);

    const entries = await Promise.all(
        [...keys].map(async ([pickupId, key]) => [pickupId, await storage.presignDownload(key)] as const),
    );
    return new Map(entries);
}

async function notifiedPickupIds(pickups: PickupInstance[]): Promise<Set<string>> {
    if (!pickups.length) return new Set();
    const rows = await Notification.findAll({
        where: { pickupId: pickups.map((p) => p.id), delivered: true },
        attributes: ['pickupId'],
        group: ['pickupId'],
    });
    return new Set(rows.map((row) => row.pickupId!));
}

const studentName = (student?: StudentInstance) => (student ? `${student.lastName}, ${student.firstName}` : '');

// Newest first, paginated. A non-SUPERADMIN only sees its own school (a schoolId in the query is ignored).
export async function list(filters: PickupListFilters = {}, currentUser?: UserInstance): Promise<Paginated<PickupListItem>> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const { page, pageSize, limit, offset } = parsePagination(filters);

    const { rows, count } = await Pickup.findAndCountAll({
        where: buildWhere(filters, currentUser),
        include: [
            { model: Student, as: 'student', attributes: ['id', 'firstName', 'lastName'], required: true },
            { model: Station, as: 'station', attributes: ['name'] },
            { model: School, as: 'school', attributes: ['name'] },
        ],
        order: [['occurredAt', 'DESC'], ['id', 'ASC']],
        distinct: true,
        subQuery: false,
        limit,
        offset,
    });

    const [urls, notified] = await Promise.all([photoUrls(rows), notifiedPickupIds(rows)]);
    const items = rows.map((pickup): PickupListItem => ({
        id: pickup.id,
        code: pickup.code,
        occurredAt: pickup.occurredAt.toISOString(),
        date: limaDate(pickup.occurredAt),
        time: limaTime(pickup.occurredAt),
        studentId: pickup.studentId,
        student: studentName(pickup.student),
        pickedUpBy: pickup.pickedUpBy,
        guardianId: pickup.guardianId,
        photoUrl: urls.get(pickup.id) ?? null,
        guardianNotified: notified.has(pickup.id),
        status: pickup.status,
        method: pickup.method,
        station: pickup.station?.name ?? null,
        school: pickup.school?.name ?? '',
    }));
    return toPaginated(items, count, page, pageSize);
}
