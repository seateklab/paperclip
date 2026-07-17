import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  companies,
  createDb,
  pluginConfig,
  plugins,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { pluginRegistryService } from "../services/plugin-registry.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres plugin registry tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("plugin company configuration", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-plugin-registry-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(pluginConfig);
    await db.delete(plugins);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("keeps one global row and one row per company for the same plugin", async () => {
    const pluginId = randomUUID();
    const companyA = randomUUID();
    const companyB = randomUUID();
    await db.insert(companies).values([
      { id: companyA, name: "Company A" },
      { id: companyB, name: "Company B" },
    ]);
    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip.registry.fixture",
      packageName: "paperclip-registry-fixture",
      version: "1.0.0",
      categories: [],
      manifestJson: {},
    });

    const registry = pluginRegistryService(db);
    const global = await registry.upsertConfig(pluginId, { configJson: { defaultModel: "global" } });
    const scopedA = await registry.upsertCompanyConfig(pluginId, companyA, { configJson: { apiKeyRef: "secret-a" } });
    const scopedB = await registry.upsertCompanyConfig(pluginId, companyB, { configJson: { apiKeyRef: "secret-b" } });

    expect(global.companyId).toBeNull();
    expect(scopedA.companyId).toBe(companyA);
    expect(scopedB.companyId).toBe(companyB);
    expect((await registry.getConfig(pluginId))?.configJson).toEqual({ defaultModel: "global" });
    expect((await registry.getCompanyConfig(pluginId, companyA))?.configJson).toEqual({ apiKeyRef: "secret-a" });
    expect((await registry.getCompanyConfig(pluginId, companyB))?.configJson).toEqual({ apiKeyRef: "secret-b" });

    await expect(
      db.insert(pluginConfig).values({ pluginId, configJson: { defaultModel: "duplicate" } }),
    ).rejects.toThrow();
    await expect(
      db.insert(pluginConfig).values({ pluginId, companyId: companyA, configJson: { apiKeyRef: "duplicate" } }),
    ).rejects.toThrow();
  });

  it("allows a nullable company foreign key for global configuration", async () => {
    const pluginId = randomUUID();
    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip.registry.global-fixture",
      packageName: "paperclip-registry-global-fixture",
      version: "1.0.0",
      categories: [],
      manifestJson: {},
    });

    const [row] = await db.insert(pluginConfig).values({
      pluginId,
      companyId: null,
      configJson: { enabled: true },
    }).returning();
    expect(row.companyId).toBeNull();
  });
});
