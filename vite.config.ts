import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import {
  buildOpenAISettings,
  handlePostcardGenerateRequest,
  handleUnitGenerateRequest,
  type OpenAISettings
} from './src/server/learningApi';

type NodeRequest = {
  method?: string;
  url?: string;
} & NodeJS.ReadableStream;

type NodeResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const readRequestBody = async (req: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const sendJson = (res: NodeResponse, code: number, payload: unknown): void => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const learningUnitApiPlugin = (settings: OpenAISettings): Plugin => {
  const handler = async (req: NodeRequest, res: NodeResponse, next: () => void) => {
    const pathname = (req.url ?? '').split('?')[0] ?? '';
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const isUnitApi = normalizedPath === '/api/units/generate';
    const isPostcardApi = normalizedPath === '/api/postcards/generate';

    if (!isUnitApi && !isPostcardApi) {
      next();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      const response = isUnitApi
        ? await handleUnitGenerateRequest(rawBody)
        : await handlePostcardGenerateRequest(rawBody, settings);

      sendJson(res, response.statusCode, response.body);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unexpected server error'
      });
    }
  };

  return {
    name: 'learning-unit-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const settings = buildOpenAISettings({
    OPENAI_API_KEY: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    OPENAI_TEXT_MODEL: env.OPENAI_TEXT_MODEL || process.env.OPENAI_TEXT_MODEL,
    PEXELS_API_KEY: env.PEXELS_API_KEY || process.env.PEXELS_API_KEY
  });

  return {
    plugins: [react(), learningUnitApiPlugin(settings)],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      css: true
    }
  };
});
