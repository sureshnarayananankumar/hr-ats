import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleName, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUDIT_ACTIONS } from '../../common/constants';
import {
  generateToken,
  hashPassword,
  hashToken,
  validatePasswordStrength,
} from '../../common/utils/crypto.util';
import { normaliseEmail } from '../../common/utils/codes.util';
import { buildPage, safeSort, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ROLE_PERMISSIONS } from '../../common/auth/permissions';
import type { AuthenticatedUser } from '../../common/auth/decorators';

/** Users, roles, departments, sources and system settings. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ===================================================================
  //  Users
  // ===================================================================

  async listUsers(query: PaginationQueryDto & { role?: RoleName; status?: UserStatus }) {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { email: { contains: query.search } },
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.role) where.userRoles = { some: { role: { name: query.role } } };

    const sortBy = safeSort(query.sortBy, ['createdAt', 'email', 'lastLoginAt'], 'createdAt');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { [sortBy]: query.sortDir },
        skip: query.skip,
        take: query.take,
        // Note the explicit select: passwordHash, mfaSecret and
        // recovery codes must never leave the server.
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          mfaEnabled: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: { include: { role: { select: { name: true, label: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = rows.map((row) => ({
      ...row,
      roles: row.userRoles.map((link) => link.role.name),
      userRoles: undefined,
    }));

    return buildPage(data, total, query);
  }

  async createUser(
    input: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      roles: RoleName[];
      temporaryPassword: string;
    },
    actor: AuthenticatedUser,
    ip: string,
  ) {
    const email = normaliseEmail(input.email);

    const strengthErrors = validatePasswordStrength(input.temporaryPassword);
    if (strengthErrors.length > 0) {
      throw new BadRequestException({ message: strengthErrors, error: 'Weak Password' });
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('A user with that email already exists');

    if (input.roles.length === 0) {
      throw new BadRequestException('At least one role must be assigned');
    }

    // Only a Super Admin may mint another Super Admin.
    if (input.roles.includes(RoleName.SUPER_ADMIN) && !actor.roles.includes(RoleName.SUPER_ADMIN)) {
      throw new ForbiddenException('Only a Super Admin can create another Super Admin');
    }

    const roles = await this.prisma.role.findMany({ where: { name: { in: input.roles } } });
    if (roles.length !== input.roles.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    const passwordHash = await hashPassword(input.temporaryPassword);

    const { user, token } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone?.trim(),
          status: UserStatus.PENDING_VERIFICATION,
          userRoles: { create: roles.map((role) => ({ roleId: role.id, assignedBy: actor.userId })) },
        },
      });

      const rawToken = generateToken();
      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return { user: created, token: rawToken };
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.USER_CREATED,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      entityType: 'User',
      entityId: user.id,
      // The temporary password is never recorded.
      metadata: { email, roles: input.roles },
      ipAddress: ip,
      severity: 'WARN',
    });

    await this.notifications.queueTemplate('account.invited', user.email, {
      firstName: user.firstName,
      verifyToken: token,
    });

    return { id: user.id, email: user.email, status: user.status };
  }

  async setUserRoles(userId: string, roleNames: RoleName[], actor: AuthenticatedUser, ip: string) {
    if (userId === actor.userId) {
      throw new BadRequestException('You cannot change your own roles');
    }
    if (roleNames.includes(RoleName.SUPER_ADMIN) && !actor.roles.includes(RoleName.SUPER_ADMIN)) {
      throw new ForbiddenException('Only a Super Admin can grant the Super Admin role');
    }

    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } } });
    if (roles.length !== roleNames.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id, assignedBy: actor.userId })),
      }),
      // Permissions are baked into the access token, so existing
      // sessions must be revoked for the change to take effect.
      this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ROLES_CHANGED' },
      }),
    ]);

    await this.audit.log({
      action: AUDIT_ACTIONS.ROLE_ASSIGNED,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      entityType: 'User',
      entityId: userId,
      metadata: { roles: roleNames },
      ipAddress: ip,
      severity: 'WARN',
    });

    return { message: 'Roles updated. The user must sign in again.' };
  }

  async setUserStatus(
    userId: string,
    status: UserStatus,
    actor: AuthenticatedUser,
    ip: string,
  ) {
    if (userId === actor.userId) {
      throw new BadRequestException('You cannot change your own account status');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found');

    const targetIsSuperAdmin = target.userRoles.some(
      (link) => link.role.name === RoleName.SUPER_ADMIN,
    );
    if (targetIsSuperAdmin && !actor.roles.includes(RoleName.SUPER_ADMIN)) {
      throw new ForbiddenException('Only a Super Admin can modify another Super Admin');
    }

    // Never allow the last active Super Admin to be locked out.
    if (targetIsSuperAdmin && status !== UserStatus.ACTIVE) {
      const remaining = await this.prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          id: { not: userId },
          userRoles: { some: { role: { name: RoleName.SUPER_ADMIN } } },
        },
      });
      if (remaining === 0) {
        throw new BadRequestException(
          'This is the last active Super Admin; promote another before deactivating.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status,
          ...(status === UserStatus.DEACTIVATED ? { deactivatedAt: new Date() } : {}),
        },
      }),
      ...(status !== UserStatus.ACTIVE
        ? [
            this.prisma.refreshSession.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date(), revokedReason: `STATUS_${status}` },
            }),
          ]
        : []),
    ]);

    await this.audit.log({
      action: 'USER_STATUS_CHANGED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      entityType: 'User',
      entityId: userId,
      metadata: { from: target.status, to: status },
      ipAddress: ip,
      severity: 'WARN',
    });

    return { message: `User status set to ${status}` };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      label: role.label,
      description: role.description,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((link) => link.permission.key),
    }));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  /** Lightweight directory for assignment dropdowns. */
  async assignableUsers(role?: RoleName) {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        ...(role ? { userRoles: { some: { role: { name: role } } } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
      orderBy: { firstName: 'asc' },
      take: 500,
    });

    return users.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      roles: user.userRoles.map((link) => link.role.name),
    }));
  }

  // ===================================================================
  //  Departments
  // ===================================================================

  async listDepartments(includeInactive = false) {
    return this.prisma.department.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        head: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { jobRequirements: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(
    input: { code: string; name: string; description?: string; headUserId?: string },
    actor: AuthenticatedUser,
  ) {
    return this.prisma.department.create({
      data: {
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description,
        headUserId: input.headUserId,
      },
    });
  }

  async updateDepartment(
    id: string,
    input: { name?: string; description?: string; headUserId?: string | null; isActive?: boolean },
  ) {
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.headUserId !== undefined ? { headUserId: input.headUserId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  // ===================================================================
  //  Recruitment sources
  // ===================================================================

  async listSources() {
    return this.prisma.recruitmentSource.findMany({
      include: { _count: { select: { applications: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSource(input: { name: string; category?: string; costPerMonth?: number }) {
    return this.prisma.recruitmentSource.create({
      data: {
        name: input.name.trim(),
        category: input.category,
        costPerMonth: input.costPerMonth,
      },
    });
  }

  // ===================================================================
  //  System settings
  // ===================================================================

  async listSettings() {
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Secret settings are listed but their values are withheld.
    return settings.map((setting) => ({
      ...setting,
      value: setting.isSecret ? '********' : setting.value,
    }));
  }

  async updateSetting(key: string, value: string, actor: AuthenticatedUser, ip: string) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Setting not found');

    const updated = await this.prisma.systemSetting.update({
      where: { key },
      data: { value, updatedById: actor.userId },
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      entityType: 'SystemSetting',
      entityId: key,
      // A secret's old/new values are never written to the audit log.
      metadata: existing.isSecret
        ? { key, changed: true }
        : { key, from: existing.value, to: value },
      ipAddress: ip,
      severity: 'WARN',
    });

    return { ...updated, value: updated.isSecret ? '********' : updated.value };
  }
}
