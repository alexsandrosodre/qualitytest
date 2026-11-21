'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import { AiSuggestionType, GlobalRole, OccurrenceCategory, OccurrencePriority, ProjectRole } from '@qualitytest/shared';

import {
  Button,
  Card,
  CategoryBadge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FullPageSpinner,
  PriorityBadge,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from '@/components';
import { apiDelete, apiGet, apiPatch, apiPost, describeApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import {
  OCCURRENCE_CATEGORY_LABELS,
  OCCURRENCE_PRIORITY_LABELS,
  OCCURRENCE_STATUS_LABELS,
  formatBytes,
  formatDateTime,
  historyActionLabel,
} from '@/lib/format';
import { OCCURRENCE_PERMISSIONS, allowedTransitions, isRoleAllowed } from '@/lib/occurrence-rules';
import type {
  AiAnalysesResult,
  AiSuggestionView,
  AttachmentDownloadView,
  AttachmentUploadView,
  OccurrenceCommentView,
  OccurrenceDetailView,
  OccurrenceHistoryView,
  ProjectMemberListItem,
} from '@/lib/types';

/** Rótulo exibido para cada tipo de sugestão de IA. */
const AI_SUGGESTION_LABELS: Record<AiSuggestionType, string> = {
  [AiSuggestionType.RESUMO]: 'Resumo sugerido',
  [AiSuggestionType.CATEGORIA]: 'Categoria sugerida',
  [AiSuggestionType.PRIORIDADE]: 'Prioridade sugerida',
  [AiSuggestionType.DUPLICIDADE]: 'Possível duplicidade',
};

export default function OccurrenceDetailPage() {
  const params = useParams<{ occurrenceId: string }>();
  const occurrenceId = params.occurrenceId;
  const router = useRouter();
  const toast = useToast();
  const { user, memberships } = useAuth();

  const [busy, setBusy] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [statusTarget, setStatusTarget] = useState('');
  const [justification, setJustification] = useState('');
  const [confirm, setConfirm] = useState<{ message: string; action: () => Promise<void> } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const occurrenceQuery = useQuery({
    queryKey: ['occurrence', occurrenceId],
    queryFn: () => apiGet<OccurrenceDetailView>(`/occurrences/${occurrenceId}`),
  });

  const occurrence = occurrenceQuery.data;
  const projectId = occurrence?.projectId ?? null;

  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    enabled: projectId !== null,
    queryFn: () => apiGet<ProjectMemberListItem[]>(`/projects/${projectId}/members`),
  });

  const aiQuery = useQuery({
    queryKey: ['occurrence-ai', occurrenceId],
    queryFn: () => apiGet<AiAnalysesResult>(`/occurrences/${occurrenceId}/ai-analyses`),
  });

  const isAdmin = user?.globalRole === GlobalRole.ADMINISTRADOR;
  const membershipRole = useMemo<ProjectRole | null>(
    () =>
      projectId === null
        ? null
        : (memberships.find((membership) => membership.projectId === projectId)?.role ?? null),
    [memberships, projectId],
  );
  const actorRole = isAdmin ? null : membershipRole;

  const refetchOccurrence = occurrenceQuery.refetch;

  const run = async (action: () => Promise<void>, successMessage: string): Promise<void> => {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      await refetchOccurrence();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  };

  if (occurrenceQuery.isLoading) {
    return <FullPageSpinner label="Carregando ocorrência..." />;
  }

  if (occurrenceQuery.isError || occurrence === undefined) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          message={describeApiError(occurrenceQuery.error)}
          onRetry={() => {
            void refetchOccurrence();
          }}
        />
      </div>
    );
  }

  const transitions = allowedTransitions(occurrence.status, actorRole);
  const canAssign = isRoleAllowed(actorRole, OCCURRENCE_PERMISSIONS.assign);
  const canComment = isRoleAllowed(actorRole, OCCURRENCE_PERMISSIONS.comment);
  const canAttach = isRoleAllowed(actorRole, OCCURRENCE_PERMISSIONS.attach);
  const canEditCategory = isRoleAllowed(actorRole, OCCURRENCE_PERMISSIONS.edit);
  const canEditPriority = isRoleAllowed(actorRole, OCCURRENCE_PERMISSIONS.editPriority);

  const activeMembers = (membersQuery.data ?? []).filter((member) => member.status === 'ATIVO');

  const canModifyComment = (comment: OccurrenceCommentView): boolean =>
    comment.userId === user?.id || isAdmin || membershipRole === ProjectRole.GESTOR;

  const handleAddComment = async (): Promise<void> => {
    if (newComment.trim() === '') {
      return;
    }
    await run(async () => {
      await apiPost(`/occurrences/${occurrenceId}/comments`, { content: newComment.trim() });
      setNewComment('');
    }, 'Comentário adicionado.');
  };

  const handleSaveComment = async (commentId: string): Promise<void> => {
    await run(async () => {
      await apiPatch(`/occurrences/${occurrenceId}/comments/${commentId}`, {
        content: editingCommentText.trim(),
      });
      setEditingCommentId(null);
      setEditingCommentText('');
    }, 'Comentário atualizado.');
  };

  const handleAssign = async (): Promise<void> => {
    if (assigneeUserId === '') {
      return;
    }
    await run(
      () => apiPatch(`/occurrences/${occurrenceId}/assignee`, { assigneeUserId }).then(() => undefined),
      'Responsável atualizado.',
    );
  };

  const selectedRule = transitions.find((rule) => rule.to === statusTarget);

  const handleChangeStatus = async (): Promise<void> => {
    if (statusTarget === '') {
      return;
    }
    await run(async () => {
      await apiPatch(`/occurrences/${occurrenceId}/status`, {
        status: statusTarget,
        justification:
          selectedRule?.requiresJustification === true && justification.trim() !== ''
            ? justification.trim()
            : undefined,
      });
      setStatusTarget('');
      setJustification('');
    }, 'Status atualizado.');
  };

  const handleUpload = async (file: File): Promise<void> => {
    await run(async () => {
      const upload = await apiPost<AttachmentUploadView>(`/occurrences/${occurrenceId}/attachments`, {
        fileName: file.name,
        mimeType: file.type === '' ? 'application/octet-stream' : file.type,
        size: file.size,
      });

      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type === '' ? 'application/octet-stream' : file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar o arquivo para o armazenamento.');
      }
    }, 'Anexo enviado.');
    if (fileInputRef.current !== null) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (attachmentId: string): Promise<void> => {
    try {
      const result = await apiGet<AttachmentDownloadView>(
        `/occurrences/${occurrenceId}/attachments/${attachmentId}/url`,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(describeApiError(error));
    }
  };

  const aiResult = aiQuery.data;
  const latestAiAnalysis = aiResult?.items[0] ?? null;

  /** Gera novas sugestões (não altera a ocorrência; apenas registra a análise). */
  const handleGenerateAi = async (): Promise<void> => {
    setBusy(true);
    try {
      await apiPost(`/occurrences/${occurrenceId}/ai-analyses`);
      toast.success('Sugestões de IA geradas.');
      await aiQuery.refetch();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  };

  /** Texto legível de uma sugestão (traduz valores de enum quando aplicável). */
  const suggestionLabel = (suggestion: AiSuggestionView): string => {
    if (suggestion.type === AiSuggestionType.CATEGORIA) {
      return OCCURRENCE_CATEGORY_LABELS[suggestion.value as OccurrenceCategory];
    }
    if (suggestion.type === AiSuggestionType.PRIORIDADE) {
      return OCCURRENCE_PRIORITY_LABELS[suggestion.value as OccurrencePriority];
    }
    return suggestion.value;
  };

  /** Aplica a categoria sugerida — sempre mediante confirmação humana. */
  const applySuggestedCategory = (category: OccurrenceCategory): void => {
    setConfirm({
      message: `Aplicar a categoria sugerida "${OCCURRENCE_CATEGORY_LABELS[category]}"? A sugestão é assistiva e a alteração será registrada no histórico.`,
      action: () =>
        apiPatch(`/occurrences/${occurrenceId}`, { categoryId: category }).then(() => undefined),
    });
  };

  /** Aplica a prioridade sugerida — sempre mediante confirmação humana. */
  const applySuggestedPriority = (priority: OccurrencePriority): void => {
    setConfirm({
      message: `Aplicar a prioridade sugerida "${OCCURRENCE_PRIORITY_LABELS[priority]}"? A sugestão é assistiva e a alteração será registrada no histórico.`,
      action: () => apiPatch(`/occurrences/${occurrenceId}`, { priority }).then(() => undefined),
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-sm text-sky-600 hover:underline"
            onClick={() => router.push('/occurrences')}
          >
            ← Voltar para ocorrências
          </button>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{occurrence.title}</h1>
          <p className="font-mono text-xs text-slate-500">{occurrence.publicCode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={occurrence.status} />
          <PriorityBadge priority={occurrence.priority} />
          <CategoryBadge category={occurrence.categoryId} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Descrição">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {occurrence.description ?? 'Sem descrição informada.'}
            </p>
          </Card>

          <Card title="Detalhes">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Autor</dt>
                <dd className="text-slate-800">{occurrence.reporter?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Responsável</dt>
                <dd className="text-slate-800">{occurrence.assignee?.name ?? 'Não atribuído'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Ambiente</dt>
                <dd className="text-slate-800">{occurrence.environment?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Criada em</dt>
                <dd className="text-slate-800">{formatDateTime(occurrence.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Página</dt>
                <dd className="truncate text-slate-800">
                  {occurrence.pageUrl ?? '—'}
                  {occurrence.pageTitle !== null ? ` (${occurrence.pageTitle})` : ''}
                </dd>
              </div>
              {occurrence.browserInfo !== null || occurrence.operatingSystemInfo !== null || occurrence.viewportInfo !== null ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Contexto</dt>
                  <dd className="text-slate-800">
                    {[occurrence.browserInfo, occurrence.operatingSystemInfo, occurrence.viewportInfo]
                      .filter((value): value is string => value !== null)
                      .join(' · ') || '—'}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="Anexos" description="Evidências enviadas para a ocorrência." bodyClassName="space-y-4">
            {canAttach ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file !== undefined) {
                      void handleUpload(file);
                    }
                  }}
                  className="block text-sm text-slate-600"
                />
              </div>
            ) : null}

            {occurrence.attachments.length === 0 ? (
              <EmptyState title="Nenhum anexo" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {occurrence.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {attachment.fileName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatBytes(attachment.size)} · {formatDateTime(attachment.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void handleDownload(attachment.id);
                        }}
                      >
                        Baixar
                      </Button>
                      {canAttach ? (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              message: `Remover o anexo "${attachment.fileName}"?`,
                              action: () =>
                                apiDelete(
                                  `/occurrences/${occurrenceId}/attachments/${attachment.id}`,
                                ).then(() => undefined),
                            })
                          }
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Comentários" bodyClassName="space-y-4">
            {canComment ? (
              <div className="space-y-2">
                <Field label="Novo comentário" htmlFor="new-comment">
                  <Textarea
                    id="new-comment"
                    rows={3}
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                  />
                </Field>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={busy || newComment.trim() === ''}
                    onClick={() => {
                      void handleAddComment();
                    }}
                  >
                    Comentar
                  </Button>
                </div>
              </div>
            ) : null}

            {occurrence.comments.length === 0 ? (
              <EmptyState title="Nenhum comentário" />
            ) : (
              <ul className="space-y-4">
                {occurrence.comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {comment.author?.name ?? 'Usuário'}
                        </p>
                        <p className="text-xs text-slate-500">{formatDateTime(comment.createdAt)}</p>
                      </div>
                      {canModifyComment(comment) ? (
                        <div className="flex gap-2">
                          {editingCommentId === comment.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText('');
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy || editingCommentText.trim() === ''}
                                onClick={() => {
                                  void handleSaveComment(comment.id);
                                }}
                              >
                                Salvar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditingCommentText(comment.content);
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    message: 'Remover este comentário?',
                                    action: () =>
                                      apiDelete(
                                        `/occurrences/${occurrenceId}/comments/${comment.id}`,
                                      ).then(() => undefined),
                                  })
                                }
                              >
                                Remover
                              </Button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2">
                      {editingCommentId === comment.id ? (
                        <Textarea
                          rows={3}
                          value={editingCommentText}
                          onChange={(event) => setEditingCommentText(event.target.value)}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Ações" bodyClassName="space-y-4">
            {canAssign ? (
              <Field label="Responsável" htmlFor="assignee">
                <div className="flex gap-2">
                  <Select
                    id="assignee"
                    value={assigneeUserId}
                    onChange={(event) => setAssigneeUserId(event.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {activeMembers.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.userName}
                      </option>
                    ))}
                  </Select>
                  <Button
                    disabled={busy || assigneeUserId === ''}
                    onClick={() => {
                      void handleAssign();
                    }}
                  >
                    Atribuir
                  </Button>
                </div>
              </Field>
            ) : (
              <p className="text-sm text-slate-500">
                A atribuição de responsável é restrita a gestores.
              </p>
            )}

            <div className="border-t border-slate-100 pt-4">
              <Field label="Alterar status" htmlFor="status">
                <Select
                  id="status"
                  value={statusTarget}
                  onChange={(event) => {
                    setStatusTarget(event.target.value);
                    setJustification('');
                  }}
                >
                  <option value="">
                    {transitions.length === 0 ? 'Sem transições disponíveis' : 'Selecione...'}
                  </option>
                  {transitions.map((rule) => (
                    <option key={rule.to} value={rule.to}>
                      {OCCURRENCE_STATUS_LABELS[rule.to]}
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedRule?.requiresJustification === true ? (
                <div className="mt-3">
                  <Field label="Justificativa" htmlFor="justification" required>
                    <Textarea
                      id="justification"
                      rows={3}
                      value={justification}
                      onChange={(event) => setJustification(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              <div className="mt-3 flex justify-end">
                <Button
                  disabled={
                    busy ||
                    statusTarget === '' ||
                    (selectedRule?.requiresJustification === true && justification.trim() === '')
                  }
                  onClick={() => {
                    void handleChangeStatus();
                  }}
                >
                  Aplicar status
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Sugestões de IA"
            description="Assistivas — nada é alterado sem a sua confirmação."
            bodyClassName="space-y-4"
          >
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Conteúdo gerado por IA ({aiResult?.provider ?? '—'} · {aiResult?.model ?? '—'}). Revise
              com atenção antes de aplicar.
            </p>

            {aiQuery.isLoading ? (
              <p className="text-sm text-slate-500">Carregando sugestões...</p>
            ) : aiQuery.isError ? (
              <p className="text-sm text-slate-500">{describeApiError(aiQuery.error)}</p>
            ) : aiResult === undefined || !aiResult.enabled ? (
              <p className="text-sm text-slate-500">
                O módulo de IA está desativado neste ambiente.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void handleGenerateAi();
                    }}
                  >
                    Gerar sugestões
                  </Button>
                </div>

                {latestAiAnalysis === null || latestAiAnalysis.suggestions.length === 0 ? (
                  <EmptyState
                    title="Nenhuma sugestão"
                    description="Gere sugestões para esta ocorrência."
                  />
                ) : (
                  <ul className="space-y-3">
                    {latestAiAnalysis.suggestions.map((suggestion, index) => (
                      <li
                        key={`${suggestion.type}-${index}`}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {AI_SUGGESTION_LABELS[suggestion.type]}
                          </span>
                          <span className="text-xs text-slate-500">
                            confiança {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-800">{suggestionLabel(suggestion)}</p>
                        {suggestion.rationale !== null ? (
                          <p className="mt-1 text-xs text-slate-500">{suggestion.rationale}</p>
                        ) : null}

                        {suggestion.type === AiSuggestionType.CATEGORIA && canEditCategory ? (
                          <div className="mt-2 flex justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                applySuggestedCategory(suggestion.value as OccurrenceCategory);
                              }}
                            >
                              Aplicar categoria
                            </Button>
                          </div>
                        ) : null}

                        {suggestion.type === AiSuggestionType.PRIORIDADE && canEditPriority ? (
                          <div className="mt-2 flex justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                applySuggestedPriority(suggestion.value as OccurrencePriority);
                              }}
                            >
                              Aplicar prioridade
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>

          <Card title="Histórico">
            {occurrence.history.length === 0 ? (
              <EmptyState title="Sem histórico" />
            ) : (
              <ol className="space-y-3">
                {occurrence.history.map((entry: OccurrenceHistoryView) => (
                  <li key={entry.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="text-sm font-medium text-slate-800">
                      {historyActionLabel(entry.action)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.actor?.name ?? 'Sistema'} · {formatDateTime(entry.createdAt)}
                    </p>
                    {entry.previousValue !== null || entry.newValue !== null ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {entry.previousValue ?? '—'} → {entry.newValue ?? '—'}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title="Confirmar ação"
        description={confirm?.message ?? ''}
        confirmLabel="Confirmar"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const current = confirm;
          setConfirm(null);
          if (current !== null) {
            void run(current.action, 'Ação concluída.');
          }
        }}
      />

      <div className="sr-only" aria-live="polite">
        {busy ? 'Processando...' : ''}
      </div>
    </div>
  );
}
