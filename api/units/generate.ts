import {
  handleUnitGenerateRequest,
  normalizeRequestBody
} from '../../src/server/learningApi';

type VercelRequestLike = {
  method?: string;
  body?: unknown;
} & NodeJS.ReadableStream;

type VercelResponseLike = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const readRequestBody = async (req: VercelRequestLike): Promise<string> => {
  if (typeof req.body !== 'undefined') {
    return normalizeRequestBody(req.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const sendJson = (res: VercelResponseLike, code: number, payload: unknown): void => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const rawBody = await readRequestBody(req);
  const response = await handleUnitGenerateRequest(rawBody);
  sendJson(res, response.statusCode, response.body);
}
