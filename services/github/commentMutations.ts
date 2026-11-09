import { GITHUB_GRAPHQL_API_URL } from '../config';

async function mutate(query: string, variables: Record<string, string>, token: string) {
  if (!token) throw new Error('Authentication required');
  const response = await fetch(GITHUB_GRAPHQL_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length || !payload.data) {
    throw Object.assign(new Error('Comment action failed'), { status: response.status });
  }
  return payload.data;
}

export async function updateDiscussionComment(id: string, body: string, token: string) {
  if (!body.trim()) throw new Error('Comment body is required');
  const data = await mutate(
    `mutation($id: ID!, $body: String!) {
      updateDiscussionComment(input: {commentId: $id, body: $body}) {
        comment { id body bodyHTML lastEditedAt }
      }
    }`,
    { id, body },
    token,
  );
  if (data.updateDiscussionComment?.comment?.id !== id) {
    throw new Error('Comment update was not confirmed');
  }
  return data.updateDiscussionComment.comment;
}

export async function deleteDiscussionComment(id: string, token: string) {
  const data = await mutate(
    `mutation($id: ID!, $clientMutationId: String!) {
      deleteDiscussionComment(input: {id: $id, clientMutationId: $clientMutationId}) {
        clientMutationId
      }
    }`,
    { id, clientMutationId: id },
    token,
  );
  if (data.deleteDiscussionComment?.clientMutationId !== id) {
    throw new Error('Comment deletion was not confirmed');
  }
}
