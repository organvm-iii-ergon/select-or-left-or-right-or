const { after, afterEach, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const { AFFILIATIONS } = require('../lib/utils.js');

const originalLoad = Module._load;
let serverModule;
let fakeJwt;
let fakeSocketIoServer;

function middleware(req, res, next) {
  if (typeof next === 'function') {
    next();
  }
}

function createExpressMock() {
  function express() {
    const app = function appHandler(req, res) {
      res.statusCode = 404;
      res.end();
    };

    app._routes = [];
    app._middleware = [];
    app.use = (...args) => {
      app._middleware.push(args);
      return app;
    };

    ['get', 'post', 'put', 'delete'].forEach((method) => {
      app[method] = (path, ...handlers) => {
        app._routes.push({ method, path, handlers });
        return app;
      };
    });

    return app;
  }

  express.static = () => middleware;
  return express;
}

function createValidator() {
  const validator = middleware;
  const chainMethods = [
    'equals',
    'escape',
    'exists',
    'isEmail',
    'isIn',
    'isInt',
    'isLength',
    'normalizeEmail',
    'notEmpty',
    'optional',
    'trim',
  ];

  chainMethods.forEach((method) => {
    validator[method] = () => validator;
  });

  return validator;
}

class FakeDatabase {
  constructor(filename, callback) {
    this.filename = filename;
    this.getImpl = null;
    this.runImpl = null;
    this.allImpl = null;

    if (callback) {
      callback(null);
    }
  }

  get(sql, params, callback) {
    if (this.getImpl) {
      return this.getImpl(sql, params, callback);
    }
    return callback(null, null);
  }

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    if (this.runImpl) {
      return this.runImpl(sql, params, callback);
    }

    if (callback) {
      callback.call({ lastID: 1, changes: 1 }, null);
    }
  }

  all(sql, params, callback) {
    if (this.allImpl) {
      return this.allImpl(sql, params, callback);
    }
    return callback(null, []);
  }

  close(callback) {
    if (callback) {
      callback(null);
    }
  }
}

function createMulterMock() {
  function multer() {
    return {
      single: () => middleware,
    };
  }

  multer.diskStorage = (options) => options;
  return multer;
}

function createWinstonMock() {
  const logger = {
    error: () => {},
    info: () => {},
    warn: () => {},
  };

  return {
    createLogger: () => logger,
    format: {
      colorize: () => ({}),
      combine: () => ({}),
      json: () => ({}),
      simple: () => ({}),
      timestamp: () => ({}),
    },
    transports: {
      Console: class ConsoleTransport {},
      File: class FileTransport {},
    },
  };
}

function createSharpMock() {
  return function sharp() {
    const chain = {
      jpeg: () => chain,
      resize: () => chain,
      toFile: async () => {},
    };
    return chain;
  };
}

function createSocketIOMock() {
  return function socketIO() {
    fakeSocketIoServer = {
      emissions: [],
      emit(event, payload) {
        this.emissions.push({ event, payload });
      },
      on: () => {},
      to(room) {
        return {
          emit: (event, payload) => {
            fakeSocketIoServer.emissions.push({ room, event, payload });
          },
        };
      },
    };

    return fakeSocketIoServer;
  };
}

