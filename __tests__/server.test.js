const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const { AFFILIATIONS } = require('../lib/utils.js');

const originalLoad = Module._load;
let serverModule;
let fakeJwt;

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
    return {
      emit: () => {},
      on: () => {},
      to: () => ({ emit: () => {} }),
    };
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

function findRoute(method, path) {
  const route = serverModule.app._routes.find((candidate) => {
    return candidate.method === method && candidate.path === path;
  });

  assert.ok(route, `Expected ${method.toUpperCase()} ${path} to be registered`);
  return route;
}

before(() => {
  installDependencyMocks();
  delete require.cache[require.resolve('../server.js')];
  serverModule = require('../server.js');
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
