import { logger } from './logger';
import { transactionRepository } from '../repositories/TransactionRepository';
import { ApiError } from '../errors/ApiError';
import { createHmac } from 'crypto';

export interface WebhookPayload {
    transactionHash: string;
    status: 'confirmed' | 'failed';
    network?: string;
    timestamp?: string;
}

export class WebhookService {
    private readonly webhookSecret: string;

    constructor() {
        this.webhookSecret = process.env.WEBHOOK_SECRET || 'default-secret-for-dev';
        if (!process.env.WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
            logger.error('WEBHOOK_SECRET is not set in production!');
        }
    }

    /**
     * Validates the webhook signature from the request header.
     * Expects an X-Webhook-Signature header.
     */
    validateSignature(payload: string, signature: string): boolean {
        const hmac = createHmac('sha256', this.webhookSecret);
        const digest = hmac.update(payload).digest('hex');
        return digest === signature;
    }

    /**
     * Processes the transaction webhook payload.
     * Updates transaction status and handles idempotency.
     */
    async processTransactionWebhook(payload: WebhookPayload): Promise<void> {
        const { transactionHash, status } = payload;

        logger.info('Processing transaction webhook', {
            operation: 'WEBHOOK_PROCESS',
            transactionHash,
            status
        });

        const transaction = await transactionRepository.findByHash(transactionHash);

        if (!transaction) {
            logger.warn('Transaction not found for webhook', { transactionHash });
            throw ApiError.notFound(`Transaction with hash ${transactionHash} not found`);
        }

        // Idempotency: skip update if status is already the same or already in a terminal state
        if (transaction.status === status) {
            logger.info('Transaction status already up to date, skipping', {
                transactionId: transaction.id,
                transactionHash,
                status
            });
            throw ApiError.conflict(`Transaction status is already ${status}`);
        }

        if (transaction.status !== 'pending' && transaction.status !== 'confirmed' && transaction.status !== 'failed') {
            // This shouldn't happen based on our enum but good to be safe
            logger.warn('Transaction in unexpected state', { transactionId: transaction.id, state: transaction.status });
        }

        try {
            await transactionRepository.updateStatus(transaction.id, status);

            logger.crud.success('WEBHOOK_UPDATE', 'Transaction', transaction.id);
        } catch (error) {
            logger.crud.failure('WEBHOOK_UPDATE', 'Transaction', error as Error, transaction.id);
            throw ApiError.internal('Failed to update transaction status');
        }
    }
}

export const webhookService = new WebhookService();
