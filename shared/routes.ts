import { z } from 'zod';
import { insertDepositSchema, insertWithdrawalSchema, profiles, deposits, withdrawals, kycDocuments, notifications } from './schema';

export type { Profile, Deposit, InsertDeposit, Withdrawal, InsertWithdrawal, KycDocument, Notification } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.custom<typeof profiles.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  deposits: {
    list: {
      method: 'GET' as const,
      path: '/api/deposits' as const,
      responses: { 200: z.array(z.custom<typeof deposits.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/deposits' as const,
      input: insertDepositSchema,
      responses: {
        201: z.custom<typeof deposits.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  withdrawals: {
    list: {
      method: 'GET' as const,
      path: '/api/withdrawals' as const,
      responses: { 200: z.array(z.custom<typeof withdrawals.$inferSelect>()) },
    },
    requestOtp: {
      method: 'POST' as const,
      path: '/api/withdrawals/otp' as const,
      responses: { 200: z.object({ message: z.string() }) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/withdrawals' as const,
      input: z.object({
        amount: z.string(),
        trcAddress: z.string().min(25, "TRC-20 address must be at least 25 characters"),
        pin: z.string().length(6, "Withdrawal PIN must be exactly 6 digits"),
      }),
      responses: {
        201: z.custom<typeof withdrawals.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  kyc: {
    status: {
      method: 'GET' as const,
      path: '/api/kyc/status' as const,
      responses: { 200: z.custom<typeof kycDocuments.$inferSelect>().nullable() },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/kyc' as const,
      responses: {
        201: z.custom<typeof kycDocuments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  admin: {
    users: {
      method: 'GET' as const,
      path: '/api/admin/users' as const,
      responses: { 200: z.array(z.custom<typeof profiles.$inferSelect>()) },
    },
    updateBalance: {
      method: 'PATCH' as const,
      path: '/api/admin/users/:id/balance' as const,
      input: z.object({ balance: z.coerce.number() }),
      responses: { 200: z.custom<typeof profiles.$inferSelect>() },
    },
    approveDeposit: {
      method: 'PATCH' as const,
      path: '/api/admin/deposits/:id/approve' as const,
      responses: { 200: z.custom<typeof deposits.$inferSelect>() },
    },
    rejectDeposit: {
      method: 'PATCH' as const,
      path: '/api/admin/deposits/:id/reject' as const,
      responses: { 200: z.custom<typeof deposits.$inferSelect>() },
    },
    approveWithdrawal: {
      method: 'PATCH' as const,
      path: '/api/admin/withdrawals/:id/approve' as const,
      responses: { 200: z.custom<typeof withdrawals.$inferSelect>() },
    },
    rejectWithdrawal: {
      method: 'PATCH' as const,
      path: '/api/admin/withdrawals/:id/reject' as const,
      responses: { 200: z.custom<typeof withdrawals.$inferSelect>() },
    },
    verifyKyc: {
      method: 'PATCH' as const,
      path: '/api/admin/kyc/:id/verify' as const,
      responses: { 200: z.custom<typeof kycDocuments.$inferSelect>() },
    },
    rejectKyc: {
      method: 'PATCH' as const,
      path: '/api/admin/kyc/:id/reject' as const,
      responses: { 200: z.custom<typeof kycDocuments.$inferSelect>() },
    },
    allKyc: {
      method: 'GET' as const,
      path: '/api/admin/kyc' as const,
      responses: { 200: z.array(z.any()) },
    },
    allDeposits: {
      method: 'GET' as const,
      path: '/api/admin/deposits' as const,
      responses: { 200: z.array(z.custom<typeof deposits.$inferSelect>()) },
    },
    allWithdrawals: {
      method: 'GET' as const,
      path: '/api/admin/withdrawals' as const,
      responses: { 200: z.array(z.custom<typeof withdrawals.$inferSelect>()) },
    },
    sendNotification: {
      method: 'POST' as const,
      path: '/api/admin/notifications/send' as const,
      input: z.object({
        profileId: z.number(),
        title: z.string().min(1),
        message: z.string().min(1),
      }),
      responses: {
        201: z.custom<typeof notifications.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications' as const,
      responses: { 200: z.array(z.custom<typeof notifications.$inferSelect>()) },
    },
    unreadCount: {
      method: 'GET' as const,
      path: '/api/notifications/unread-count' as const,
      responses: { 200: z.object({ count: z.number() }) },
    },
    markRead: {
      method: 'PATCH' as const,
      path: '/api/notifications/:id/read' as const,
      responses: { 200: z.object({ message: z.string() }) },
    },
    markAllRead: {
      method: 'PATCH' as const,
      path: '/api/notifications/read-all' as const,
      responses: { 200: z.object({ message: z.string() }) },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
