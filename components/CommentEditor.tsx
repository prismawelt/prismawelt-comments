import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../lib/context';
import { useGiscusTranslation } from '../lib/i18n';
import { IComment, IReply } from '../lib/types/adapter';
import { updateDiscussionComment } from '../services/github/commentMutations';

interface Props {
  comment: IComment | IReply;
  onCancel: () => void;
  onSaved: () => void | Promise<unknown>;
}

export default function CommentEditor({ comment, onCancel, onSaved }: Props) {
  const { token, onSignOut } = useContext(AuthContext);
  const { t } = useGiscusTranslation();
  const [body, setBody] = useState(comment.body);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textarea.current?.focus();
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function save() {
    if (busy || !token || !comment.viewerCanUpdate || !body.trim()) return;
    setBusy(true);
    setError(false);
    try {
      await updateDiscussionComment(comment.id, body, token);
      await onSaved();
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
    <form
      className="gsc-comment-editor p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <textarea
        className="form-control gsc-comment-box-textarea"
        aria-label={t('editComment')}
        value={body}
        disabled={busy}
        ref={textarea}
        onChange={(event) => setBody(event.currentTarget.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            save();
          }
        }}
      />
      {error ? (
        <p className="color-text-danger mt-2 text-sm" role="alert">
          {t('commentActionFailed')}
        </p>
      ) : null}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          {t('cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !body.trim()}>
          {t('saveComment')}
        </button>
      </div>
    </form>
  );
}
