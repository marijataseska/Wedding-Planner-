-- 1. Existing venue booking used for overlap testing
INSERT INTO venue_booking(
    "date",
    start_time,
    end_time,
    status,
    price,
    venue_id,
    wedding_id
)
VALUES (
    '2026-06-20',
    '18:00',
    '22:00',
    'confirmed',
    5000,
    1,
    1
);

-- Overlap case 1: starts inside existing interval
SELECT is_venue_available(1, '2026-06-20', '19:00', '23:00');
-- Expected result: FALSE

-- Overlap case 2: ends inside existing interval
SELECT is_venue_available(1, '2026-06-20', '16:00', '19:00');
-- Expected result: FALSE

-- Overlap case 3: fully contains existing interval
SELECT is_venue_available(1, '2026-06-20', '17:00', '23:00');
-- Expected result: FALSE

-- Overlap case 4: fully inside existing interval
SELECT is_venue_available(1, '2026-06-20', '19:00', '21:00');
-- Expected result: FALSE

-- Non-overlap case 1: ends before existing interval
SELECT is_venue_available(1, '2026-06-20', '14:00', '17:00');
-- Expected result: TRUE

-- Non-overlap case 2: starts after existing interval
SELECT is_venue_available(1, '2026-06-20', '22:00', '23:00');
-- Expected result: TRUE


-- 2. Existing photographer booking used for overlap testing
INSERT INTO photographer_booking(
    "date",
    start_time,
    end_time,
    status,
    photographer_id,
    wedding_id
)
VALUES (
    '2026-06-20',
    '18:00',
    '22:00',
    'confirmed',
    1,
    1
);

-- Photographer exact overlap test
SELECT is_photographer_available(1, '2026-06-20', '18:00', '22:00');
-- Expected result: FALSE

-- Photographer fully inside overlap test
SELECT is_photographer_available(1, '2026-06-20', '19:00', '21:00');
-- Expected result: FALSE


-- 3. Existing band booking used for overlap testing
INSERT INTO band_booking(
    "date",
    start_time,
    end_time,
    status,
    band_id,
    wedding_id
)
VALUES (
    '2026-06-20',
    '18:00',
    '22:00',
    'confirmed',
    1,
    1
);

-- Band exact overlap test
SELECT is_band_available(1, '2026-06-20', '18:00', '22:00');
-- Expected result: FALSE

-- Band fully contains overlap test
SELECT is_band_available(1, '2026-06-20', '17:00', '23:00');
-- Expected result: FALSE


-- 4. RSVP / attendance validation test
INSERT INTO attendance(
    status,
    table_number,
    role,
    guest_id,
    event_id
)
VALUES (
    'attending',
    3,
    'Guest',
    1,
    1
);

-- Expected result:
-- Declined guests cannot be marked as attending.


-- 5. View tests
SELECT *
FROM vw_wedding_financial_summary;

SELECT *
FROM vw_rsvp_overview;

SELECT *
FROM vw_vendor_booking_overview;

SELECT *
FROM vw_upcoming_weddings;


-- 6. Constraint validation test
INSERT INTO event_rsvp(
    guest_id,
    event_id,
    status
)
VALUES (
    1,
    1,
    'invalid_status'
);

-- Expected result:
-- CHECK constraint violation


-- 7. Procedure test
CALL generate_rsvp_summary(1);

-- Expected result:
-- NOTICE messages for accepted, declined, and pending RSVP counts