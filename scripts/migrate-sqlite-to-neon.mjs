import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";

const TABLE_ORDER = [
  "captain_accounts",
  "teams",
  "player_profiles",
  "captain_team_memberships",
  "captain_team_invitations",
  "players",
  "matches",
  "team_seasons",
  "fixtures",
  "player_profile_links",
  "season_player_stats",
  "season_fixtures",
  "synced_matches",
  "match_innings",
  "match_pairs",
  "match_overs",
  "match_deliveries",
  "match_performances",
  "performance_claims",
  "team_invitations",
  "match_comments",
  "match_kudos",
  "challenge_entries",
  "player_follows",
];

const BOOLEAN_COLUMNS = new Map([
  ["team_seasons", new Set(["is_current"])],
  ["season_player_stats", new Set(["active"])],
  ["match_deliveries", new Set(["is_extra"])],
]);

const BATCH_SIZE = 250;

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function hasSourceTable(sqlite, table) {
  return Boolean(
    sqlite
      .prepare("select 1 from sqlite_master where type = 'table' and name = ? limit 1")
      .get(table)
  );
}

function sourceColumns(sqlite, table) {
  return sqlite
    .prepare(`pragma table_info(${quoteIdentifier(table)})`)
    .all()
    .map((column) => column.name);
}

function destinationValue(table, column, value) {
  if (value === null || value === undefined) return null;
  if (BOOLEAN_COLUMNS.get(table)?.has(column)) return Boolean(value);
  return value;
}

function insertBatchQuery(table, columns, rows) {
  const values = [];
  let parameter = 1;
  const valueGroups = rows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(destinationValue(table, column, row[column]));
      return `$${parameter++}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  return {
    query: [
      `insert into ${quoteIdentifier(table)}`,
      `(${columns.map(quoteIdentifier).join(", ")})`,
      `values ${valueGroups.join(", ")}`,
    ].join(" "),
    values,
  };
}

async function destinationColumns(postgres, table) {
  const rows = await postgres.query(
    `select column_name
       from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position`,
    [table]
  );
  return rows.map((row) => row.column_name);
}

async function assertEmptyDestination(postgres) {
  const populated = [];
  for (const table of TABLE_ORDER) {
    const destination = await destinationColumns(postgres, table);
    if (destination.length === 0) {
      throw new Error(
        `Postgres table ${table} is missing. Run npm run db:migrate before copying SQLite data.`
      );
    }
    const [result] = await postgres.query(
      `select count(*)::int as count from ${quoteIdentifier(table)}`
    );
    if (Number(result.count) > 0) populated.push(table);
  }

  if (populated.length > 0) {
    throw new Error(
      `The Neon destination is not empty (${populated.join(", ")}). ` +
        "The importer stops to prevent duplicate or conflicting data."
    );
  }
}

async function resetSequence(postgres, table) {
  await postgres.query(
    `select setval(
       pg_get_serial_sequence($1, 'id'),
       coalesce(max(id), 1),
       count(*) > 0
     )
     from ${quoteIdentifier(table)}`,
    [table]
  );
}

async function copyTable({ sqlite, postgres, table, dryRun }) {
  if (!hasSourceTable(sqlite, table)) {
    console.log(`skip ${table}: not present in the SQLite source`);
    return 0;
  }

  const source = new Set(sourceColumns(sqlite, table));
  const destination = await destinationColumns(postgres, table);
  const columns = destination.filter((column) => source.has(column));
  if (columns.length === 0) throw new Error(`No compatible columns found for ${table}.`);

  const selectColumns = columns.map(quoteIdentifier).join(", ");
  const rows = sqlite
    .prepare(
      `select ${selectColumns} from ${quoteIdentifier(table)} order by ${quoteIdentifier("id")}`
    )
    .all();

  if (dryRun || rows.length === 0) {
    console.log(`${dryRun ? "check" : "copy"} ${table}: ${rows.length} row(s)`);
    return rows.length;
  }

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { query, values } = insertBatchQuery(table, columns, batch);
    await postgres.query(query, values);
  }

  await resetSequence(postgres, table);
  console.log(`copy ${table}: ${rows.length} row(s)`);
  return rows.length;
}

async function main() {
  const postgresUrl = requireEnvironment("POSTGRES_URL");
  const sqliteInput = process.env.SQLITE_PATH?.trim() || process.argv[2];
  if (!sqliteInput) {
    throw new Error(
      "Set SQLITE_PATH or pass the SQLite file path as the first command argument."
    );
  }

  const sqlitePath = resolve(sqliteInput);
  if (!existsSync(sqlitePath)) throw new Error(`SQLite database not found: ${sqlitePath}`);

  const dryRun = process.argv.includes("--dry-run");
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
  const postgres = neon(postgresUrl);

  try {
    await assertEmptyDestination(postgres);
    let total = 0;
    for (const table of TABLE_ORDER) {
      total += await copyTable({ sqlite, postgres, table, dryRun });
    }
    console.log(
      dryRun
        ? `Dry run complete: ${total} SQLite row(s) are ready to copy.`
        : `Migration complete: copied ${total} row(s) to Neon Postgres.`
    );
  } finally {
    sqlite.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
