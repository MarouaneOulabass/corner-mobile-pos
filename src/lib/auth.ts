import { createServiceClient } from './supabase';
import { User, UserRole } from '@/types';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

const JWT_EXPIRY = '8h';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support legacy SHA-256 hashes (64 hex chars) for migration
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const legacyHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    return legacyHash === hash;
  }
  return bcrypt.compare(password, hash);
}

export async function createToken(user: User, jti?: string): Promise<string> {
  const claims: Record<string, unknown> = {
    sub: user.id,
    aud: 'authenticated', // required for Supabase RLS to recognize authenticated role
    email: user.email,
    name: user.name,
    role: user.role,
    store_id: user.store_id,
  };

  if (jti) {
    claims.jti = jti;
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<{
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  store_id: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as {
      sub: string;
      email: string;
      name: string;
      role: UserRole;
      store_id: string;
    };
  } catch {
    return null;
  }
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('users')
    .select('*, store:stores(*)')
    .eq('email', email)
    .single();

  if (error || !data) return null;

  const valid = await verifyPassword(password, data.password_hash);
  if (!valid) return null;

  // Migrate legacy SHA-256 hash to bcrypt on successful login
  if (data.password_hash.length === 64 && /^[a-f0-9]+$/.test(data.password_hash)) {
    const newHash = await hashPassword(password);
    await supabase.from('users').update({ password_hash: newHash }).eq('id', data.id);
  }

  return data as User;
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('users')
    .select('*, store:stores(*)')
    .eq('id', payload.sub)
    .single();

  if (error || !data) return null;
  return data as User;
}

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    superadmin: 3,
    manager: 2,
    seller: 1,
  };
  return hierarchy[userRole] >= hierarchy[requiredRole];
}

export function canAccessStore(user: User, storeId: string): boolean {
  if (user.role === 'superadmin') return true;
  return user.store_id === storeId;
}
