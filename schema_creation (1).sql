-- =============================================================
--  Wedding Planner
-- =============================================================

DROP SCHEMA IF EXISTS project CASCADE;
CREATE SCHEMA project;
SET search_path TO project;

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE "user" (
    user_id        SERIAL PRIMARY KEY,
    first_name     VARCHAR(50)  NOT NULL,
    last_name      VARCHAR(50)  NOT NULL,
    email          VARCHAR(120) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL DEFAULT '',   -- added for login
    phone_number   VARCHAR(30),
    gender         VARCHAR(20),
    birthday       DATE
);

-- ── Weddings ────────────────────────────────────────────────
CREATE TABLE wedding (
    wedding_id SERIAL PRIMARY KEY,
    "date"     DATE           NOT NULL,
    budget     NUMERIC(12,2),
    notes      TEXT,
    user_id    INTEGER        NOT NULL,
    CONSTRAINT fk_wedding_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ── Churches ────────────────────────────────────────────────
CREATE TABLE church (
    church_id  SERIAL PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    location   VARCHAR(150) NOT NULL,
    contact    VARCHAR(120) NOT NULL,
    wedding_id INTEGER UNIQUE,
    CONSTRAINT fk_church_wedding
        FOREIGN KEY (wedding_id) REFERENCES wedding(wedding_id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ── Priests ─────────────────────────────────────────────────
CREATE TABLE priest (
    priest_id  SERIAL PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    contact    VARCHAR(120) NOT NULL,
    church_id  INTEGER      NOT NULL,
    CONSTRAINT fk_priest_church
        FOREIGN KEY (church_id) REFERENCES church(church_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ── Church Bookings ─────────────────────────────────────────
CREATE TABLE church_booking (
    booking_id SERIAL PRIMARY KEY,
    "date"     DATE        NOT NULL,
    start_time TIME        NOT NULL,
    end_time   TIME        NOT NULL,
    status     VARCHAR(30) NOT NULL,
    church_id  INTEGER     NOT NULL,
    wedding_id INTEGER     NOT NULL,
    CONSTRAINT fk_cb_church  FOREIGN KEY (church_id)  REFERENCES church(church_id)   ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_cb_wedding FOREIGN KEY (wedding_id) REFERENCES wedding(wedding_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_cb_time   CHECK (end_time > start_time)
);

-- ── Events ──────────────────────────────────────────────────
CREATE TABLE event (
    event_id   SERIAL PRIMARY KEY,
    event_type VARCHAR(60) NOT NULL,
    "date"     DATE        NOT NULL,
    start_time TIME        NOT NULL,
    end_time   TIME        NOT NULL,
    status     VARCHAR(30) NOT NULL,
    wedding_id INTEGER     NOT NULL,
    CONSTRAINT fk_event_wedding
        FOREIGN KEY (wedding_id) REFERENCES wedding(wedding_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_event_time CHECK (end_time > start_time)
);

-- ── Guests ──────────────────────────────────────────────────
CREATE TABLE guest (
    guest_id   SERIAL PRIMARY KEY,
    first_name VARCHAR(50)  NOT NULL,
    last_name  VARCHAR(50)  NOT NULL,
    email      VARCHAR(120),
    wedding_id INTEGER      NOT NULL,
    CONSTRAINT fk_guest_wedding
        FOREIGN KEY (wedding_id) REFERENCES wedding(wedding_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ── RSVP ────────────────────────────────────────────────────
CREATE TABLE event_rsvp (
    response_id   SERIAL PRIMARY KEY,
    status        VARCHAR(30) NOT NULL,
    response_date DATE        NOT NULL,
    guest_id      INTEGER     NOT NULL,
    event_id      INTEGER     NOT NULL,
    CONSTRAINT fk_rsvp_guest  FOREIGN KEY (guest_id)  REFERENCES guest(guest_id)  ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rsvp_event  FOREIGN KEY (event_id)  REFERENCES event(event_id)  ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_rsvp_guest_event UNIQUE (guest_id, event_id)
);

-- ── Attendance / Seating ─────────────────────────────────────
CREATE TABLE attendance (
    attendance_id SERIAL PRIMARY KEY,
    status        VARCHAR(30) NOT NULL,
    table_number  INTEGER,
    role          VARCHAR(40) NOT NULL,
    guest_id      INTEGER     NOT NULL,
    event_id      INTEGER     NOT NULL,
    CONSTRAINT fk_att_guest  FOREIGN KEY (guest_id)  REFERENCES guest(guest_id)  ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_att_event  FOREIGN KEY (event_id)  REFERENCES event(event_id)  ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_att_guest_event UNIQUE (guest_id, event_id),
    CONSTRAINT chk_table_number CHECK (table_number IS NULL OR table_number > 0)
);

-- ── Venue Types ─────────────────────────────────────────────
CREATE TABLE venue_type (
    type_id   SERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE
);

-- ── Venues ──────────────────────────────────────────────────
CREATE TABLE venue (
    venue_id        SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    location        VARCHAR(150) NOT NULL,
    city            VARCHAR(80)  NOT NULL,
    address         VARCHAR(150) NOT NULL,
    capacity        INTEGER      NOT NULL,
    menu            TEXT,
    phone_number    VARCHAR(30),
    price_per_guest NUMERIC(10,2) NOT NULL,
    type_id         INTEGER      NOT NULL,
    CONSTRAINT fk_venue_type     FOREIGN KEY (type_id) REFERENCES venue_type(type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_capacity      CHECK (capacity > 0),
    CONSTRAINT chk_price_per_guest CHECK (price_per_guest >= 0)
);

-- ── Venue Bookings ───────────────────────────────────────────
CREATE TABLE venue_booking (
    booking_id SERIAL PRIMARY KEY,
    "date"     DATE          NOT NULL,
    start_time TIME          NOT NULL,
    end_time   TIME          NOT NULL,
    status     VARCHAR(30)   NOT NULL,
    price      NUMERIC(12,2) NOT NULL,
    venue_id   INTEGER       NOT NULL,
    wedding_id INTEGER       NOT NULL,
    CONSTRAINT fk_vb_venue   FOREIGN KEY (venue_id)   REFERENCES venue(venue_id)     ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_vb_wedding FOREIGN KEY (wedding_id) REFERENCES wedding(wedding_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_vb_time   CHECK (end_time > start_time)
);

-- ── Photographers ────────────────────────────────────────────
CREATE TABLE photographer (
    photographer_id SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(120) NOT NULL UNIQUE,
    phone_number    VARCHAR(30)  NOT NULL,
    price_per_hour  NUMERIC(10,2) NOT NULL,
    CONSTRAINT chk_ph_price CHECK (price_per_hour >= 0)
);

-- ── Photographer Bookings ────────────────────────────────────
CREATE TABLE photographer_booking (
    booking_id      SERIAL PRIMARY KEY,
    "date"          DATE        NOT NULL,
    start_time      TIME        NOT NULL,
    end_time        TIME        NOT NULL,
    status          VARCHAR(30) NOT NULL,
    photographer_id INTEGER     NOT NULL,
    wedding_id      INTEGER     NOT NULL,
    CONSTRAINT fk_pb_photographer FOREIGN KEY (photographer_id) REFERENCES photographer(photographer_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pb_wedding      FOREIGN KEY (wedding_id)      REFERENCES wedding(wedding_id)           ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_pb_time        CHECK (end_time > start_time)
);

-- ── Bands ────────────────────────────────────────────────────
CREATE TABLE band (
    band_id        SERIAL PRIMARY KEY,
    band_name      VARCHAR(120) NOT NULL,
    genre          VARCHAR(60)  NOT NULL,
    equipment      TEXT,
    phone_number   VARCHAR(30)  NOT NULL,
    price_per_hour NUMERIC(10,2) NOT NULL,
    CONSTRAINT chk_band_price CHECK (price_per_hour >= 0)
);

-- ── Band Bookings ────────────────────────────────────────────
CREATE TABLE band_booking (
    booking_id SERIAL PRIMARY KEY,
    "date"     DATE        NOT NULL,
    start_time TIME        NOT NULL,
    end_time   TIME        NOT NULL,
    status     VARCHAR(30) NOT NULL,
    band_id    INTEGER     NOT NULL,
    wedding_id INTEGER     NOT NULL,
    CONSTRAINT fk_bb_band    FOREIGN KEY (band_id)    REFERENCES band(band_id)        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_bb_wedding FOREIGN KEY (wedding_id) REFERENCES wedding(wedding_id)  ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_bb_time   CHECK (end_time > start_time)
);

-- ── Registrars (NEW — was in HTML but missing from original schema) ──
CREATE TABLE registrar (
    registrar_id  SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    contact       VARCHAR(120) NOT NULL,
    location      VARCHAR(150) NOT NULL,
    working_hours VARCHAR(60)
);

-- ── Registrar Bookings (NEW) ─────────────────────────────────
CREATE TABLE registrar_booking (
    booking_id    SERIAL PRIMARY KEY,
    "date"        DATE        NOT NULL,
    start_time    TIME        NOT NULL,
    end_time      TIME        NOT NULL,
    status        VARCHAR(30) NOT NULL,
    registrar_id  INTEGER     NOT NULL,
    wedding_id    INTEGER     NOT NULL,
    CONSTRAINT fk_rb_registrar FOREIGN KEY (registrar_id) REFERENCES registrar(registrar_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rb_wedding   FOREIGN KEY (wedding_id)   REFERENCES wedding(wedding_id)     ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_rb_time     CHECK (end_time > start_time)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_wedding_user   ON wedding(user_id);
CREATE INDEX idx_event_wedding  ON event(wedding_id);
CREATE INDEX idx_guest_wedding  ON guest(wedding_id);
CREATE INDEX idx_vb_wedding     ON venue_booking(wedding_id);
CREATE INDEX idx_vb_venue       ON venue_booking(venue_id);
CREATE INDEX idx_pb_wedding     ON photographer_booking(wedding_id);
CREATE INDEX idx_bb_wedding     ON band_booking(wedding_id);
CREATE INDEX idx_rb_wedding     ON registrar_booking(wedding_id);
CREATE INDEX idx_rsvp_event     ON event_rsvp(event_id);
CREATE INDEX idx_att_event      ON attendance(event_id);