function installDependencyMocks() {
  fakeJwt = {
    verify: (token, secret, callback) => callback(null, { id: 1 }),
    sign: () => 'signed-token',
  };

  const mocks = {
    bcryptjs: {
      compare: async () => true,
      hash: async () => 'hashed-password',
    },
    'body-parser': {
      json: () => middleware,
      urlencoded: () => middleware,
    },
    compression: () => middleware,
    cors: () => middleware,
    dotenv: { config: () => ({}) },
    express: createExpressMock(),
    'express-rate-limit': () => middleware,
    'express-validator': {
      body: () => createValidator(),
      validationResult: () => ({ isEmpty: () => true, array: () => [] }),
    },
    helmet: () => middleware,
    jsonwebtoken: fakeJwt,
    multer: createMulterMock(),
    nodemailer: {
      createTransport: () => ({
        sendMail: async () => {},
      }),
    },
    qrcode: {
      toDataURL: (url, callback) => callback(null, `data:${url}`),
    },
    sharp: createSharpMock(),
    'socket.io': createSocketIOMock(),
    speakeasy: {
      generateSecret: () => ({ base32: 'secret', otpauth_url: 'otpauth://secret' }),
      totp: {
        verify: () => true,
      },
    },
    sqlite3: {
      verbose: () => ({ Database: FakeDatabase }),
    },
    uuid: {
      v4: () => 'test-uuid',
    },
    winston: createWinstonMock(),
  };

  Module._load = function loadWithMocks(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}

function createResponse() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

function createAuthenticatedRequest(overrides = {}) {
  return {
    body: {},
    headers: {},
    ip: '127.0.0.1',
    params: {},
    query: {},
    user: { affiliation: 'Conservative', id: 10, username: 'tester' },
    get(name) {
      return name === 'user-agent' ? 'node-test-agent' : undefined;
    },
    ...overrides,
  };
}

function findRoute(method, path) {
  const route = serverModule.app._routes.find((candidate) => {
    return candidate.method === method && candidate.path === path;
  });

  assert.ok(route, `Expected ${method.toUpperCase()} ${path} to be registered`);
  return route;
}

async function invokeRoute(method, path, req, res = createResponse()) {
  const route = findRoute(method, path);
  await route.handlers.at(-1)(req, res);
  return res;
}

before(() => {
  installDependencyMocks();
  delete require.cache[require.resolve('../server.js')];
  serverModule = require('../server.js');
});

afterEach(() => {
  if (serverModule?.db) {
    serverModule.db.getImpl = null;
    serverModule.db.runImpl = null;
    serverModule.db.allImpl = null;
  }

  if (fakeJwt) {
    fakeJwt.verify = (token, secret, callback) => callback(null, { id: 1 });
    fakeJwt.sign = () => 'signed-token';
  }

  if (fakeSocketIoServer) {
    fakeSocketIoServer.emissions = [];
  }
});

after(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve('../server.js')];
});

