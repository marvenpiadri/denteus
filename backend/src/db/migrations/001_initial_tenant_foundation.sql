CREATE TABLE app_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);

CREATE TABLE auth_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  account_id text NOT NULL,
  password_hash text,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_accounts_provider_account_unique UNIQUE (provider_id, account_id)
);
CREATE INDEX auth_accounts_user_id_idx ON auth_accounts(user_id);

CREATE TABLE auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications(identifier);

CREATE TABLE organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  currency char(3) NOT NULL DEFAULT 'MAD',
  locale text NOT NULL DEFAULT 'fr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$')
);

CREATE TABLE organization_memberships (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN',
    'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT',
    'RECEPTIONIST', 'ACCOUNTANT'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX organization_memberships_user_role_idx ON organization_memberships(user_id, role);

CREATE TABLE patient_number_counters (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number_year integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (organization_id, number_year)
);

CREATE TABLE clinics (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  address text,
  phone text,
  email text,
  timezone text NOT NULL DEFAULT 'Africa/Casablanca',
  opening_hours jsonb,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE INDEX clinics_organization_status_idx ON clinics(organization_id, status);
CREATE INDEX clinics_city_idx ON clinics(city);

CREATE TABLE clinic_memberships (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN',
    'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT',
    'RECEPTIONIST', 'ACCOUNTANT'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE
);
CREATE INDEX clinic_memberships_user_idx ON clinic_memberships(user_id);
CREATE INDEX clinic_memberships_org_clinic_idx ON clinic_memberships(organization_id, clinic_id);

CREATE TABLE patients (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date,
  gender text,
  national_id text,
  phone text,
  email text,
  address text,
  city text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, patient_number),
  UNIQUE (organization_id, id)
);
CREATE INDEX patients_org_name_idx ON patients(organization_id, last_name, first_name);
CREATE INDEX patients_org_phone_idx ON patients(organization_id, phone);
CREATE INDEX patients_org_email_idx ON patients(organization_id, email);

CREATE TABLE patient_clinics (
  organization_id text NOT NULL,
  patient_id text NOT NULL,
  clinic_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, clinic_id),
  UNIQUE (organization_id, patient_id, clinic_id),
  FOREIGN KEY (organization_id, patient_id)
    REFERENCES patients(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX patient_clinics_clinic_idx ON patient_clinics(clinic_id);

CREATE TABLE odontogram_records (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  status_payload jsonb NOT NULL,
  plan_payload jsonb,
  plan_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_id text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, clinic_id),
  FOREIGN KEY (organization_id, clinic_id)
    REFERENCES clinics(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, patient_id)
    REFERENCES patients(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, patient_id, clinic_id)
    REFERENCES patient_clinics(organization_id, patient_id, clinic_id) ON DELETE CASCADE
);
CREATE INDEX odontogram_records_org_clinic_idx ON odontogram_records(organization_id, clinic_id);

CREATE TABLE audit_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_created_idx ON audit_events(organization_id, created_at DESC);
CREATE INDEX audit_events_user_created_idx ON audit_events(user_id, created_at DESC);
