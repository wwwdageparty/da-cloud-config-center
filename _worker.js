/*
  ==========================================================
   DaCloud Config Center — DCCC
   Part of the DaSystem Cloud Suite
  ==========================================================
   A lightweight Cloudflare Workers microservice for
   distributed configuration storage, version control,
   and secure secret indirection.

  ✅ Overview
  ----------------------------------------------------------
  • Key–value config store per service/instance/key
  • Hierarchical fallback lookup (service → global)
  • Lightweight REST API for CRUD operations
  • System-reserved table for version & metadata
  • Optional KV-based secret indirection (DASECRET_*)
  • Consistent schema across all DaSystem modules

  🔒 Security & Access
  ----------------------------------------------------------
  • Read operations require DA_READTOKEN
  • Write & system init require DA_WRITETOKEN
  • Secrets must use prefix "DASECRET_" and are resolved
    via /secret endpoint with read authorization only
  • Secret values are never stored in plaintext in DB;
    only the secret name is referenced

  ⚙️ Environment Bindings
  ----------------------------------------------------------
  DB              → Cloudflare D1 database binding
  SECRETS_KV      → (optional) KV namespace for secrets
  DA_WRITETOKEN   → Required for write & /systeminit
  DA_READTOKEN    → Required for read /secret /config

  🧱 Tables
  ----------------------------------------------------------
  • configs             → main config entries
  • __DA_SYSTEM_CONFIG  → system metadata & version info

  📦 API Endpoints
  ----------------------------------------------------------
  POST   /systeminit                       → initialize tables
  GET    /config?service=&instance=&key=   → get config (with fallback)
  PUT    /config                           → set/update config
  DELETE /config?service=&instance=&key=   → delete config
  GET    /configs?service=&instance=       → list configs
  GET    /secret?name=DASECRET_xxx         → resolve secret value
*/


/////////////////////////   Worker Entry   /////////////////////////
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    G_DB = env.DB;
    G_ENV = env;

    // System init
    if (pathname === "/systeminit" && request.method === "POST") {
      return await systemInit(request);
    }

    // Config CRUD endpoints
    if (pathname === "/config" && request.method === "GET") {
      return await handleGetConfig(request);
    }
    if (pathname === "/secret" && request.method === "GET") {
      return await handleGetSecret(request);
    }
    if (pathname === "/config" && request.method === "PUT") {
      return await putConfig(request);
    }
    if (pathname === "/config" && request.method === "DELETE") {
      return await deleteConfig(request);
    }
    if (pathname === "/configs" && request.method === "GET") {
      return await listConfigs(request);
    }

    return new Response("Not found", { status: 404 });
  },
};

/////////////////////////   Config Operations   /////////////////////////
async function getConfigValueWithFallback(db, service, instance, key) {
  const levels = [
    { c1: service, c2: instance, c3: key },
    { c1: service, c2: "", c3: key },
    { c1: "", c2: "", c3: key },
  ];

  for (const level of levels) {
    const row = await db.prepare(
      "SELECT t1, v1 FROM configs WHERE c1=? AND c2=? AND c3=? LIMIT 1"
    ).bind(level.c1, level.c2, level.c3).first();

    if (row) {
      return { value: row.t1, source: level };
    }
  }
  return null;
}

async function handleGetConfig(request) {
  const unauthorized = checkAuthorizationRead(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const service = url.searchParams.get("service") || "";
  const instance = url.searchParams.get("instance") || "";
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });

  const result = await getConfigValueWithFallback(G_DB, service, instance, key);

  if (!result)
    return new Response(JSON.stringify({ found: false }), { status: 404 });

  return new Response(JSON.stringify({
    found: true,
    key,
    value: result.value,
    source: result.source,
  }), { headers: { "Content-Type": "application/json" } });
}

