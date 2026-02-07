
import { z } from 'zod';
import { insertUserSchema, insertDepositSchema, insertWithdrawalSchema, insertKycSchema, users, deposits, withdrawals, kycDocuments } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ email: z.string().email(), password: z.string() }),
      responses: {
        200: z.object({ message: z.string(), requiresOtp: z.boolean() }), // Intermediate step
        401: errorSchemas.unauthorized,
      },
    },
    verifyOtp: {
      method: 'POST' as const,
      path: '/api/auth/verify-otp' as const,
      input: z.object({ email: z.string().email(), otp: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  deposits: {
    list: {
      method: 'GET' as const,
      path: '/api/deposits' as const,
      responses: {
        200: z.array(z.custom<typeof deposits.$inferSelect>()),
      },
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
      responses: {
        200: z.array(z.custom<typeof withdrawals.$inferSelect>()),
      },
    },
    requestOtp: {
        method: 'POST' as const,
        path: '/api/withdrawals/otp' as const,
        responses: {
            200: z.object({ message: z.string() }),
        }
    },
    create: {
      method: 'POST' as const,
      path: '/api/withdrawals' as const,
      input: insertWithdrawalSchema.extend({ otp: z.string() }), // Require OTP
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
        responses: {
            200: z.custom<typeof kycDocuments.$inferSelect>().nullable(),
        }
    },
    upload: {
      method: 'POST' as const,
      path: '/api/kyc' as const,
      // Input is FormData, not easily typed with Zod for the body parser, but we can verify structure in backend
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
        responses: {
            200: z.array(z.custom<typeof users.$inferSelect>()),
        }
    },
    updateBalance: {
        method: 'PATCH' as const,
        path: '/api/admin/users/:id/balance' as const,
        input: z.object({ balance: z.coerce.number() }),
        responses: {
            200: z.custom<typeof users.$inferSelect>(),
        }
    },
    approveDeposit: {
        method: 'PATCH' as const,
        path: '/api/admin/deposits/:id/approve' as const,
        responses: { 200: z.custom<typeof deposits.$inferSelect>() }
    },
    rejectDeposit: {
        method: 'PATCH' as const,
        path: '/api/admin/deposits/:id/reject' as const,
        responses: { 200: z.custom<typeof deposits.$inferSelect>() }
    },
    approveWithdrawal: {
        method: 'PATCH' as const,
        path: '/api/admin/withdrawals/:id/approve' as const,
        responses: { 200: z.custom<typeof withdrawals.$inferSelect>() }
    },
    rejectWithdrawal: {
        method: 'PATCH' as const,
        path: '/api/admin/withdrawals/:id/reject' as const,
        responses: { 200: z.custom<typeof withdrawals.$inferSelect>() }
    },
     verifyKyc: {
        method: 'PATCH' as const,
        path: '/api/admin/kyc/:id/verify' as const,
        responses: { 200: z.custom<typeof kycDocuments.$inferSelect>() }
    },
     rejectKyc: {
        method: 'PATCH' as const,
        path: '/api/admin/kyc/:id/reject' as const,
        responses: { 200: z.custom<typeof kycDocuments.$inferSelect>() }
    }
  }
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
