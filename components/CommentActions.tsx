import { useContext, useState } from 'react';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

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
      await onChanged?.();
    } catch (error) {
      if (error?.status === 401) {
        onSignOut();
        return;
      }
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="gsc-comment-actions ml-2 flex shrink-0 flex-col items-end gap-1"
      role="group"
      aria-label={t('commentActions')}
    >
      <div className="flex items-center gap-2">
        {comment.viewerCanUpdate ? (
          <button
            type="button"
            className="color-text-tertiary border-0 bg-transparent p-0 text-xs font-normal leading-4 hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => {
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
            className="color-text-tertiary border-0 bg-transparent p-0 text-xs font-normal leading-4 hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={remove}
          >
            {t('deleteComment')}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="color-text-danger max-w-[10rem] text-xs" role="alert">
          {t('commentActionFailed')}
        </p>
      ) : null}
    </div>
  );
}
