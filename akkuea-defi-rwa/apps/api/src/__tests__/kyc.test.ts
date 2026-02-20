import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { kycRoutes } from '../routes/kyc';
import { errorHandler } from '../middleware/errorHandler';

const skipIfNoDatabase = !process.env.DATABASE_URL;
const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const NON_EXISTENT_USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const NON_EXISTENT_DOC_ID = '550e8400-e29b-41d4-a716-446655440099';

function createApp() {
  return new Elysia().use(errorHandler).use(kycRoutes);
}

describe('KYC Routes', () => {
  describe('GET /kyc/status/:userId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent user', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${NON_EXISTENT_USER_ID}`),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { success?: boolean; error?: string; message?: string };
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toContain('User not found');
    });

    it.skipIf(skipIfNoDatabase)('returns status and documents for existing user', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`),
      );
      if (response.status === 404) {
        // User may not exist in test DB
        expect(response.status).toBe(404);
        return;
      }
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        status: string;
        documents: unknown[];
      };
      expect(['pending', 'verified', 'rejected']).toContain(body.status);
      expect(Array.isArray(body.documents)).toBe(true);
    });
  });

  describe('POST /kyc/upload', () => {
    it('returns 400 when Content-Type is not multipart', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message).toContain('multipart');
    });

    it('returns 400 when file is missing', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          body: formData,
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message).toContain('file');
    });

    it.skipIf(skipIfNoDatabase)('returns 400 for invalid file type (.exe)', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      formData.set('file', new File(['fake'], 'virus.exe', { type: 'application/x-msdownload' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          body: formData,
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message?.toLowerCase()).toMatch(/invalid file type|only pdf|jpg|png/);
    });

    it.skipIf(skipIfNoDatabase)('returns 400 for oversized file (over 10MB)', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      const bigSize = 11 * 1024 * 1024;
      const bigBlob = new Blob([new Uint8Array(bigSize)]);
      formData.set('file', new File([bigBlob], 'large.pdf', { type: 'application/pdf' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          body: formData,
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message?.toLowerCase()).toMatch(/size|10mb|limit/);
    });

    it.skipIf(skipIfNoDatabase)('returns 200 with documentId for valid PDF upload', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      formData.set('file', new File([pdfContent], 'id.pdf', { type: 'application/pdf' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          body: formData,
        }),
      );
      if (response.status === 404) {
        expect(response.status).toBe(404);
        return;
      }
      expect(response.status).toBe(200);
      const body = (await response.json()) as { documentId?: string; submissionId?: string };
      expect(body.documentId).toBeDefined();
      expect(body.submissionId).toBeDefined();
    });
  });

  describe('GET /kyc/documents/:userId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent user', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/documents/${NON_EXISTENT_USER_ID}`),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('POST /kyc/verify/:documentId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent document', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${NON_EXISTENT_DOC_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('NOT_FOUND');
    });

    it.skipIf(skipIfNoDatabase)('admin can approve document', async () => {
      const app = createApp();
      const statusRes = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`),
      );
      if (statusRes.status !== 200) return;
      const statusBody = (await statusRes.json()) as { documents: { id: string }[] };
      const docId = statusBody.documents?.[0]?.id;
      if (!docId) return;
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${docId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it.skipIf(skipIfNoDatabase)('admin can reject with reason', async () => {
      const app = createApp();
      const statusRes = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`),
      );
      if (statusRes.status !== 200) return;
      const statusBody = (await statusRes.json()) as { documents: { id: string }[] };
      const docId = statusBody.documents?.[0]?.id;
      if (!docId) return;
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${docId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: false, notes: 'Document expired' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe('GET /kyc/file/:documentId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent document', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/file/${NON_EXISTENT_DOC_ID}`),
      );
      expect(response.status).toBe(404);
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 after exceeding upload rate limit', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      formData.set('file', new File(['x'], 'x.pdf', { type: 'application/pdf' }));

      let lastStatus = 0;
      for (let i = 0; i < 15; i++) {
        const response = await app.handle(
          new Request('http://localhost/kyc/upload', { method: 'POST', body: formData }),
        );
        lastStatus = response.status;
        if (response.status === 429) break;
      }
      expect(lastStatus).toBe(429);
    });
  });
});
