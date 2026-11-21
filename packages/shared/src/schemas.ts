import { z } from 'zod';

import {
  EnvironmentType,
  GlobalRole,
  NotificationChannel,
  NotificationEventType,
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
  ProjectRole,
  RegistrationStatus,
} from './enums';

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const globalRoleSchema = z.nativeEnum(GlobalRole);
export const projectRoleSchema = z.nativeEnum(ProjectRole);
export const registrationStatusSchema = z.nativeEnum(RegistrationStatus);
export const occurrencePrioritySchema = z.nativeEnum(OccurrencePriority);
export const occurrenceStatusSchema = z.nativeEnum(OccurrenceStatus);
export const occurrenceCategorySchema = z.nativeEnum(OccurrenceCategory);
export const environmentTypeSchema = z.nativeEnum(EnvironmentType);
export const notificationChannelSchema = z.nativeEnum(NotificationChannel);
export const notificationEventTypeSchema = z.nativeEnum(NotificationEventType);

/* -------------------------------------------------------------------------- */
/* Comuns                                                                      */
/* -------------------------------------------------------------------------- */

export const idSchema = z.string().min(1, 'Identificador obrigatório.');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().min(1).optional(),
});

/* -------------------------------------------------------------------------- */
/* Autenticação e usuários                                                     */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório.').max(160),
  email: z.string().email('E-mail inválido.'),
  globalRole: globalRoleSchema.optional(),
  status: registrationStatusSchema.default(RegistrationStatus.ATIVO),
});

export const updateUserSchema = createUserSchema.partial().omit({ globalRole: true });

/* -------------------------------------------------------------------------- */
/* Projetos                                                                    */
/* -------------------------------------------------------------------------- */

export const projectCodeSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use apenas letras maiúsculas, números e hífen (ex.: INTRANET-MARICA).');

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório.').max(160),
  code: projectCodeSchema,
  description: z.string().max(2000).optional(),
  status: registrationStatusSchema.default(RegistrationStatus.ATIVO),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createProjectMemberSchema = z.object({
  userId: idSchema,
  role: projectRoleSchema,
  status: registrationStatusSchema.default(RegistrationStatus.ATIVO),
});

export const createProjectEnvironmentSchema = z.object({
  name: z.string().min(1).max(120),
  baseUrl: z.string().url('URL inválida.'),
  type: environmentTypeSchema,
  status: registrationStatusSchema.default(RegistrationStatus.ATIVO),
});

/* -------------------------------------------------------------------------- */
/* Ocorrências                                                                 */
/* -------------------------------------------------------------------------- */

export const createOccurrenceSchema = z.object({
  projectId: idSchema,
  environmentId: idSchema.optional(),
  title: z.string().min(1, 'Título obrigatório.').max(200),
  description: z.string().max(20_000).optional(),
  categoryId: occurrenceCategorySchema,
  priority: occurrencePrioritySchema,
  pageUrl: z.string().url().optional(),
  pageTitle: z.string().max(300).optional(),
  browserInfo: z.string().max(300).optional(),
  operatingSystemInfo: z.string().max(300).optional(),
  viewportInfo: z.string().max(120).optional(),
  attachmentIds: z.array(idSchema).optional(),
});
// Observação: `reporterUserId` NÃO é aceito aqui — a autoria é atribuída pelo
// servidor a partir da sessão autenticada (seção 3.3 da especificação).

export const changeOccurrenceStatusSchema = z.object({
  status: occurrenceStatusSchema,
  justification: z.string().max(2000).optional(),
});

export const occurrenceFilterSchema = paginationQuerySchema.extend({
  projectId: idSchema,
  environmentId: idSchema.optional(),
  categoryId: occurrenceCategorySchema.optional(),
  priority: occurrencePrioritySchema.optional(),
  status: occurrenceStatusSchema.optional(),
  assigneeUserId: idSchema.optional(),
  reporterUserId: idSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().max(200).optional(),
});

/* -------------------------------------------------------------------------- */
/* Notificações                                                                */
/* -------------------------------------------------------------------------- */

export const notificationJobPayloadSchema = z.object({
  // Ausente no reprocessamento administrativo (destino já informado).
  eventType: notificationEventTypeSchema.optional(),
  occurrenceId: idSchema,
  projectId: idSchema,
  destinationId: idSchema.optional(),
  idempotencyKey: z.string().min(1).optional(),
});

/* -------------------------------------------------------------------------- */
/* Tipos inferidos                                                             */
/* -------------------------------------------------------------------------- */

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateProjectMemberInput = z.infer<typeof createProjectMemberSchema>;
export type CreateProjectEnvironmentInput = z.infer<typeof createProjectEnvironmentSchema>;
export type CreateOccurrenceInput = z.infer<typeof createOccurrenceSchema>;
export type ChangeOccurrenceStatusInput = z.infer<typeof changeOccurrenceStatusSchema>;
export type OccurrenceFilterQuery = z.infer<typeof occurrenceFilterSchema>;
export type NotificationJobPayloadInput = z.infer<typeof notificationJobPayloadSchema>;
