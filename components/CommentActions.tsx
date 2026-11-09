import { KebabHorizontalIcon } from '@primer/octicons-react';
import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../lib/context';
import { useGiscusTranslation } from '../lib/i18n';
import { IComment, IReply } from '../lib/types/adapter';
import { deleteDiscussionComment } from '../services/github/commentMutations';

interface Props {
  comment: IComment | IReply;
  onEdit: () => void;
  onChanged?: () => void | Promise<unknown>;
}

export default function CommentActions({ comment, onEdit, onChanged }: Props) {
  const { token, onSignOut } = useContext(AuthContext);
  const { t } = useGiscusTranslation();
  const details = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token || (!comment.viewerCanUpdate && !comment.viewerCanDelete)) return;
    const closeOutside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details.current?.open) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [token, comment.viewerCanUpdate, comment.viewerCanDelete]);

  if (
    !token ||
    comment.deletedAt ||
    comment.isMinimized ||
    (!comment.viewerCanUpdate && !comment.viewerCanDelete)
  )
    return null;

  async function remove() {
    if (busy || !comment.viewerCanDelete) return;
    const hasReplies = 'replyCount' in comment && comment.replyCount > 0;
    if (!window.confirm(t(hasReplies ? 'confirmDeleteCommentWithReplies' : 'confirmDeleteComment')))
      return;
    setBusy(true);
    setError(false);
    try {
      await deleteDiscussionComment(comment.id, token);
      if (details.current) details.current.open = false;
      await onChanged?.();
    } catch (error) {
      if (error?.status === 401) {
        onSignOut();
        return;
      }
      if (details.current) details.current.open = true;
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="gsc-comment-actions relative ml-2 shrink-0" ref={details}>
      <summary className="btn list-none border-0 p-1 shadow-none" aria-label={t('commentActions')}>
        <KebabHorizontalIcon size={16} />
      </summary>
      <div className="color-bg-overlay color-border-primary absolute right-0 z-20 mt-1 min-w-[120px] rounded-md border p-1 shadow-md">
        {comment.viewerCanUpdate ? (
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left text-sm hover:underline"
            disabled={busy}
            onClick={() => {
              if (details.current) details.current.open = false;
              setError(false);
              onEdit();
            }}
          >
            {t('editComment')}
          </button>
        ) : null}
        {comment.viewerCanDelete ? (
          <button
            type="button"
            className="color-text-danger block w-full rounded px-3 py-2 text-left text-sm hover:underline"
            disabled={busy}
            onClick={remove}
          >
            {t('deleteComment')}
          </button>
        ) : null}
        {error ? (
          <p className="color-text-danger p-2 text-xs" role="alert">
            {t('commentActionFailed')}
          </p>
        ) : null}
      </div>
    </details>
  );
}
