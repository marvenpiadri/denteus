CREATE TABLE clinic_providers (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 160),
  role text NOT NULL CHECK (role IN ('DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'SPECIALIST')),
  color text NOT NULL DEFAULT '#087f75' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, clinic_id, id),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX clinic_providers_active_idx
  ON clinic_providers(organization_id, clinic_id, active, display_name);

CREATE TABLE clinic_operatories (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  chair_number integer CHECK (chair_number IS NULL OR chair_number BETWEEN 1 AND 999),
  color text NOT NULL DEFAULT '#267d93' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, clinic_id, id),
  UNIQUE (organization_id, clinic_id, name),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX clinic_operatories_active_idx
  ON clinic_operatories(organization_id, clinic_id, active, name);

CREATE TABLE provider_working_hours (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  provider_id text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (organization_id, clinic_id, provider_id, day_of_week),
  FOREIGN KEY (organization_id, clinic_id, provider_id)
    REFERENCES clinic_providers(organization_id, clinic_id, id) ON DELETE CASCADE
);

ALTER TABLE appointments
  ADD COLUMN provider_id text,
  ADD COLUMN operatory_id text,
  ADD CONSTRAINT appointments_provider_fk
    FOREIGN KEY (organization_id, clinic_id, provider_id)
    REFERENCES clinic_providers(organization_id, clinic_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_operatory_fk
    FOREIGN KEY (organization_id, clinic_id, operatory_id)
    REFERENCES clinic_operatories(organization_id, clinic_id, id) ON DELETE RESTRICT;

CREATE INDEX appointments_provider_schedule_idx
  ON appointments(organization_id, clinic_id, provider_id, starts_at, ends_at)
  WHERE provider_id IS NOT NULL AND status NOT IN ('CANCELLED', 'NO_SHOW');
CREATE INDEX appointments_operatory_schedule_idx
  ON appointments(organization_id, clinic_id, operatory_id, starts_at, ends_at)
  WHERE operatory_id IS NOT NULL AND status NOT IN ('CANCELLED', 'NO_SHOW');
