import type { NextFunction, Request, Response } from 'express';

// Messages for errors raised by Express' body parser, which come in English.
const BODY_PARSER_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'El cuerpo de la solicitud no es un JSON válido',
  'entity.too.large': 'El cuerpo de la solicitud es demasiado grande',
  'encoding.unsupported': 'Codificación de la solicitud no soportada',
  'charset.unsupported': 'Juego de caracteres de la solicitud no soportado',
  'request.aborted': 'La solicitud fue interrumpida',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function errorHandler(err: Error & { status?: number; type?: string }, req: Request, res: Response, next: NextFunction) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message = status >= 500
    ? 'Error interno del servidor'
    : (err.type && BODY_PARSER_MESSAGES[err.type]) || err.message;
  res.status(status).json({ error: message });
}
