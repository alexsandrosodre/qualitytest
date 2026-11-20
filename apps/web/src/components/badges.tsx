'use client';

import {
  EnvironmentType,
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
  ProjectRole,
  RegistrationStatus,
} from '@qualitytest/shared';

import {
  ENVIRONMENT_TYPE_LABELS,
  OCCURRENCE_CATEGORY_LABELS,
  OCCURRENCE_PRIORITY_LABELS,
  OCCURRENCE_STATUS_LABELS,
  PROJECT_ROLE_LABELS,
  REGISTRATION_STATUS_LABELS,
} from '@/lib/format';

import { Badge, type BadgeTone } from './Badge';

const STATUS_TONES: Record<OccurrenceStatus, BadgeTone> = {
  [OccurrenceStatus.ABERTO]: 'info',
  [OccurrenceStatus.EM_ANALISE]: 'purple',
  [OccurrenceStatus.EM_DESENVOLVIMENTO]: 'warning',
  [OccurrenceStatus.AGUARDANDO_HOMOLOGACAO]: 'info',
  [OccurrenceStatus.REPROVADO_HOMOLOGACAO]: 'danger',
  [OccurrenceStatus.CONCLUIDO]: 'success',
  [OccurrenceStatus.CANCELADO]: 'muted',
};

const PRIORITY_TONES: Record<OccurrencePriority, BadgeTone> = {
  [OccurrencePriority.CRITICA]: 'danger',
  [OccurrencePriority.ALTA]: 'warning',
  [OccurrencePriority.MEDIA]: 'info',
  [OccurrencePriority.BAIXA]: 'neutral',
};

export function StatusBadge({ status }: { status: OccurrenceStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{OCCURRENCE_STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: OccurrencePriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{OCCURRENCE_PRIORITY_LABELS[priority]}</Badge>;
}

export function CategoryBadge({ category }: { category: OccurrenceCategory }) {
  return <Badge tone="neutral">{OCCURRENCE_CATEGORY_LABELS[category]}</Badge>;
}

export function RoleBadge({ role }: { role: ProjectRole }) {
  return <Badge tone="purple">{PROJECT_ROLE_LABELS[role]}</Badge>;
}

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <Badge tone={status === RegistrationStatus.ATIVO ? 'success' : 'muted'}>
      {REGISTRATION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function EnvironmentTypeBadge({ type }: { type: EnvironmentType }) {
  return <Badge tone="info">{ENVIRONMENT_TYPE_LABELS[type]}</Badge>;
}
