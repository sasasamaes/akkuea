import { Elysia } from 'elysia';
import { KYCController } from '../controllers/KYCController';
import { ApiError } from '../errors/ApiError';

const DOCUMENT_TYPES = ['passport', 'id_card', 'proof_of_address', 'other', 'national_id', 'drivers_license', 'bank_statement', 'tax_document'] as const;

function isApiErrorLike(e: unknown): e is { statusCode: number; code: string; message: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'statusCode' in e &&
    'code' in e &&
    typeof (e as { statusCode: unknown }).statusCode === 'number' &&
    typeof (e as { code: unknown }).code === 'string'
  );
}

function handleKycError(error: unknown, set: { status: number }) {
  if (error instanceof ApiError || isApiErrorLike(error)) {
    const err = error as { statusCode: number; code: string; message: string };
    set.status = err.statusCode;
    return { success: false, error: err.code, message: err.message };
  }
  set.status = 500;
  return {
    success: false,
    error: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
}

export const kycRoutes = new Elysia({ prefix: '/kyc' })
  .get('/status/:userId', async ({ params: { userId }, set }) => {
    try {
      return await KYCController.getKYCStatus(userId);
    } catch (error) {
      return handleKycError(error, set);
    }
  })
  .post(
    '/upload',
    async ({ request, set }) => {
      try {
        const contentType = request.headers.get('content-type') ?? '';
        if (!contentType.includes('multipart/form-data')) {
          set.status = 400;
          return { success: false, error: 'BAD_REQUEST', message: 'Content-Type must be multipart/form-data' };
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const userId = formData.get('userId');
        const documentType = formData.get('documentType');

        if (!userId || typeof userId !== 'string') {
          set.status = 400;
          return { success: false, error: 'BAD_REQUEST', message: 'userId is required' };
        }
        if (!documentType || typeof documentType !== 'string') {
          set.status = 400;
          return { success: false, error: 'BAD_REQUEST', message: 'documentType is required' };
        }
        if (!DOCUMENT_TYPES.includes(documentType as typeof DOCUMENT_TYPES[number])) {
          set.status = 400;
          return {
            success: false,
            error: 'BAD_REQUEST',
            message: 'documentType must be one of: passport, id_card, proof_of_address, other, national_id, drivers_license, bank_statement, tax_document',
          };
        }

        if (!file || !(file instanceof File)) {
          set.status = 400;
          return { success: false, error: 'BAD_REQUEST', message: 'file is required' };
        }

        const result = await KYCController.uploadDocument(userId, documentType, {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: () => file.arrayBuffer(),
        });

        set.status = 200;
        return { documentId: result.documentId, submissionId: result.submissionId };
      } catch (error) {
        return handleKycError(error, set);
      }
    },
    {
      beforeHandle: [
        async ({ request, set }) => {
          const key = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
          const windowMs = 60 * 1000;
          const max = 10;
          const store = (globalThis as any).__kycUploadRateLimit ?? new Map<string, { count: number; resetAt: number }>();
          (globalThis as any).__kycUploadRateLimit = store;
          const now = Date.now();
          let entry = store.get(key);
          if (!entry) {
            store.set(key, { count: 1, resetAt: now + windowMs });
            return;
          }
          if (now >= entry.resetAt) {
            entry.count = 1;
            entry.resetAt = now + windowMs;
            return;
          }
          entry.count += 1;
          if (entry.count > max) {
            set.status = 429;
            return {
              success: false,
              error: 'TOO_MANY_REQUESTS',
              message: 'Too many upload requests. Please try again later.',
            };
          }
        },
      ],
    }
  )
  .post('/submit', async ({ body, set }) => {
    try {
      return await KYCController.submitKYC(
        body as {
          userId: string;
          documents: {
            type: 'passport' | 'id_card' | 'proof_of_address' | 'other';
            documentUrl: string;
          }[];
        },
      );
    } catch (error) {
      return handleKycError(error, set);
    }
  })
  .post('/verify/:documentId', async ({ params: { documentId }, body, set }) => {
    try {
      return await KYCController.verifyDocument(documentId, body as { verified: boolean; notes?: string });
    } catch (error) {
      return handleKycError(error, set);
    }
  })
  .get('/documents/:userId', async ({ params: { userId }, set }) => {
    try {
      return await KYCController.getUserDocuments(userId);
    } catch (error) {
      return handleKycError(error, set);
    }
  })
  .get('/file/:documentId', async ({ params: { documentId }, set }) => {
    try {
      const { buffer, contentType, fileName } = await KYCController.getDocumentFile(documentId);
      set.headers['Content-Type'] = contentType;
      set.headers['Content-Disposition'] = `inline; filename="${fileName}"`;
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${fileName}"`,
        },
      });
    } catch (error) {
      const body = handleKycError(error, set);
      return new Response(JSON.stringify(body), {
        status: set.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