describe('server public utility routes', () => {
  it('registers the affiliations endpoint with the shared affiliation list', () => {
    const route = findRoute('get', '/api/affiliations');
    const res = createResponse();

    route.handlers.at(-1)({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, AFFILIATIONS);
  });

  it('registers a health endpoint with a parseable timestamp', () => {
    const route = findRoute('get', '/api/health');
    const res = createResponse();

    route.handlers.at(-1)({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.message, 'Server is running');
    assert.ok(Number.isFinite(Date.parse(res.body.timestamp)));
  });
});

describe('authenticateToken', () => {
  it('rejects requests without a bearer token', () => {
    const req = { headers: {} };
    const res = createResponse();
    let nextCalled = false;

    serverModule.authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });

  it('rejects invalid bearer tokens', () => {
    fakeJwt.verify = (token, secret, callback) => {
      assert.equal(token, 'bad-token');
      callback(new Error('bad token'));
    };

    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = createResponse();
    let nextCalled = false;

    serverModule.authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  it('attaches the decoded user and continues for valid tokens', () => {
    const decodedUser = { affiliation: 'Centrist', id: 42, username: 'river' };
    fakeJwt.verify = (token, secret, callback) => {
      assert.equal(token, 'good-token');
      callback(null, decodedUser);
    };

    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = createResponse();
    let nextCalled = false;

    serverModule.authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, decodedUser);
    assert.equal(res.body, undefined);
  });
});

describe('requireAdmin', () => {
  it('continues when the authenticated user is an admin', () => {
    serverModule.db.getImpl = (sql, params, callback) => {
      assert.match(sql, /SELECT is_admin FROM users/);
      assert.deepEqual(params, [42]);
      callback(null, { is_admin: 1 });
    };

    const req = { user: { id: 42 } };
    const res = createResponse();
    let nextCalled = false;

    serverModule.requireAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.body, undefined);
  });

  it('rejects authenticated users without admin access', () => {
    serverModule.db.getImpl = (sql, params, callback) => {
      callback(null, { is_admin: 0 });
    };

    const req = { user: { id: 7 } };
    const res = createResponse();
    let nextCalled = false;

    serverModule.requireAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Admin access required' });
  });
});

describe('post route workflows', () => {
  it('creates a post, saves hashtag links, notifies mentioned users, and emits the post', async () => {
    const content = 'Shipping #Alpha and #BETA with @friend';
    const createdPost = {
      id: 101,
      user_id: 10,
      content,
      image_url: '',
      username: 'tester',
    };
    const runCalls = [];
    const getCalls = [];

    serverModule.db.runImpl = (sql, params, callback) => {
      runCalls.push({ sql, params });

      if (/INSERT INTO posts \(user_id, content, image_url\)/.test(sql)) {
        return callback.call({ lastID: 101, changes: 1 }, null);
      }

      if (/INSERT INTO activity_log/.test(sql)) {
        return callback.call({ lastID: 201, changes: 1 }, null);
      }

      if (/INSERT OR IGNORE INTO hashtags/.test(sql)) {
        const hashtagIds = { alpha: 301, beta: 302 };
        return callback.call({ lastID: hashtagIds[params[0]], changes: 1 }, null);
      }

      if (/INSERT OR IGNORE INTO post_hashtags/.test(sql)) {
        if (callback) {
          return callback.call({ lastID: 401, changes: 1 }, null);
        }
        return undefined;
      }

      if (/INSERT INTO notifications/.test(sql)) {
        return callback.call({ lastID: 501, changes: 1 }, null);
      }

      throw new Error(`Unexpected run SQL: ${sql}`);
    };

    serverModule.db.getImpl = (sql, params, callback) => {
      getCalls.push({ sql, params });

      if (/SELECT id FROM users WHERE username = \?/.test(sql)) {
        return callback(null, { id: 22 });
      }

      if (/FROM posts\s+JOIN users ON posts\.user_id = users\.id\s+WHERE posts\.id = \?/.test(sql)) {
        return callback(null, createdPost);
      }

      throw new Error(`Unexpected get SQL: ${sql}`);
    };

    const req = createAuthenticatedRequest({ body: { content } });
    const res = await invokeRoute('post', '/api/posts', req);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, createdPost);

    assert.deepEqual(
      runCalls.find((call) => /INSERT INTO posts \(user_id, content, image_url\)/.test(call.sql)).params,
      [10, content, '']
    );
    assert.deepEqual(
      runCalls
        .filter((call) => /INSERT OR IGNORE INTO hashtags/.test(call.sql))
        .map((call) => call.params),
      [['alpha'], ['beta']]
    );
    assert.deepEqual(
      runCalls
        .filter((call) => /INSERT OR IGNORE INTO post_hashtags/.test(call.sql))
        .map((call) => call.params),
      [[101, 301], [101, 302]]
    );
    assert.deepEqual(
      runCalls.find((call) => /INSERT INTO notifications/.test(call.sql)).params,
      [22, 'mention', 10, 101, null, null]
    );
    assert.deepEqual(
      getCalls.find((call) => /SELECT id FROM users WHERE username = \?/.test(call.sql)).params,
      ['friend']
    );
    assert.deepEqual(fakeSocketIoServer.emissions, [
      {
        room: 'user_22',
        event: 'notification',
        payload: {
          id: 501,
          type: 'mention',
          actorId: 10,
          postId: 101,
          commentId: null,
          message: null,
          created_at: fakeSocketIoServer.emissions[0].payload.created_at,
        },
      },
      { event: 'new_post', payload: createdPost },
    ]);
    assert.ok(Number.isFinite(Date.parse(fakeSocketIoServer.emissions[0].payload.created_at)));
  });

  it('queries the authenticated user feed with affiliation, pagination, block, and mute filters', async () => {
    const feedRows = [{ id: 7, content: 'same bubble post' }];

    serverModule.db.allImpl = (sql, params, callback) => {
      assert.match(sql, /users\.affiliation = \?/);
      assert.match(sql, /blocked_id FROM blocks/);
      assert.match(sql, /muted_id FROM mutes/);
      assert.match(sql, /LIMIT \? OFFSET \?/);
      assert.deepEqual(params, [10, 10, 'Liberal', 10, 10, 12, 24]);
      callback(null, feedRows);
    };

    const req = createAuthenticatedRequest({
      query: { limit: '12', offset: '24' },
      user: { affiliation: 'Liberal', id: 10, username: 'tester' },
    });
    const res = await invokeRoute('get', '/api/feed', req);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, feedRows);
  });

  it('rejects post edits from users who do not own the post', async () => {
    serverModule.db.getImpl = (sql, params, callback) => {
      assert.match(sql, /SELECT user_id FROM posts WHERE id = \?/);
      assert.deepEqual(params, ['99']);
      callback(null, { user_id: 42 });
    };

    serverModule.db.runImpl = () => {
      throw new Error('Post update should not run for a non-owner');
    };

    const req = createAuthenticatedRequest({
      body: { content: 'edited text' },
      params: { id: '99' },
    });
    const res = await invokeRoute('put', '/api/posts/:id', req);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Not authorized to edit this post' });
  });

  it('soft-deletes posts owned by the authenticated user', async () => {
    const runCalls = [];

    serverModule.db.getImpl = (sql, params, callback) => {
      assert.match(sql, /SELECT user_id FROM posts WHERE id = \?/);
      assert.deepEqual(params, ['77']);
      callback(null, { user_id: 10 });
    };

    serverModule.db.runImpl = (sql, params, callback) => {
      runCalls.push({ sql, params });

      if (/UPDATE posts SET deleted = 1/.test(sql)) {
        return callback(null);
      }

      if (/INSERT INTO activity_log/.test(sql)) {
        return callback.call({ lastID: 601, changes: 1 }, null);
      }

      throw new Error(`Unexpected run SQL: ${sql}`);
    };

    const req = createAuthenticatedRequest({ params: { id: '77' } });
    const res = await invokeRoute('delete', '/api/posts/:id', req);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { message: 'Post deleted successfully' });
    assert.deepEqual(runCalls[0].params, ['77']);
    assert.deepEqual(runCalls[1].params, [10, 'delete_post', 'post', '77', '127.0.0.1', 'node-test-agent']);
  });
});

