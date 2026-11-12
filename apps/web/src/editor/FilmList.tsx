import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthorStep } from '../api/types.js';
import { Icon } from '../components/Icon.js';
import { Poster } from '../components/Poster.js';
import { useMediaQuery } from '../components/useMediaQuery.js';
import { filmTitle, originalTitleNote } from '../films/titles.js';
import { isPendingStep, moveItem, stepKey } from './films.js';

/** How long "Remove? Yes / No" waits before it takes itself back. */
export const CONFIRM_MS = 5000;
/** How long a removed row takes to fold away. */
const COLLAPSE_MS = 150;
const REORDER_TRANSITION = {
  duration: 200,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

/** The list only goes up and down: whatever the pointer does sideways is ignored. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

type Props = {
  steps: AuthorStep[];
  /** Travelers have joined: the films can be read but not changed. */
  locked: boolean;
  /** The new order, as step ids. */
  onReorder: (stepIds: string[]) => void;
  onRemove: (step: AuthorStep) => void;
  /** Says something to people who cannot see the list (a polite live region). */
  announce: (message: string) => void;
};

/** What a row shows: its number, poster and title. The same in every state. */
function FilmSummary({ step }: { step: AuthorStep }) {
  const { i18n } = useTranslation();
  const shown = filmTitle(step.film, i18n.language);
  const original = originalTitleNote(step.film, shown);
  return (
    <>
      <span className="route-step-n">{step.position}</span>
      <Poster url={step.film.posterUrl} />
      <h3 className="route-film-text">
        {shown}
        {step.film.releaseYear !== null && (
          <>
            {' '}
            <span className="year">{step.film.releaseYear}</span>
          </>
        )}
        {original && <span className="orig">{original}</span>}
      </h3>
    </>
  );
}

/**
 * The films of a route, in order. The author can drag them (mouse or finger, by
 * the handle) or move them with the keyboard (Space picks one up, the arrows
 * move it, Space drops it, Escape puts it back), and take them out with a
 * question first. A locked route shows the same list with none of that.
 */
