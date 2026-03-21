/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });
import { Redis, s } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const schema = s.object({
  id: s.string().noTokenize(),
  customerName: s.string(),
  customerEmail: s.string().noTokenize(),
  status: s.keyword(),
});

const index = redis.search.index({ name: "orders", schema });

async function run() {
  await index.waitIndexing();

  const all = await index.query({
    filter: {},
    select: { id: true, customerName: true, status: true },
    limit: 10,
  });
  console.log("All orders:", JSON.stringify(all, null, 2));

  const byName = await index.query({
    filter: {
      $should: [{ customerName: "subho" }, { customerEmail: "subho" }],
    },
    select: { id: true, customerName: true },
    limit: 10,
  });
  console.log("Search 'subho':", JSON.stringify(byName, null, 2));

  const byStatus = await index.query({
    filter: { status: "PENDING" },
    select: { id: true, status: true },
    limit: 10,
  });
  console.log("Status PENDING:", JSON.stringify(byStatus, null, 2));
}

run().catch(console.error);
