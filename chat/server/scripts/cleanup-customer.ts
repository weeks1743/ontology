#!/usr/bin/env node
import process from "node:process";

const CHAT_SERVER_BASE_URL = process.env.CHAT_SERVER_BASE_URL ?? "http://127.0.0.1:8123";

function parseArgs(argv: string[]) {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--customer-id") {
      result.customer_id = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--customer-name") {
      result.customer_name = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      result.dry_run = true;
      continue;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.customer_id && !args.customer_name) {
    console.error("Usage: tsx scripts/cleanup-customer.ts --customer-id <id> | --customer-name <name> [--dry-run]");
    process.exit(1);
  }

  const response = await fetch(`${CHAT_SERVER_BASE_URL}/api/admin/cleanup-customer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const payload = await response.text();
  console.log(payload);
  if (!response.ok) {
    process.exit(1);
  }
}

void main();
