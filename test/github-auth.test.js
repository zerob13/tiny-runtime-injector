import test, { mock } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import axios from "axios";
import { RuntimeInjector } from "../dist/index.js";

const ENV_KEYS = [
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "HTTP_PROXY",
  "http_proxy",
  "HTTPS_PROXY",
  "https_proxy",
  "NO_PROXY",
  "no_proxy",
];

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

function clearEnv(keys) {
  for (const key of keys) {
    delete process.env[key];
  }
}

function createInjector(options = {}) {
  return new RuntimeInjector({
    type: "rtk",
    version: "latest",
    platform: "darwin",
    arch: "arm64",
    targetDir: path.join(os.tmpdir(), "tiny-runtime-injector-auth-test"),
    ...options,
  });
}

function createReleaseResponse() {
  return {
    data: {
      tag_name: "v0.30.0",
      assets: [{ name: "rtk-aarch64-apple-darwin.tar.gz" }],
    },
  };
}

function createAxiosError(status, message, authorization = "Bearer secret-token") {
  const error = new Error(message);
  error.isAxiosError = true;
  error.response = {
    status,
    data: {
      message,
    },
  };
  error.config = {
    headers: {
      Authorization: authorization,
    },
  };
  return error;
}

test("prefers GITHUB_TOKEN over GH_TOKEN for rtk latest lookup", async (t) => {
  const envSnapshot = snapshotEnv(ENV_KEYS);
  t.after(() => restoreEnv(envSnapshot));
  clearEnv(ENV_KEYS);

  process.env.GITHUB_TOKEN = "  primary-token  ";
  process.env.GH_TOKEN = "fallback-token";

  const getMock = mock.method(axios, "get", async () => createReleaseResponse());
  t.after(() => getMock.mock.restore());

  const injector = createInjector();
  const release = await injector.fetchLatestRtkRelease();
  const [, requestConfig] = getMock.mock.calls[0].arguments;

  assert.equal(release.tagName, "v0.30.0");
  assert.equal(requestConfig.headers.Authorization, "Bearer primary-token");
});

test("falls back to GH_TOKEN when GITHUB_TOKEN is blank", async (t) => {
  const envSnapshot = snapshotEnv(ENV_KEYS);
  t.after(() => restoreEnv(envSnapshot));
  clearEnv(ENV_KEYS);

  process.env.GITHUB_TOKEN = "   ";
  process.env.GH_TOKEN = "fallback-token";

  const getMock = mock.method(axios, "get", async () => createReleaseResponse());
  t.after(() => getMock.mock.restore());

  const injector = createInjector();
  await injector.fetchLatestRtkRelease();
  const [, requestConfig] = getMock.mock.calls[0].arguments;

  assert.equal(requestConfig.headers.Authorization, "Bearer fallback-token");
});

test("skips latest release lookup when an explicit rtk version is provided", async (t) => {
  const envSnapshot = snapshotEnv(ENV_KEYS);
  t.after(() => restoreEnv(envSnapshot));
  clearEnv(ENV_KEYS);

  const getMock = mock.method(axios, "get", async () => createReleaseResponse());
  t.after(() => getMock.mock.restore());

  const injector = createInjector({ version: "v0.30.0" });
  await injector.resolveRtkVersion();

  assert.equal(getMock.mock.calls.length, 0);
  assert.equal(injector.runtimeInfo.version, "v0.30.0");
});

test("shows an actionable 403 error without leaking tokens", async (t) => {
  const envSnapshot = snapshotEnv(ENV_KEYS);
  t.after(() => restoreEnv(envSnapshot));
  clearEnv(ENV_KEYS);

  const getMock = mock.method(axios, "get", async () => {
    throw createAxiosError(403, "API rate limit exceeded for 127.0.0.1.");
  });
  t.after(() => getMock.mock.restore());

  const injector = createInjector();

  await assert.rejects(
    () => injector.fetchLatestRtkRelease(),
    (error) => {
      assert.match(error.message, /GITHUB_TOKEN/);
      assert.match(error.message, /GH_TOKEN/);
      assert.match(error.message, /--runtime-version/);
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    }
  );
});

test("shows an actionable 401 error without leaking tokens", async (t) => {
  const envSnapshot = snapshotEnv(ENV_KEYS);
  t.after(() => restoreEnv(envSnapshot));
  clearEnv(ENV_KEYS);

  process.env.GITHUB_TOKEN = "token-from-env";

  const getMock = mock.method(axios, "get", async () => {
    throw createAxiosError(401, "Bad credentials", "Bearer token-from-env");
  });
  t.after(() => getMock.mock.restore());

  const injector = createInjector();

  await assert.rejects(
    () => injector.fetchLatestRtkRelease(),
    (error) => {
      assert.match(error.message, /authenticate with GitHub/i);
      assert.match(error.message, /GITHUB_TOKEN/);
      assert.match(error.message, /GH_TOKEN/);
      assert.doesNotMatch(error.message, /token-from-env/);
      return true;
    }
  );
});

test("uses HTTPS_PROXY for the GitHub latest release request", async (t) => {
  const envSnapshot = snapshotEnv(ENV_KEYS);
  t.after(() => restoreEnv(envSnapshot));
  clearEnv(ENV_KEYS);

  process.env.HTTPS_PROXY = "http://user:pass@proxy.example.com:8443";

  const getMock = mock.method(axios, "get", async () => createReleaseResponse());
  t.after(() => getMock.mock.restore());

  const injector = createInjector();
  await injector.fetchLatestRtkRelease();
  const [, requestConfig] = getMock.mock.calls[0].arguments;

  assert.deepEqual(requestConfig.proxy, {
    protocol: "http:",
    host: "proxy.example.com",
    port: 8443,
    auth: {
      username: "user",
      password: "pass",
    },
  });
});

test("respects NO_PROXY for the GitHub latest release request", async (t) => {
  const envSnapshot = snapshotEnv(ENV_KEYS);
  t.after(() => restoreEnv(envSnapshot));
  clearEnv(ENV_KEYS);

  process.env.HTTPS_PROXY = "http://proxy.example.com:8443";
  process.env.NO_PROXY = "api.github.com";

  const getMock = mock.method(axios, "get", async () => createReleaseResponse());
  t.after(() => getMock.mock.restore());

  const injector = createInjector();
  await injector.fetchLatestRtkRelease();
  const [, requestConfig] = getMock.mock.calls[0].arguments;

  assert.equal(requestConfig.proxy, false);
});
