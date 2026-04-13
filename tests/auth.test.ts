import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing auth module
vi.mock('@/modules/core/services/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ data: null, error: null })),
      })),
    })),
  })),
}));

// Mock jose — only needed for createToken/verifyToken which we are not directly testing
vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock-token'),
  })),
  jwtVerify: vi.fn().mockResolvedValue({
    payload: {
      sub: 'user-1',
      email: 'test@test.com',
      name: 'Test',
      role: 'seller',
      store_id: 'store-1',
      org_id: 'org-1',
    },
  }),
}));

import {
  hashPassword,
  verifyPassword,
  hasPermission,
  canAccessStore,
  getAuthContext,
} from '@/modules/core/services/auth';
import type { User } from '@/types';

describe('hashPassword', () => {
  it('produces a bcrypt hash starting with $2', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('produces different hashes for the same password (salted)', async () => {
    const hash1 = await hashPassword('same');
    const hash2 = await hashPassword('same');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('returns true for correct bcrypt password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('correct-password', hash);
    expect(result).toBe(true);
  });

  it('returns false for wrong bcrypt password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('works with legacy SHA-256 hash (64 hex chars)', async () => {
    // SHA-256 of "legacy-password"
    const encoder = new TextEncoder();
    const data = encoder.encode('legacy-password');
    const digest = await crypto.subtle.digest('SHA-256', data);
    const sha256Hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(sha256Hash).toHaveLength(64);

    const result = await verifyPassword('legacy-password', sha256Hash);
    expect(result).toBe(true);
  });

  it('returns false for wrong password against SHA-256 hash', async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode('legacy-password');
    const digest = await crypto.subtle.digest('SHA-256', data);
    const sha256Hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const result = await verifyPassword('wrong', sha256Hash);
    expect(result).toBe(false);
  });
});

describe('hasPermission', () => {
  it('superadmin has permission for manager-level', () => {
    expect(hasPermission('superadmin', 'manager')).toBe(true);
  });

  it('superadmin has permission for seller-level', () => {
    expect(hasPermission('superadmin', 'seller')).toBe(true);
  });

  it('manager has permission for seller-level', () => {
    expect(hasPermission('manager', 'seller')).toBe(true);
  });

  it('manager has permission for manager-level', () => {
    expect(hasPermission('manager', 'manager')).toBe(true);
  });

  it('seller does NOT have permission for manager-level', () => {
    expect(hasPermission('seller', 'manager')).toBe(false);
  });

  it('seller does NOT have permission for superadmin-level', () => {
    expect(hasPermission('seller', 'superadmin')).toBe(false);
  });

  it('seller has permission for seller-level', () => {
    expect(hasPermission('seller', 'seller')).toBe(true);
  });
});

describe('canAccessStore', () => {
  const baseUser: User = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'seller',
    store_id: 'store-1',
    created_at: '2024-01-01T00:00:00Z',
  };

  it('superadmin can access any store', () => {
    const admin: User = { ...baseUser, role: 'superadmin', store_id: 'store-1' };
    expect(canAccessStore(admin, 'store-1')).toBe(true);
    expect(canAccessStore(admin, 'store-2')).toBe(true);
    expect(canAccessStore(admin, 'store-xyz')).toBe(true);
  });

  it('seller can only access their own store', () => {
    const seller: User = { ...baseUser, role: 'seller', store_id: 'store-1' };
    expect(canAccessStore(seller, 'store-1')).toBe(true);
    expect(canAccessStore(seller, 'store-2')).toBe(false);
  });

  it('manager can only access their own store', () => {
    const manager: User = { ...baseUser, role: 'manager', store_id: 'store-2' };
    expect(canAccessStore(manager, 'store-2')).toBe(true);
    expect(canAccessStore(manager, 'store-1')).toBe(false);
  });
});

describe('getAuthContext', () => {
  it('extracts headers correctly', () => {
    const headers = new Headers({
      'x-org-id': 'org-1',
      'x-user-id': 'user-1',
      'x-user-store': 'store-1',
      'x-user-role': 'manager',
      'x-request-id': 'req-123',
    });
    const request = new Request('http://localhost/api/test', { headers });

    const ctx = getAuthContext(request);
    expect(ctx.orgId).toBe('org-1');
    expect(ctx.userId).toBe('user-1');
    expect(ctx.storeId).toBe('store-1');
    expect(ctx.role).toBe('manager');
    expect(ctx.requestId).toBe('req-123');
  });

  it('throws on missing userId', () => {
    const headers = new Headers({
      'x-user-role': 'seller',
    });
    const request = new Request('http://localhost/api/test', { headers });

    expect(() => getAuthContext(request)).toThrow('Missing authentication context');
  });

  it('throws on missing role', () => {
    const headers = new Headers({
      'x-user-id': 'user-1',
    });
    const request = new Request('http://localhost/api/test', { headers });

    expect(() => getAuthContext(request)).toThrow('Missing authentication context');
  });
});