async function handleGetSecret(request) {
  const unauthorized = checkAuthorizationRead(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  if (!name) return jsonError("Missing secret name", 400);
  if (!name.startsWith(C_SECRET_PREFIX)) {
    return jsonError("Invalid secret name", 400);
  }
  let realValue = G_ENV[name];
  if (!realValue && G_ENV.SECRETS_KV) {
    realValue = await G_ENV.SECRETS_KV.get(name);
  }
  if (!realValue) return jsonError("Secret not found", 404);
  return jsonSuccess({ value: realValue });
}


async function putConfig(request) {
  const unauthorized = checkAuthorizationWrite(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    let { service, instance, key, value } = body;

    service = service ?? "";
    instance = instance ?? "";

    if (!key) return jsonError("Missing required field: key", 400);

    await G_DB.prepare(
      `INSERT OR REPLACE INTO configs (c1, c2, c3, t1, v1)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(service, instance, key, value ?? "")
      .run();

    return jsonSuccess({
      success: true,
      entry: { service, instance, key, value },
    });
  } catch (err) {
    return jsonError(err.message, 500);
  }
}


async function deleteConfig(request) {
  const unauthorized = checkAuthorizationWrite(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  let service = searchParams.get("service");
  let instance = searchParams.get("instance");
  const key = searchParams.get("key");

  service = service ?? "";
  instance = instance ?? "";

  if (!key)
    return jsonError("Missing required field: key", 400);

  try {
    const result = await G_DB.prepare(
      `DELETE FROM configs WHERE c1=? AND c2=? AND c3=?`
    ).bind(service, instance, key).run();

    return jsonSuccess({
      success: true,
      deleted: {
        service,
        instance,
        key,
        changes: result.meta?.changes ?? 0,
      },
    });
  } catch (err) {
    return jsonError(err.message, 500);
  }
}


async function listConfigs(request) {
  const unauthorized = checkAuthorizationRead(request);
  if (unauthorized) return unauthorized;
  
  const { searchParams } = new URL(request.url);
  let service = searchParams.get("service");
  let instance = searchParams.get("instance");

  service = service ?? "";
  instance = instance ?? "";

  try {
    let sql = `SELECT c1 AS service, c2 AS instance, c3 AS key, t1 AS value, v1 AS created_at FROM configs`;
    const filters = [];
    const values = [];

    // Add WHERE conditions dynamically
    if (service !== "") {
      filters.push("c1 = ?");
      values.push(service);
    }
    if (instance !== "") {
      filters.push("c2 = ?");
      values.push(instance);
    }

    if (filters.length > 0) {
      sql += " WHERE " + filters.join(" AND ");
    }

    sql += " ORDER BY c1, c2, c3";

    const result = await G_DB.prepare(sql).bind(...values).all();
    const configs = result.results || [];

    return jsonSuccess({
      success: true,
      count: configs.length,
      configs,
    });
  } catch (err) {
    return jsonError(err.message, 500);
  }
}


/////////////////////////   System Init   /////////////////////////
async function systemInit(request) {
  const unauthorized = checkAuthorizationWrite(request);
  if (unauthorized) return unauthorized;

  const responseHeaders = { "Content-Type": "application/json" };
  const summary = { ok: false, steps: [] };

  try {
    await daSystemTableInit(G_DB);
    summary.steps.push("System config table initialized.");

    await configTableInit(G_DB);
    summary.steps.push("Config table initialized.");

    summary.ok = true;
    return new Response(
      JSON.stringify({
        success: true,
        message: "System and Config Service initialized successfully.",
        details: summary.steps,
      }),
      { headers: responseHeaders, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || String(err),
        details: summary.steps,
      }),
      { headers: responseHeaders, status: 500 }
    );
  }
}

/////////////////////////   Schema Builders   /////////////////////////
async function configTableInit(db) {
  const tableName = "configs";
  await createDaTableSchema(db, tableName);

  const indexStatements = [
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_${tableName}_c1_c2_c3 ON ${tableName}(c1, c2, c3);`,
    `CREATE INDEX IF NOT EXISTS idx_${tableName}_c1 ON ${tableName}(c1);`,
    `CREATE INDEX IF NOT EXISTS idx_${tableName}_c2 ON ${tableName}(c2);`,
    `CREATE INDEX IF NOT EXISTS idx_${tableName}_v1 ON ${tableName}(v1);`,
  ];
  for (const stmt of indexStatements) {
    await db.exec(stmt);
  }

  console.log(`✅ Config table '${tableName}' and indexes initialized.`);
}

async function createDaTableSchema(db, tableName) {
  const schema = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      c1 VARCHAR(255),
      c2 VARCHAR(255),
      c3 VARCHAR(255),
      i1 INT,
      i2 INT,
      i3 INT,
      d1 DOUBLE,
      d2 DOUBLE,
      d3 DOUBLE,
      t1 TEXT,
      t2 TEXT,
      t3 TEXT,
      v1 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      v2 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      v3 TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await db.prepare(schema).run();
}

async function daSystemTableInit(db) {
  const tableName = "__DA_SYSTEM_CONFIG";
  await createDaTableSchema(db, tableName);

  const newUuid = crypto.randomUUID();
  const configUuid = crypto.randomUUID();

  const queries = [
    {
      desc: "Insert DB version record",
      sql: `INSERT OR IGNORE INTO ${tableName} (id, c1, c2, i1, d1)
            VALUES (1, '___basic_db_version', ?, ?, ?);`,
      params: [newUuid, DB_VERSION, DB_VERSION],
    },
    {
      desc: "Insert system reserve record",
      sql: `INSERT OR IGNORE INTO ${tableName} (id, c1)
            VALUES (100, '___systemReserve');`,
    },
    {
      desc: "Insert or replace config service version",
      sql: `INSERT OR REPLACE INTO ${tableName} (id, c1, c2, i1, t1)
            VALUES (102, '___config_service_version', ?, ?, ?);`,
      params: [configUuid, CONFIG_SERVICE_VERSION, 'configs schema v1'],
    },
  ];

  for (const q of queries) {
    const stmt = q.params
      ? db.prepare(q.sql).bind(...q.params)
      : db.prepare(q.sql);
    await stmt.run();
  }

  console.log(`✅ System table '${tableName}' initialized.`);
}

/////////////////////////   Auth   /////////////////////////
function checkAuthorizationRead(request) {
  return checkAuthorization(request, G_ENV.DA_READTOKEN);
}
function checkAuthorizationWrite(request) {
  return checkAuthorization(request, G_ENV.DA_WRITETOKEN);
}
function checkAuthorization(request, expected) {
  if (!expected || expected.trim() === "") return null;
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (token !== expected) {
    return jsonError("Unauthorized", 401);
  }
  return null;
}

/////////////////////////   Utilities   /////////////////////////
function jsonError(msg, code = 400) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
}
function jsonSuccess(data) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { "Content-Type": "application/json" },
  });
}

/////////////////////////   Globals   /////////////////////////
let G_DB = null;
let G_ENV = null;
const DB_VERSION = 1;
const CONFIG_SERVICE_VERSION = 1;
const C_SECRET_PREFIX = "DASECRET_";
