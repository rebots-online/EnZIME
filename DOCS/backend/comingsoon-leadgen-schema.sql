-- EnZIME — Coming-Soon LEAD-GEN schema  (pre-launch interest cultivation)
-- =========================================================================
-- SINGLE RECREATE SCRIPT — total-loss recoverable. Run as the postgres
-- superuser against the EXISTING Postgres (CT 112, alpine-postgresql,
-- 192.168.0.249:5432). Idempotent; safe to re-run.
--
--   ssh root@192.168.0.214 "pct exec 112 -- su postgres -c 'psql -v ON_ERROR_STOP=1 -d postgres'" < comingsoon-leadgen-schema.sql
--
-- NAMING (deliberate): this is the COMING-SOON LEAD-GEN store, NOT the
-- product database. The bare name `enzime` is RESERVED for the future
-- product DB. This pre-launch store is the database `enzime_comingsoon`;
-- because the DB name already disambiguates it, the tables stay short.
--
-- Channels: DOUBLE OPT-IN on BOTH email and SMS. SMS is delivered via the
-- operator-provided SMSC (hardware/software SMS centre + credentials,
-- supplied separately). A signup is only `confirmed` after the contact
-- actively confirms. Consent proof captured for TCPA (SMS) + GDPR/CASL.
-- =========================================================================

-- ---- 1. house admin role + database (run against 'postgres') ------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='admin') THEN
    CREATE ROLE admin LOGIN SUPERUSER PASSWORD 'Ch4n3l.C';
  ELSE
    ALTER ROLE admin LOGIN SUPERUSER PASSWORD 'Ch4n3l.C';
  END IF;
END $$;

SELECT 'CREATE DATABASE enzime_comingsoon OWNER admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='enzime_comingsoon')\gexec

\connect enzime_comingsoon
SET ROLE admin;   -- everything below is owned by admin

CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid(), token gen

-- ---- 2. signup row ------------------------------------------------------
CREATE TABLE IF NOT EXISTS signups (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    email                citext,
    phone_e164           text,            -- normalized +<country><national>, never raw user text

    -- interest (the "editions" framing)
    editions             text[] NOT NULL DEFAULT '{}',   -- prepper | policy-manual | diary | ...
    platforms            text[] NOT NULL DEFAULT '{}',   -- android | linux | windows
    message              text,
    source               text,            -- landing variant / utm / referral

    -- DOUBLE OPT-IN: EMAIL
    email_optin_at       timestamptz,     -- form submitted with the email-consent box ticked
    email_confirm_token  text,            -- random; emailed as a one-time confirm link
    email_confirmed_at   timestamptz,     -- link clicked  => deliverable

    -- DOUBLE OPT-IN: SMS  (TCPA: express written consent + confirmation via SMSC)
    sms_optin_at         timestamptz,     -- form submitted with the SMS-consent box ticked
    sms_confirm_code     text,            -- 6-digit; store a HASH in production
    sms_confirmed_at     timestamptz,     -- replied YES / entered code => deliverable
    sms_unsubscribed_at  timestamptz,     -- replied STOP

    -- CONSENT PROOF (store only what's needed)
    consent_version      text,            -- which on-page consent copy they agreed to
    consent_ip_hash      text,            -- sha256(ip || server_salt) — not the raw IP
    consent_user_agent   text,

    -- lifecycle
    status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','confirmed','unsubscribed','bounced')),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT signups_contact_present CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS signups_email_uq ON signups (email)      WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS signups_phone_uq ON signups (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS signups_created_idx ON signups (created_at);
CREATE INDEX IF NOT EXISTS signups_status_idx  ON signups (status);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_signups_updated ON signups;
CREATE TRIGGER trg_signups_updated BEFORE UPDATE ON signups
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---- 3. append-only consent audit (strongest opt-in proof) --------------
CREATE TABLE IF NOT EXISTS consent_events (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signup_id   uuid REFERENCES signups(id) ON DELETE CASCADE,
    channel     text NOT NULL CHECK (channel IN ('email','sms')),
    event       text NOT NULL CHECK (event IN ('optin','confirm','unsubscribe','bounce','resend')),
    detail      jsonb,            -- provider/SMSC message id, consent copy, etc.
    ip_hash     text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_events_signup_idx ON consent_events (signup_id);

-- ---- 4. confirmed, contactable view -------------------------------------
CREATE OR REPLACE VIEW confirmed AS
SELECT id, email, phone_e164, editions, platforms, source, created_at,
       (email_confirmed_at IS NOT NULL) AS email_ok,
       (sms_confirmed_at IS NOT NULL AND sms_unsubscribed_at IS NULL) AS sms_ok
FROM signups
WHERE status = 'confirmed';

-- ---- 5. least-privilege application role (signup API connects as this) ---
-- Role names are cluster-global (not per-DB), so this one stays distinguished.
-- Password kept cleartext-canonical (I-15) in ~/forgejo/Admin-Manual infra section.
-- Password follows the house convention (PASSWORDS.md): ALL database
-- passwords are 'Ch4n3l.C'. Do not invent a per-secret variant.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='enzime_comingsoon_app') THEN
    CREATE ROLE enzime_comingsoon_app LOGIN PASSWORD 'Ch4n3l.C';
  ELSE
    ALTER ROLE enzime_comingsoon_app LOGIN PASSWORD 'Ch4n3l.C';
  END IF;
END $$;
GRANT CONNECT ON DATABASE enzime_comingsoon TO enzime_comingsoon_app;
GRANT SELECT, INSERT, UPDATE ON signups, consent_events TO enzime_comingsoon_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO enzime_comingsoon_app;
-- enzime_comingsoon_app deliberately has NO DELETE and NO DDL.

RESET ROLE;
