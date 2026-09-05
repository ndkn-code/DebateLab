import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Execute the actual migration in PostgreSQL, with only its existing table
// dependencies modeled here. No production credentials or network are used.
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260905170000_duel_explicit_ai_choice.sql",
    import.meta.url,
  ),
  "utf8",
);
const legacy = readFileSync(
  new URL(
    "../supabase/migrations/008_duel_matchmaking_mmr_integrity.sql",
    import.meta.url,
  ),
  "utf8",
);
const cancelSql = legacy.slice(
  legacy.indexOf(
    "create or replace function public.cancel_debate_duel_matchmaking(",
  ),
  legacy.indexOf(
    "revoke execute on function public.cancel_debate_duel_matchmaking(",
  ),
);
const human = "00000000-0000-4000-8000-000000000001";
const ai = "00000000-0000-4000-8000-000000000002";
const ticket = "00000000-0000-4000-8000-000000000003";
async function fixture(status = "queued", expired = false) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor', true), '')::uuid $$;
    create table profiles (id uuid primary key, orb_balance integer, display_name text, avatar_url text);
    create table debate_duels (id uuid primary key default gen_random_uuid(), share_code text, creator_id uuid,
      practice_topic_key text, topic_title text, topic_category text, topic_category_key text, topic_difficulty text,
      topic_description text, practice_language text, prep_time_seconds integer, opening_time_seconds integer,
      rebuttal_time_seconds integer, entry_cost integer, side_assignment_mode text, creator_side_preference text,
      duel_kind text, rated boolean, ai_opponent boolean, status text, current_phase text, phase_started_at timestamptz, started_at timestamptz);
    create table debate_duel_matchmaking_tickets (id uuid primary key, user_id uuid, status text, matched_duel_id uuid,
      matched_at timestamptz, updated_at timestamptz, expires_at timestamptz, practice_language text,
      topic_category_key text, topic_difficulty text, prep_time_seconds integer, opening_time_seconds integer, rebuttal_time_seconds integer);
    create table orb_transactions (user_id uuid, amount integer, type text, reference_id uuid, balance_after integer);
    create table debate_duel_participants (duel_id uuid, user_id uuid, role text, ready_at timestamptz,
      credits_charged_at timestamptz, display_name_snapshot text, avatar_url_snapshot text);
    create function generate_duel_share_code() returns text language sql as $$ select upper(substr(md5(random()::text),1,6)) $$;
    insert into profiles values ('${human}',1250,'QA human',null),('${ai}',0,'QA AI',null);
    insert into debate_duel_matchmaking_tickets values ('${ticket}','${human}','${status}',null,null,now(),
      now() ${expired ? "-" : "+"} interval '10 minutes','vi','education','beginner',120,180,120);
  `);
  await db.exec(
    "alter table debate_duel_matchmaking_tickets add column cancelled_at timestamptz;",
  );
  await db.exec(migration);
  await db.exec(cancelSql);
  await db.query("select set_config('test.actor', $1, false)", [human]);
  return db;
}
async function choose(db: PGlite, ticketId = ticket) {
  const result = await db.query<{ code: string }>(
    `select create_ai_backfill_duel($1::uuid,$2::uuid,null,'QA original motion','Education','education','beginner','','vi',120,180,120,$3::uuid) as code`,
    [human, ai, ticketId],
  );
  return result.rows[0].code;
}
async function balance(db: PGlite) {
  return (
    await db.query<{ orb_balance: number }>(
      "select orb_balance from profiles where id=$1",
      [human],
    )
  ).rows[0].orb_balance;
}

test("explicit AI choice starts one unrated duel and retries charge exactly once", async () => {
  const db = await fixture();
  try {
    const code = await choose(db);
    assert.equal(await choose(db), code);
    assert.equal(await balance(db), 1050);
    assert.equal(
      (await db.query("select * from orb_transactions")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from debate_duel_participants")).rows.length,
      2,
    );
    assert.deepEqual(
      (
        await db.query(
          "select ai_opponent,rated,status,current_phase from debate_duels",
        )
      ).rows,
      [
        {
          ai_opponent: true,
          rated: false,
          status: "in_progress",
          current_phase: "prep",
        },
      ],
    );
  } finally {
    await db.close();
  }
});
for (const [status, expired] of [
  ["cancelled", false],
  ["expired", true],
  ["queued", true],
] as const) {
  test(`late AI request cannot charge ${status}${expired ? "/expired" : ""} ticket`, async () => {
    const db = await fixture(status, expired);
    try {
      await assert.rejects(choose(db), /TICKET_NOT_QUEUED/);
      assert.equal(await balance(db), 1250);
    } finally {
      await db.close();
    }
  });
}
test("a human match winning the ticket returns that room without AI creation or charge", async () => {
  const db = await fixture();
  try {
    await db.exec(`insert into debate_duels (id,share_code,ai_opponent,status) values ('00000000-0000-4000-8000-000000000004','HUMAN1',false,'lobby');
      update debate_duel_matchmaking_tickets set status='matched',matched_duel_id='00000000-0000-4000-8000-000000000004' where id='${ticket}';`);
    assert.equal(await choose(db), "HUMAN1");
    assert.equal(await balance(db), 1250);
    assert.equal(
      (await db.query("select * from orb_transactions")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
test("missing, foreign-owned, and changed-setting tickets fail closed", async () => {
  const db = await fixture();
  try {
    await assert.rejects(choose(db, ai), /TICKET_NOT_FOUND/);
    await db.query("select set_config('test.actor', $1, false)", [ai]);
    await assert.rejects(choose(db), /FORBIDDEN/);
    await db.query("select set_config('test.actor', $1, false)", [human]);
    await db.exec(
      `update debate_duel_matchmaking_tickets set opening_time_seconds=300`,
    );
    await assert.rejects(choose(db), /TICKET_SETTINGS_CHANGED/);
    assert.equal(await balance(db), 1250);
  } finally {
    await db.close();
  }
});

test("the actual cancellation RPC winning first prevents a late AI charge", async () => {
  const db = await fixture();
  try {
    await db.query("select cancel_debate_duel_matchmaking($1::uuid,$2::uuid)", [
      ticket,
      human,
    ]);
    await assert.rejects(choose(db), /TICKET_NOT_QUEUED/);
    assert.equal(await balance(db), 1250);
    assert.equal((await db.query("select * from debate_duels")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("AI winning first remains recoverable and cancellation cannot double-charge or undo the ledger", async () => {
  const db = await fixture();
  try {
    const code = await choose(db);
    await db.query("select cancel_debate_duel_matchmaking($1::uuid,$2::uuid)", [
      ticket,
      human,
    ]);
    assert.equal(await choose(db), code);
    assert.equal(await balance(db), 1050);
    assert.equal(
      (await db.query("select * from orb_transactions")).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
