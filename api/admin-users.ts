import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, readJsonBody, requireUser, type UserRole } from './_lib/auth';

const SUPER_ADMIN = 'super_admin';
const ADMIN = 'admin';
const STAFF_ROLES = ['order_fulfillment', 'shipping', 'customer_care', 'promotions'] as const;

const canAssignRole = (actorRole: UserRole, targetRole: string) => {
  if (actorRole === SUPER_ADMIN) {
    return targetRole === ADMIN || STAFF_ROLES.includes(targetRole as (typeof STAFF_ROLES)[number]);
  }
  if (actorRole === ADMIN) {
    return STAFF_ROLES.includes(targetRole as (typeof STAFF_ROLES)[number]);
  }
  return false;
};

const canManageTarget = (actorRole: UserRole, targetRole: string) => {
  if (actorRole === SUPER_ADMIN) {
    return targetRole !== SUPER_ADMIN;
  }
  if (actorRole === ADMIN) {
    return STAFF_ROLES.includes(targetRole as (typeof STAFF_ROLES)[number]);
  }
  return false;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  try {
    const { admin, user, role: actorRole } = await requireUser(req);

    if (![SUPER_ADMIN, ADMIN].includes(actorRole)) {
      return json(res, 403, { error: 'This account does not have staff management privileges.' });
    }

    if (req.method === 'GET') {
      const { data: profiles, error } = await admin
        .from('users')
        .select('id, email, role, disabled, created_at')
        .neq('role', 'customer')
        .order('email', { ascending: true });

      if (error) {
        throw error;
      }

      const users = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
          return {
            uid: profile.id,
            email: authUser?.user?.email || profile.email,
            role: profile.role,
            favorites: [] as string[],
            createdAt: profile.created_at,
            disabled: profile.disabled || Boolean(authUser?.user?.banned_until),
            lastSignInTime: authUser?.user?.last_sign_in_at || null,
            creationTime: authUser?.user?.created_at || null,
          };
        })
      );

      return json(res, 200, { users, requesterRole: actorRole });
    }

    const body = readJsonBody<{
      email?: string;
      password?: string;
      role?: string;
      uid?: string;
      action?: string;
      newPassword?: string;
    }>(req);

    if (req.method === 'POST') {
      const { email, password, role } = body;
      if (!email || !password || !role) {
        return json(res, 400, { error: 'Email, password, and role are required.' });
      }

      if (!canAssignRole(actorRole, role)) {
        return json(res, 403, { error: 'This role cannot be assigned from your current access level.' });
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError || !created.user) {
        throw createError || new Error('Unable to create staff auth user.');
      }

      const { error: profileError } = await admin.from('users').upsert({
        id: created.user.id,
        email,
        role,
        disabled: false,
      });

      if (profileError) {
        throw profileError;
      }

      return json(res, 200, {
        user: {
          uid: created.user.id,
          email,
          role,
          favorites: [],
          disabled: false,
          lastSignInTime: null,
          creationTime: created.user.created_at || null,
        },
        credentials: { email, password },
      });
    }

    if (req.method === 'PATCH') {
      const { uid, action, role, newPassword } = body;
      if (!uid || !action) {
        return json(res, 400, { error: 'A target user and action are required.' });
      }

      if (uid === user.id) {
        return json(res, 400, { error: 'Use your own account settings for self-service changes.' });
      }

      const { data: targetProfile, error: targetError } = await admin
        .from('users')
        .select('id, role, email')
        .eq('id', uid)
        .maybeSingle();

      if (targetError || !targetProfile) {
        return json(res, 404, { error: 'The target user profile could not be found.' });
      }

      if (!canManageTarget(actorRole, targetProfile.role)) {
        return json(res, 403, { error: 'This account cannot be managed from your current access level.' });
      }

      if (action === 'role') {
        if (!role || !canAssignRole(actorRole, role)) {
          return json(res, 403, { error: 'This role change is not allowed.' });
        }
        const { error } = await admin.from('users').update({ role }).eq('id', uid);
        if (error) throw error;
        return json(res, 200, { message: `Role updated to ${String(role).replace('_', ' ')}.` });
      }

      if (action === 'disable' || action === 'enable') {
        const disabled = action === 'disable';
        const { error: authError } = await admin.auth.admin.updateUserById(uid, {
          ban_duration: disabled ? '876000h' : 'none',
        });
        if (authError) throw authError;

        const { error } = await admin.from('users').update({ disabled }).eq('id', uid);
        if (error) throw error;

        return json(res, 200, {
          message: disabled ? 'Account disabled.' : 'Account re-enabled.',
        });
      }

      if (action === 'reset_password') {
        if (!newPassword || String(newPassword).length < 8) {
          return json(res, 400, { error: 'Use a temporary password with at least 8 characters.' });
        }
        const { error } = await admin.auth.admin.updateUserById(uid, { password: newPassword });
        if (error) throw error;
        return json(res, 200, {
          message: 'Temporary password rotated successfully.',
          resetPassword: { newPassword },
        });
      }

      return json(res, 400, { error: 'Unknown action requested.' });
    }

    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return json(res, statusCode, {
      error: error instanceof Error ? error.message : 'Unexpected admin function failure.',
    });
  }
}