describe('post like route workflows', () => {
  it('removes an existing post like without creating side effects', async () => {
    serverModule.db.getImpl = (sql, params, callback) => {
      assert.match(sql, /SELECT id FROM likes WHERE user_id = \? AND post_id = \?/);
      assert.deepEqual(params, [10, '55']);
      callback(null, { id: 12 });
    };

    serverModule.db.runImpl = (sql, params, callback) => {
      assert.match(sql, /DELETE FROM likes WHERE user_id = \? AND post_id = \?/);
      assert.deepEqual(params, [10, '55']);
      callback(null);
    };

    const req = createAuthenticatedRequest({ params: { id: '55' } });
    const res = await invokeRoute('post', '/api/posts/:id/like', req);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { message: 'Post unliked', liked: false });
    assert.deepEqual(fakeSocketIoServer.emissions, []);
  });

  it('adds a new post like, logs activity, and notifies the post author', async () => {
    const runCalls = [];
    const getCalls = [];

    serverModule.db.getImpl = (sql, params, callback) => {
      getCalls.push({ sql, params });

      if (/SELECT id FROM likes WHERE user_id = \? AND post_id = \?/.test(sql)) {
        return callback(null, null);
      }

      if (/SELECT user_id FROM posts WHERE id = \?/.test(sql)) {
        return callback(null, { user_id: 44 });
      }

      throw new Error(`Unexpected get SQL: ${sql}`);
    };

    serverModule.db.runImpl = (sql, params, callback) => {
      runCalls.push({ sql, params });

      if (/INSERT INTO likes \(user_id, post_id\)/.test(sql)) {
        return callback(null);
      }

      if (/INSERT INTO activity_log/.test(sql)) {
        return callback.call({ lastID: 701, changes: 1 }, null);
      }

      if (/INSERT INTO notifications/.test(sql)) {
        return callback.call({ lastID: 801, changes: 1 }, null);
      }

      throw new Error(`Unexpected run SQL: ${sql}`);
    };

    const req = createAuthenticatedRequest({ params: { id: '55' } });
    const res = await invokeRoute('post', '/api/posts/:id/like', req);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { message: 'Post liked', liked: true });
    assert.deepEqual(getCalls.map((call) => call.params), [[10, '55'], ['55']]);
    assert.deepEqual(
      runCalls.find((call) => /INSERT INTO likes \(user_id, post_id\)/.test(call.sql)).params,
      [10, '55']
    );
    assert.deepEqual(
      runCalls.find((call) => /INSERT INTO activity_log/.test(call.sql)).params,
      [10, 'like_post', 'post', '55', '127.0.0.1', 'node-test-agent']
    );
    assert.deepEqual(
      runCalls.find((call) => /INSERT INTO notifications/.test(call.sql)).params,
      [44, 'like', 10, '55', null, null]
    );
    assert.equal(fakeSocketIoServer.emissions.length, 1);
    assert.equal(fakeSocketIoServer.emissions[0].room, 'user_44');
    assert.equal(fakeSocketIoServer.emissions[0].event, 'notification');
    assert.equal(fakeSocketIoServer.emissions[0].payload.type, 'like');
    assert.equal(fakeSocketIoServer.emissions[0].payload.postId, '55');
  });
});
