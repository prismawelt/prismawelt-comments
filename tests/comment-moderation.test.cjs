const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(output, {
    exports,
    require(name) {
      if (!(name in dependencies)) throw Error('Unexpected import: ' + name);
      return dependencies[name];
    },
    ...globals,
  });
  return exports;
}

function mutations(response) {
  const calls = [];
  const api = load(
    'services/github/commentMutations.ts',
    {
      '../config': { GITHUB_GRAPHQL_API_URL: 'https://api.github.com/graphql' },
    },
    {
      fetch: async (url, options) => {
        calls.push({ url, ...options, body: JSON.parse(options.body) });
        return {
          ok: response.ok !== false,
          status: response.status || 200,
          json: async () => response.body,
        };
      },
    },
  );
  return { api, calls };
}

test('mutation calls require a signed-in user; empty edits make no request', async () => {
  const { api, calls } = mutations({ body: {} });
  await assert.rejects(api.deleteDiscussionComment('comment-1', ''), /Authentication/);
  await assert.rejects(api.updateDiscussionComment('comment-1', '   ', 'fixture-token'), /body/);
  assert.equal(calls.length, 0);
});

test('edit sends the raw body as a GraphQL variable under the user token', async () => {
  const { api, calls } = mutations({
    body: { data: { updateDiscussionComment: { comment: { id: 'comment-1' } } } },
  });
  const body = 'Text with "quotes" and <textarea> characters';
  await api.updateDiscussionComment('comment-1', body, 'fixture-token');
  assert.equal(calls[0].url, 'https://api.github.com/graphql');
  assert.deepEqual(calls[0].body.variables, { id: 'comment-1', body });
  assert.equal(calls[0].headers.Authorization, 'Bearer fixture-token');
  assert.match(calls[0].body.query, /commentId: \$id/);
});

test('delete targets one comment and requires its acknowledgement', async () => {
  const { api, calls } = mutations({
    body: { data: { deleteDiscussionComment: { clientMutationId: 'comment-1' } } },
  });
  await api.deleteDiscussionComment('comment-1', 'fixture-token');
  assert.deepEqual(calls[0].body.variables, { id: 'comment-1' });
  assert.match(calls[0].body.query, /deleteDiscussionComment/);
  assert.doesNotMatch(calls[0].body.query, /\bdeleteDiscussion\(/);
  const bad = mutations({ body: { data: { deleteDiscussionComment: null } } });
  await assert.rejects(bad.api.deleteDiscussionComment('comment-1', 'fixture-token'), /confirmed/);
});

test('HTTP and GraphQL errors propagate instead of reporting success', async () => {
  for (const response of [
    { ok: false, body: {} },
    { body: { errors: [{ message: 'Forbidden' }] } },
  ]) {
    const { api } = mutations(response);
    await assert.rejects(api.updateDiscussionComment('comment-1', 'text', 'fixture-token'));
    await assert.rejects(api.deleteDiscussionComment('comment-1', 'fixture-token'));
  }
});

function menu({
  token = 'fixture-token',
  update = true,
  remove = true,
  deleted = false,
  confirm = true,
  failure = false,
  replies = 0,
} = {}) {
  const calls = [],
    states = [],
    confirmations = [];
  let refreshes = 0;
  const jsx = (type, props) => ({ type, props });
  const Component = load(
    'components/CommentActions.tsx',
    {
      'react/jsx-runtime': { jsx, jsxs: jsx },
      react: {
        useContext: () => ({ token }),
        useEffect: () => {},
        useRef: () => ({ current: { open: true } }),
        useState: (initial) => [initial, (value) => states.push(value)],
      },
      '@primer/octicons-react': { KebabHorizontalIcon: 'icon' },
      '../lib/context': { AuthContext: {} },
      '../lib/i18n': { useGiscusTranslation: () => ({ t: (key) => key }) },
      '../services/github/commentMutations': {
        deleteDiscussionComment: async (id, auth) => {
          calls.push({ id, auth });
          if (failure) throw Error('denied');
        },
      },
    },
    {
      window: {
        confirm: (message) => {
          confirmations.push(message);
          return confirm;
        },
      },
    },
  ).default;
  const tree = Component({
    comment: {
      id: 'comment-1',
      viewerCanUpdate: update,
      viewerCanDelete: remove,
      deletedAt: deleted ? 'date' : null,
      isMinimized: false,
      replyCount: replies,
    },
    onEdit() {},
    onChanged: async () => {
      refreshes++;
    },
  });
  return {
    tree,
    calls,
    states,
    confirmations,
    get refreshes() {
      return refreshes;
    },
  };
}

function button(tree, label) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === 'button' && tree.props.children === label) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children.flat() : [children]) {
    const found = button(child, label);
    if (found) return found;
  }
  return null;
}

test('menus appear only for logged-in users with actual edit/delete permissions', () => {
  assert.equal(menu({ token: '' }).tree, null);
  assert.equal(menu({ update: false, remove: false }).tree, null);
  assert.equal(menu({ deleted: true }).tree, null);
  assert.ok(button(menu({ update: true, remove: false }).tree, 'editComment'));
  assert.equal(button(menu({ update: true, remove: false }).tree, 'deleteComment'), null);
});

test('cancelling deletion leaves the comment untouched', async () => {
  const state = menu({ confirm: false });
  await button(state.tree, 'deleteComment').props.onClick();
  assert.equal(state.calls.length, 0);
  assert.equal(state.refreshes, 0);
});

test('confirmed deletion refreshes only after API success and preserves replies notice', async () => {
  const state = menu({ replies: 2 });
  await button(state.tree, 'deleteComment').props.onClick();
  assert.deepEqual(state.calls, [{ id: 'comment-1', auth: 'fixture-token' }]);
  assert.equal(state.refreshes, 1);
  assert.deepEqual(state.confirmations, ['confirmDeleteCommentWithReplies']);
  const failed = menu({ failure: true });
  await button(failed.tree, 'deleteComment').props.onClick();
  assert.equal(failed.refreshes, 0);
  assert.deepEqual(failed.states, [true, false, true, false]);
});

test('expired user tokens keep their status for reauthentication', async () => {
  const { api } = mutations({ ok: false, status: 401, body: { message: 'Bad credentials' } });
  await assert.rejects(
    api.deleteDiscussionComment('comment-1', 'expired-fixture-token'),
    (error) => error.status === 401,
  );
});

test('OAuth returns only to the blog or its comment service', () => {
  const { parseCommentReturnUrl } = load('lib/oauth/return-url.ts', {}, { URL });
  assert.equal(
    parseCommentReturnUrl('https://prismawelt.github.io/ja/nichijou/mono/').hostname,
    'prismawelt.github.io',
  );
  assert.equal(
    parseCommentReturnUrl('https://prismawelt-comments.vercel.app/').hostname,
    'prismawelt-comments.vercel.app',
  );
  for (const value of [
    'https://attacker.example/',
    'https://prismawelt.github.io.attacker.example/',
    'https://user@prismawelt.github.io/',
    'javascript:alert(1)',
    ['https://prismawelt.github.io/'],
  ]) {
    assert.throws(() => parseCommentReturnUrl(value));
  }
});
