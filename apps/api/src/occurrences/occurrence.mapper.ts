import type {
  Occurrence,
  OccurrenceAttachment,
  OccurrenceCategory,
  OccurrenceComment,
  OccurrenceHistory,
  OccurrencePriority,
  OccurrenceStatus,
} from '@prisma/client';

/** Referência mínima de usuário exibida nas views de ocorrência. */
export interface UserRef {
  id: string;
  name: string;
}

/** Referência mínima de projeto. */
export interface ProjectRef {
  id: string;
  name: string;
  code: string;
}

/** Referência mínima de ambiente. */
export interface EnvironmentRef {
  id: string;
  name: string;
}

/** Visão resumida (listagem). */
export interface OccurrenceSummaryView {
  id: string;
  publicCode: string;
  projectId: string;
  environmentId: string | null;
  title: string;
  categoryId: OccurrenceCategory;
  priority: OccurrencePriority;
  status: OccurrenceStatus;
  reporterUserId: string;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Visão de comentário. */
export interface OccurrenceCommentView {
  id: string;
  occurrenceId: string;
  userId: string;
  author: UserRef | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** Visão de anexo (sem expor credenciais de storage). */
export interface OccurrenceAttachmentView {
  id: string;
  occurrenceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: string;
}

/** Visão de histórico. */
export interface OccurrenceHistoryView {
  id: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  actorUserId: string;
  actor: UserRef | null;
  createdAt: string;
}

/** Visão completa (detalhe), com relacionamentos resolvidos. */
export interface OccurrenceDetailView extends OccurrenceSummaryView {
  description: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  browserInfo: string | null;
  operatingSystemInfo: string | null;
  viewportInfo: string | null;
  reporter: UserRef | null;
  assignee: UserRef | null;
  project: ProjectRef | null;
  environment: EnvironmentRef | null;
  attachments: OccurrenceAttachmentView[];
  comments: OccurrenceCommentView[];
  history: OccurrenceHistoryView[];
}

export function toOccurrenceSummaryView(occurrence: Occurrence): OccurrenceSummaryView {
  return {
    id: occurrence.id,
    publicCode: occurrence.publicCode,
    projectId: occurrence.projectId,
    environmentId: occurrence.environmentId,
    title: occurrence.title,
    categoryId: occurrence.categoryId,
    priority: occurrence.priority,
    status: occurrence.status,
    reporterUserId: occurrence.reporterUserId,
    assigneeUserId: occurrence.assigneeUserId,
    createdAt: occurrence.createdAt.toISOString(),
    updatedAt: occurrence.updatedAt.toISOString(),
  };
}

export function toOccurrenceCommentView(
  comment: OccurrenceComment,
  author: UserRef | null,
): OccurrenceCommentView {
  return {
    id: comment.id,
    occurrenceId: comment.occurrenceId,
    userId: comment.userId,
    author,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export function toOccurrenceAttachmentView(
  attachment: OccurrenceAttachment,
): OccurrenceAttachmentView {
  return {
    id: attachment.id,
    occurrenceId: attachment.occurrenceId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    storageKey: attachment.storageKey,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function toOccurrenceHistoryView(
  entry: OccurrenceHistory,
  actor: UserRef | null,
): OccurrenceHistoryView {
  return {
    id: entry.id,
    action: entry.action,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    actorUserId: entry.actorUserId,
    actor,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toOccurrenceDetailView(input: {
  occurrence: Occurrence;
  reporter: UserRef | null;
  assignee: UserRef | null;
  project: ProjectRef | null;
  environment: EnvironmentRef | null;
  attachments: OccurrenceAttachmentView[];
  comments: OccurrenceCommentView[];
  history: OccurrenceHistoryView[];
}): OccurrenceDetailView {
  const { occurrence } = input;
  return {
    ...toOccurrenceSummaryView(occurrence),
    description: occurrence.description,
    pageUrl: occurrence.pageUrl,
    pageTitle: occurrence.pageTitle,
    browserInfo: occurrence.browserInfo,
    operatingSystemInfo: occurrence.operatingSystemInfo,
    viewportInfo: occurrence.viewportInfo,
    reporter: input.reporter,
    assignee: input.assignee,
    project: input.project,
    environment: input.environment,
    attachments: input.attachments,
    comments: input.comments,
    history: input.history,
  };
}