export function FilmList({
  steps,
  locked,
  onReorder,
  onRemove,
  announce,
}: Props) {
  const { t, i18n } = useTranslation();
  const dndId = useId();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const listRef = useRef<HTMLOListElement>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // After a move with the buttons, the one that was used gets the focus back.
  const refocus = useRef<{ key: string; direction: -1 | 1 } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const keys = steps.map(stepKey);
  // A film just added is still being saved: its id is not the server's yet, so
  // nothing can be reordered or removed until it is.
  const frozen = steps.some(isPendingStep);

  const titleOf = (key: string | number) => {
    const step = steps.find((candidate) => stepKey(candidate) === String(key));
    return step ? filmTitle(step.film, i18n.language) : '';
  };
  const positionOf = (key: string | number) => keys.indexOf(String(key)) + 1;

  // The confirmation takes itself back after a while.
  useEffect(() => {
    if (confirming === null) return;
    const timer = setTimeout(() => setConfirming(null), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  // A step that disappears (removed, or the route reloaded) cancels its question.
  useEffect(() => {
    if (confirming !== null && !keys.includes(confirming)) setConfirming(null);
  }, [confirming, keys]);

  // Moving a row in the DOM can drop the focus: put it back where it was.
  useLayoutEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const list = listRef.current;
    if (!list) return;
    const button = (direction: -1 | 1) =>
      list.querySelector<HTMLButtonElement>(
        `[data-move="${target.key}:${direction}"]`,
      );
    const same = button(target.direction);
    // At the end of the list the button that was used no longer does anything.
    (same?.getAttribute('aria-disabled') === 'true'
      ? button(target.direction === 1 ? -1 : 1)
      : same
    )?.focus();
  });

  function reorderTo(from: number, to: number) {
    const next = moveItem(steps, from, to);
    if (next === steps) return;
    onReorder(next.map((step) => step.id));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    reorderTo(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
  }

  function moveWithButton(step: AuthorStep, direction: -1 | 1) {
    const from = keys.indexOf(stepKey(step));
    const to = from + direction;
    if (to < 0 || to >= steps.length) return;
    refocus.current = { key: stepKey(step), direction };
    reorderTo(from, to);
    announce(
      t('editor.films.moved', {
        title: filmTitle(step.film, i18n.language),
        position: to + 1,
        total: steps.length,
      }),
    );
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('editor.films.pickedUp', {
        title: titleOf(active.id),
        position: positionOf(active.id),
        total: steps.length,
      }),
    onDragOver: ({ active, over }) =>
      over
        ? t('editor.films.moved', {
            title: titleOf(active.id),
            position: positionOf(over.id),
            total: steps.length,
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      t('editor.films.moved', {
        title: titleOf(active.id),
        position: positionOf(over?.id ?? active.id),
        total: steps.length,
      }),
    onDragCancel: ({ active }) =>
      t('editor.films.cancelled', {
        title: titleOf(active.id),
        position: positionOf(active.id),
      }),
  };

  if (locked) {
    return (
      <ol className="route-films film-list">
        {steps.map((step) => (
          <li key={stepKey(step)} className="route-film film-row">
            <div className="film-row-inner">
              <FilmSummary step={step} />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('editor.films.dragHint') },
      }}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <ol className="route-films film-list" ref={listRef} tabIndex={-1}>
          {steps.map((step, index) => (
            <SortableRow
              key={stepKey(step)}
              step={step}
              index={index}
              total={steps.length}
              frozen={frozen}
              reduced={reduced}
              confirming={confirming === stepKey(step)}
              onAskRemove={() => setConfirming(stepKey(step))}
              onCancelRemove={() => setConfirming(null)}
              onConfirmRemove={() => {
                setConfirming(null);
                onRemove(step);
                // The row that had the focus is gone: keep it in the list.
                listRef.current?.focus();
              }}
              onMove={(direction) => moveWithButton(step, direction)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

type RowProps = {
  step: AuthorStep;
  index: number;
  total: number;
  frozen: boolean;
  reduced: boolean;
  confirming: boolean;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onMove: (direction: -1 | 1) => void;
};

function SortableRow({
  step,
  index,
  total,
  frozen,
  reduced,
  confirming,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
  onMove,
}: RowProps) {
  const { t, i18n } = useTranslation();
  const key = stepKey(step);
  const title = filmTitle(step.film, i18n.language);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: key,
    disabled: frozen,
    // Rows slide into place in 200 ms; under reduced motion they just jump.
    transition: reduced ? null : REORDER_TRANSITION,
  });
  const [collapsing, setCollapsing] = useState(false);
  const trashRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // The question takes the focus (on the safe answer); when it goes away
  // without an answer, the focus returns to the button that asked it.
  useEffect(() => {
    if (confirming) noRef.current?.focus();
    else if (
      wasConfirming.current &&
      document.activeElement === document.body
    ) {
      trashRef.current?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming]);

  function confirmRemove() {
    if (reduced) {
      onConfirmRemove();
      return;
    }
    // The row folds away first, then it is taken out.
    setCollapsing(true);
    setTimeout(onConfirmRemove, COLLAPSE_MS);
  }

  const move = (direction: -1 | 1) => (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      data-move={`${key}:${direction}`}
      aria-disabled={
        frozen || (direction === -1 ? index === 0 : index === total - 1)
      }
      onClick={() => {
        if (!frozen) onMove(direction);
      }}
    >
      <Icon name={direction === -1 ? 'arrow-up' : 'arrow-down'} size={16} />
      {t(direction === -1 ? 'editor.films.moveUp' : 'editor.films.moveDown')}
      <span className="visually-hidden"> {title}</span>
    </button>
  );

  const classes = [
    'route-film',
    'film-row',
    isDragging ? 'is-dragging' : '',
    collapsing ? 'is-collapsing' : '',
    isPendingStep(step) ? 'is-added' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      ref={setNodeRef}
      className={classes}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className="film-row-inner">
        <FilmSummary step={step} />
        {confirming ? (
          <div className="film-confirm" role="group" aria-label={title}>
            <span>{t('editor.films.removeConfirm')}</span>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={confirmRemove}
            >
              {t('editor.films.yes')}
              <span className="visually-hidden"> {title}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              ref={noRef}
              onClick={onCancelRemove}
            >
              {t('editor.films.no')}
            </button>
          </div>
        ) : (
          <div className="film-actions">
            {/* Only for the keyboard: they appear while one of them has the focus. */}
            <div className="film-moves" role="group" aria-label={title}>
              {move(-1)}
              {move(1)}
            </div>
            <button
              type="button"
              className="film-icon-btn film-handle"
              ref={setActivatorNodeRef}
              disabled={frozen}
              {...attributes}
              {...listeners}
              aria-label={t('editor.films.reorder', { title })}
            >
              <Icon name="grip" size={22} />
            </button>
            <button
              type="button"
              className="film-icon-btn"
              ref={trashRef}
              disabled={frozen}
              aria-label={t('editor.films.remove', { title })}
              onClick={onAskRemove}
            >
              <Icon name="trash" size={20} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
