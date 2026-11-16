import HttpError from "./http-error.ts";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// Query string of the paginated lists: ?page=1&pageSize=10 (both optional).
export interface PaginationQuery {
    page?: unknown;
    pageSize?: unknown;
}

export interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface Paginated<T> {
    items: T[];
    pagination: Pagination;
}

function parsePositiveInt(field: string, raw: unknown, fallback: number): number {
    const text = String(raw ?? '').trim();
    if (!text) return fallback;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1) throw new HttpError(400, `${field} debe ser un entero positivo`);
    return value;
}

// page defaults to 1 and pageSize to 10 (max 100). Returns the limit/offset for Sequelize.
export function parsePagination(query: PaginationQuery = {}) {
    const page = parsePositiveInt('page', query.page, 1);
    const pageSize = parsePositiveInt('pageSize', query.pageSize, DEFAULT_PAGE_SIZE);
    if (pageSize > MAX_PAGE_SIZE) throw new HttpError(400, `pageSize debe ser como máximo ${MAX_PAGE_SIZE}`);
    return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

export function toPaginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
