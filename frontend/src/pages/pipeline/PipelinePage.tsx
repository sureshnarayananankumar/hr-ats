import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { AlertTriangle, CalendarClock, GripVertical } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDate, isValidStageTransition, STAGE_LABELS } from '@/lib/utils';
import type { ApplicationStage, JobRequirement, Paginated, PipelineBoard, PipelineCard } from '@/lib/types';
import {
  Alert,
  Card,
  EmptyState,
  Field,
  PageHeader,
  PageLoader,
} from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/feedback';
import styles from './PipelinePage.module.scss';

/** One candidate card. Draggable, and also navigable by keyboard. */
function KanbanCard({ card }: { card: PipelineCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.applicationId,
    data: { card },
  });

  return (
    <li
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
      aria-label={`${card.candidateName}, ${card.applicationCode}`}
    >
      <div className={styles.cardHeader}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Drag ${card.candidateName}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        <Link to={`/applications/${card.applicationId}`} className={styles.cardName}>
          {card.candidateName}
        </Link>
        {card.isOverdue && (
          <span title="Follow-up overdue">
            <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span className="sr-only">Follow-up overdue</span>
          </span>
        )}
      </div>

      <p className={styles.cardCode}>{card.applicationCode}</p>

      <div className={styles.cardMeta}>
        {card.experience && <span>{Number(card.experience).toFixed(1)} yrs</span>}
        <span>Applied {formatDate(card.appliedAt)}</span>
      </div>

      {card.skills.length > 0 && (
        <ul className={styles.skills}>
          {card.skills.slice(0, 3).map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
          {card.skills.length > 3 && <li>+{card.skills.length - 3}</li>}
        </ul>
      )}

      {card.tags.length > 0 && (
        <ul className={styles.tags}>
          {card.tags.map((tag) => (
            <li key={tag.name} style={{ background: `${tag.colour}1a`, color: tag.colour }}>
              {tag.name}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.cardFooter}>
        {card.recruiter && (
          <span className={styles.recruiter}>
            {card.recruiter.firstName} {card.recruiter.lastName}
          </span>
        )}
        {card.nextInterview && (
          <span className={styles.interview} title={card.nextInterview.roundName}>
            <CalendarClock className="size-3" aria-hidden="true" />
            {formatDate(card.nextInterview.scheduledStart)}
          </span>
        )}
      </div>
    </li>
  );
}

function KanbanColumn({
  stage,
  label,
  cards,
  isValidTarget,
}: {
  stage: ApplicationStage;
  label: string;
  cards: PipelineCard[];
  isValidTarget: boolean | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      ref={setNodeRef}
      className={[
        styles.column,
        isOver && isValidTarget ? styles.columnOver : '',
        isValidTarget === false ? styles.columnInvalid : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${label}, ${cards.length} candidate${cards.length === 1 ? '' : 's'}`}
    >
      <header className={styles.columnHeader}>
        <h2 className={styles.columnTitle}>{label}</h2>
        <span className={styles.columnCount}>{cards.length}</span>
      </header>

      <ul className={styles.cardList}>
        {cards.map((card) => (
          <KanbanCard key={card.applicationId} card={card} />
        ))}
        {cards.length === 0 && <li className={styles.emptyColumn}>No candidates</li>}
      </ul>
    </section>
  );
}

export default function PipelinePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keyboard sensor keeps the board usable without a pointer; the
  // per-card stage dropdown below is the non-drag fallback.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const jobs = useQuery({
    queryKey: ['jobs', 'for-pipeline'],
    queryFn: () =>
      api.get<Paginated<JobRequirement>>('/jobs', {
        status: 'PUBLISHED,APPROVED,ON_HOLD,CLOSED',
        pageSize: 100,
        sortBy: 'createdAt',
      }),
  });

  const board = useQuery({
    queryKey: ['pipeline', jobId],
    queryFn: () => api.get<PipelineBoard>(`/applications/pipeline/${jobId}`),
    enabled: Boolean(jobId),
  });

  const transition = useMutation({
    mutationFn: ({ applicationId, toStage }: { applicationId: string; toStage: ApplicationStage }) =>
      api.patch(`/applications/${applicationId}/transition`, { toStage }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pipeline', jobId] });
      toast.success('Candidate moved');
    },
    onError: (err) => {
      // The server is the authority on valid transitions; show exactly
      // why it refused and refresh so the board matches the database.
      setError(err instanceof ApiError ? err.message : 'Could not move the candidate.');
      void queryClient.invalidateQueries({ queryKey: ['pipeline', jobId] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setError(null);
    setActiveCard((event.active.data.current as { card: PipelineCard } | undefined)?.card ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const card = activeCard;
    setActiveCard(null);
    if (!event.over || !card) return;

    const toStage = event.over.id as ApplicationStage;
    const fromStage = board.data?.columns.find((column) =>
      column.cards.some((c) => c.applicationId === card.applicationId),
    )?.stage;

    if (!fromStage || fromStage === toStage) return;

    if (!isValidStageTransition(fromStage, toStage)) {
      setError(
        `${STAGE_LABELS[fromStage]} → ${STAGE_LABELS[toStage]} is not a permitted move. ` +
          'Stages advance in order and may only be stepped back by one.',
      );
      return;
    }

    transition.mutate({ applicationId: card.applicationId, toStage });
  };

  const currentStageOfActive = useMemo(() => {
    if (!activeCard || !board.data) return null;
    return (
      board.data.columns.find((column) =>
        column.cards.some((card) => card.applicationId === activeCard.applicationId),
      )?.stage ?? null
    );
  }, [activeCard, board.data]);

  const jobOptions = (jobs.data?.data ?? []).map((job) => ({
    value: job.id,
    label: `${job.requirementCode} — ${job.title}`,
  }));

  return (
    <>
      <PageHeader
        title="Candidate Pipeline"
        description={
          board.data
            ? `${board.data.job.title} · ${board.data.total} candidate(s) · ${board.data.job.vacanciesFilled}/${board.data.job.vacancies} filled`
            : 'Select a job requirement to view its pipeline.'
        }
      />

      <Card className="mb-4 p-4">
        <Field label="Job requirement" htmlFor="pipeline-job">
          <Select
            id="pipeline-job"
            value={jobId ?? ''}
            onValueChange={(value) => navigate(`/pipeline/${value}`)}
            options={jobOptions}
            placeholder={jobs.isLoading ? 'Loading jobs…' : 'Select a job requirement'}
          />
        </Field>
      </Card>

      {error && (
        <Alert tone="warning" title="Move not allowed" className="mb-4">
          {error}
        </Alert>
      )}

      {!jobId ? (
        <Card>
          <EmptyState
            title="No job selected"
            description="Choose a requirement above to see its candidate pipeline."
          />
        </Card>
      ) : board.isLoading ? (
        <PageLoader label="Loading pipeline" />
      ) : board.isError ? (
        <Alert tone="error" title="Could not load this pipeline">
          You may not have access to this job requirement.
        </Alert>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveCard(null)}
          >
            <div className={styles.board}>
              {board.data!.columns.map((column) => (
                <KanbanColumn
                  key={column.stage}
                  stage={column.stage}
                  label={column.label}
                  cards={column.cards as PipelineCard[]}
                  isValidTarget={
                    currentStageOfActive
                      ? isValidStageTransition(currentStageOfActive, column.stage)
                      : null
                  }
                />
              ))}
            </div>

            <DragOverlay>
              {activeCard && (
                <div className={styles.dragPreview}>
                  <p className="text-sm font-medium">{activeCard.candidateName}</p>
                  <p className="text-xs text-muted-foreground">{activeCard.applicationCode}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          <p className="mt-4 text-xs text-muted-foreground">
            Drag a card to change its stage, or open a candidate and use the stage dropdown.
            Every move is validated on the server before it is saved.
          </p>
        </>
      )}
    </>
  );
}
