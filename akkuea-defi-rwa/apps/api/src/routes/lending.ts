import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, paginationQuerySchema } from '../middleware';
import { LendingController } from '../controllers/LendingController';

const poolQuerySchema = paginationQuerySchema.extend({
  asset: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

const poolIdParamSchema = uuidParamSchema;

const poolUserParamsSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  address: z.string().length(56).regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address format'),
});

const depositSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const withdrawSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const borrowSchema = z.object({
  borrowAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  collateralAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  collateralAsset: z.string().length(56).regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address format'),
});

const repaySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const createPoolSchema = z.object({
  name: z.string().min(1).max(255),
  asset: z.string().min(1).max(20),
  assetAddress: z.string().length(56).regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address format'),
  collateralFactor: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationThreshold: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationPenalty: z.string().regex(/^\d+(\.\d+)?$/),
  reserveFactor: z.coerce.number().int().nonnegative().optional(),
});

export const lendingRoutes = new Elysia({ prefix: '/lending' })
  // GET /pools - List pools with pagination and filters
  .use(validate({ query: poolQuerySchema }))
  .get('/pools', async (ctx) => LendingController.getPools(ctx))

  // POST /pools - Create pool (auth required)
  .use(validate({ body: createPoolSchema }))
  .post('/pools', async (ctx) => LendingController.createPool(ctx))

  // GET /pools/:id - Get single pool
  .use(validate({ params: poolIdParamSchema }))
  .get('/pools/:id', async (ctx) => LendingController.getPool(ctx))

  // POST /pools/:id/deposit - Deposit into pool (auth required)
  .use(validate({ body: depositSchema }))
  .post('/pools/:id/deposit', async (ctx) => LendingController.deposit(ctx))

  // POST /pools/:id/withdraw - Withdraw from pool (auth required)
  .use(validate({ body: withdrawSchema }))
  .post('/pools/:id/withdraw', async (ctx) => LendingController.withdraw(ctx))

  // POST /pools/:id/borrow - Borrow from pool (auth required)
  .use(validate({ body: borrowSchema }))
  .post('/pools/:id/borrow', async (ctx) => LendingController.borrow(ctx))

  // POST /pools/:id/repay - Repay loan (auth required)
  .use(validate({ body: repaySchema }))
  .post('/pools/:id/repay', async (ctx) => LendingController.repay(ctx))

  // GET /pools/:id/user/:address/deposits - Get user deposits
  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/deposits', async (ctx) => LendingController.getUserDeposits(ctx))

  // GET /pools/:id/user/:address/borrows - Get user borrows
  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/borrows', async (ctx) => LendingController.getUserBorrows(ctx));
