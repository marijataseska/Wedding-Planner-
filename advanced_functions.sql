CREATE OR REPLACE FUNCTION calculate_wedding_total_cost(p_wedding_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    venue_cost NUMERIC := 0;
    photographer_cost NUMERIC := 0;
    band_cost NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(price), 0)
    INTO venue_cost
    FROM venue_booking
    WHERE wedding_id = p_wedding_id
      AND status = 'confirmed';

    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (pb.end_time - pb.start_time)) / 3600
        * p.price_per_hour
    ), 0)
    INTO photographer_cost
    FROM photographer_booking pb
    JOIN photographer p ON pb.photographer_id = p.photographer_id
    WHERE pb.wedding_id = p_wedding_id
      AND pb.status = 'confirmed';

    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (bb.end_time - bb.start_time)) / 3600
        * b.price_per_hour
    ), 0)
    INTO band_cost
    FROM band_booking bb
    JOIN band b ON bb.band_id = b.band_id
    WHERE bb.wedding_id = p_wedding_id
      AND bb.status = 'confirmed';

    RETURN venue_cost + photographer_cost + band_cost;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION is_venue_available(
    p_venue_id INTEGER,
    p_date DATE,
    p_start TIME,
    p_end TIME
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_end <= p_start THEN
        RAISE EXCEPTION 'Invalid interval: end time must be after start time.';
    END IF;

    RETURN NOT EXISTS (
        SELECT 1
        FROM venue_booking vb
        WHERE vb.venue_id = p_venue_id
          AND vb.status <> 'cancelled'
          AND (
                ((p_date + p_start) >= (vb."date" + vb.start_time)
                 AND (p_date + p_start) < (vb."date" + vb.end_time))

                OR

                ((p_date + p_end) > (vb."date" + vb.start_time)
                 AND (p_date + p_end) <= (vb."date" + vb.end_time))

                OR

                ((p_date + p_start) <= (vb."date" + vb.start_time)
                 AND (p_date + p_end) >= (vb."date" + vb.end_time))

                OR

                ((p_date + p_start) >= (vb."date" + vb.start_time)
                 AND (p_date + p_end) <= (vb."date" + vb.end_time))
          )
    );
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION is_photographer_available(
    p_photographer_id INTEGER,
    p_date DATE,
    p_start TIME,
    p_end TIME
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_end <= p_start THEN
        RAISE EXCEPTION 'Invalid interval: end time must be after start time.';
    END IF;

    RETURN NOT EXISTS (
        SELECT 1
        FROM photographer_booking pb
        WHERE pb.photographer_id = p_photographer_id
          AND pb.status <> 'cancelled'
          AND (
                ((p_date + p_start) >= (pb."date" + pb.start_time)
                 AND (p_date + p_start) < (pb."date" + pb.end_time))

                OR

                ((p_date + p_end) > (pb."date" + pb.start_time)
                 AND (p_date + p_end) <= (pb."date" + pb.end_time))

                OR

                ((p_date + p_start) <= (pb."date" + pb.start_time)
                 AND (p_date + p_end) >= (pb."date" + pb.end_time))

                OR

                ((p_date + p_start) >= (pb."date" + pb.start_time)
                 AND (p_date + p_end) <= (pb."date" + pb.end_time))
          )
    );
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION is_band_available(
    p_band_id INTEGER,
    p_date DATE,
    p_start TIME,
    p_end TIME
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_end <= p_start THEN
        RAISE EXCEPTION 'Invalid interval: end time must be after start time.';
    END IF;

    RETURN NOT EXISTS (
        SELECT 1
        FROM band_booking bb
        WHERE bb.band_id = p_band_id
          AND bb.status <> 'cancelled'
          AND (
                ((p_date + p_start) >= (bb."date" + bb.start_time)
                 AND (p_date + p_start) < (bb."date" + bb.end_time))

                OR

                ((p_date + p_end) > (bb."date" + bb.start_time)
                 AND (p_date + p_end) <= (bb."date" + bb.end_time))

                OR

                ((p_date + p_start) <= (bb."date" + bb.start_time)
                 AND (p_date + p_end) >= (bb."date" + bb.end_time))

                OR

                ((p_date + p_start) >= (bb."date" + bb.start_time)
                 AND (p_date + p_end) <= (bb."date" + bb.end_time))
          )
    );
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE PROCEDURE generate_rsvp_summary(p_event_id INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'Accepted: %',
    (
        SELECT COUNT(*)
        FROM event_rsvp
        WHERE event_id = p_event_id
          AND status = 'accepted'
    );

    RAISE NOTICE 'Declined: %',
    (
        SELECT COUNT(*)
        FROM event_rsvp
        WHERE event_id = p_event_id
          AND status = 'declined'
    );

    RAISE NOTICE 'Pending: %',
    (
        SELECT COUNT(*)
        FROM event_rsvp
        WHERE event_id = p_event_id
          AND status = 'pending'
    );
END;
$$;