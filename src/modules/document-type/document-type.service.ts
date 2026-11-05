import { DocumentType } from "../../db/models/index.ts";
import type { DocumentTypeItem } from "../../interfaces/document-type.interface.ts";

// Catalog for the document type selector (DNI, Pasaporte, ...).
export async function list(): Promise<DocumentTypeItem[]> {
    const types = await DocumentType.findAll({
        attributes: ['id', 'name', 'size', 'description'],
        order: [['name', 'ASC']],
    });
    return types.map(({ id, name, size, description }) => ({ id, name, size, description }));
}
