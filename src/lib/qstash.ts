import { Client, Receiver } from "@upstash/qstash";
import { env } from "@/lib/env";

export const getQStashClient = (): Client =>
  new Client({ token: env.QSTASH_TOKEN ?? "" });

export const getQStashReceiver = (): Receiver =>
  new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY ?? "",
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY ?? "",
  });
