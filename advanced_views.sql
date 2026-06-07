CREATE OR REPLACE VIEW vw_wedding_financial_summary AS
SELECT
    w.wedding_id,
    w.budget,
    calculate_wedding_total_cost(w.wedding_id) AS total_cost,
    w.budget - calculate_wedding_total_cost(w.wedding_id) AS remaining_budget
FROM wedding w;


CREATE OR REPLACE VIEW vw_rsvp_overview AS
SELECT
    e.event_id,
    e.event_type,
    r.status,
    COUNT(*) AS total
FROM event_rsvp r
JOIN event e ON r.event_id = e.event_id
GROUP BY e.event_id, e.event_type, r.status;


CREATE OR REPLACE VIEW vw_vendor_booking_overview AS
SELECT DISTINCT
    w.wedding_id,
    v.name AS venue_name,
    p.name AS photographer_name,
    b.band_name
FROM wedding w
LEFT JOIN venue_booking vb ON w.wedding_id = vb.wedding_id
LEFT JOIN venue v ON vb.venue_id = v.venue_id
LEFT JOIN photographer_booking pb ON w.wedding_id = pb.wedding_id
LEFT JOIN photographer p ON pb.photographer_id = p.photographer_id
LEFT JOIN band_booking bb ON w.wedding_id = bb.wedding_id
LEFT JOIN band b ON bb.band_id = b.band_id;


CREATE OR REPLACE VIEW vw_upcoming_weddings AS
SELECT
    wedding_id,
    "date" AS wedding_date,
    budget,
    notes
FROM wedding
WHERE "date" >= CURRENT_DATE;