CREATE OR REPLACE FUNCTION check_venue_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION 'Invalid venue booking interval: end_time must be after start_time.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM venue_booking vb
        WHERE vb.venue_id = NEW.venue_id
          AND vb.status <> 'cancelled'
          AND vb.booking_id <> COALESCE(NEW.booking_id, -1)
          AND (
                -- Case 1: new booking starts inside existing booking
                ((NEW."date" + NEW.start_time) >= (vb."date" + vb.start_time)
                 AND (NEW."date" + NEW.start_time) < (vb."date" + vb.end_time))

                OR

                -- Case 2: new booking ends inside existing booking
                ((NEW."date" + NEW.end_time) > (vb."date" + vb.start_time)
                 AND (NEW."date" + NEW.end_time) <= (vb."date" + vb.end_time))

                OR

                -- Case 3: new booking fully contains existing booking
                ((NEW."date" + NEW.start_time) <= (vb."date" + vb.start_time)
                 AND (NEW."date" + NEW.end_time) >= (vb."date" + vb.end_time))

                OR

                -- Case 4: new booking is fully inside existing booking
                ((NEW."date" + NEW.start_time) >= (vb."date" + vb.start_time)
                 AND (NEW."date" + NEW.end_time) <= (vb."date" + vb.end_time))
          )
    ) THEN
        RAISE EXCEPTION 'Venue is already booked for this date and time interval.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venue_booking_overlap ON venue_booking;

CREATE TRIGGER trg_venue_booking_overlap
BEFORE INSERT OR UPDATE ON venue_booking
FOR EACH ROW
EXECUTE FUNCTION check_venue_booking_overlap();


CREATE OR REPLACE FUNCTION check_photographer_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION 'Invalid photographer booking interval: end_time must be after start_time.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM photographer_booking pb
        WHERE pb.photographer_id = NEW.photographer_id
          AND pb.status <> 'cancelled'
          AND pb.booking_id <> COALESCE(NEW.booking_id, -1)
          AND (
                -- Case 1: new booking starts inside existing booking
                ((NEW."date" + NEW.start_time) >= (pb."date" + pb.start_time)
                 AND (NEW."date" + NEW.start_time) < (pb."date" + pb.end_time))

                OR

                -- Case 2: new booking ends inside existing booking
                ((NEW."date" + NEW.end_time) > (pb."date" + pb.start_time)
                 AND (NEW."date" + NEW.end_time) <= (pb."date" + pb.end_time))

                OR

                -- Case 3: new booking fully contains existing booking
                ((NEW."date" + NEW.start_time) <= (pb."date" + pb.start_time)
                 AND (NEW."date" + NEW.end_time) >= (pb."date" + pb.end_time))

                OR

                -- Case 4: new booking is fully inside existing booking
                ((NEW."date" + NEW.start_time) >= (pb."date" + pb.start_time)
                 AND (NEW."date" + NEW.end_time) <= (pb."date" + pb.end_time))
          )
    ) THEN
        RAISE EXCEPTION 'Photographer is already booked for this date and time interval.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_photographer_booking_overlap ON photographer_booking;

CREATE TRIGGER trg_photographer_booking_overlap
BEFORE INSERT OR UPDATE ON photographer_booking
FOR EACH ROW
EXECUTE FUNCTION check_photographer_booking_overlap();


CREATE OR REPLACE FUNCTION check_band_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION 'Invalid band booking interval: end_time must be after start_time.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM band_booking bb
        WHERE bb.band_id = NEW.band_id
          AND bb.status <> 'cancelled'
          AND bb.booking_id <> COALESCE(NEW.booking_id, -1)
          AND (
                -- Case 1: new booking starts inside existing booking
                ((NEW."date" + NEW.start_time) >= (bb."date" + bb.start_time)
                 AND (NEW."date" + NEW.start_time) < (bb."date" + bb.end_time))

                OR

                -- Case 2: new booking ends inside existing booking
                ((NEW."date" + NEW.end_time) > (bb."date" + bb.start_time)
                 AND (NEW."date" + NEW.end_time) <= (bb."date" + bb.end_time))

                OR

                -- Case 3: new booking fully contains existing booking
                ((NEW."date" + NEW.start_time) <= (bb."date" + bb.start_time)
                 AND (NEW."date" + NEW.end_time) >= (bb."date" + bb.end_time))

                OR

                -- Case 4: new booking is fully inside existing booking
                ((NEW."date" + NEW.start_time) >= (bb."date" + bb.start_time)
                 AND (NEW."date" + NEW.end_time) <= (bb."date" + bb.end_time))
          )
    ) THEN
        RAISE EXCEPTION 'Band is already booked for this date and time interval.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_band_booking_overlap ON band_booking;

CREATE TRIGGER trg_band_booking_overlap
BEFORE INSERT OR UPDATE ON band_booking
FOR EACH ROW
EXECUTE FUNCTION check_band_booking_overlap();


CREATE OR REPLACE FUNCTION validate_attendance_consistency()
RETURNS TRIGGER AS $$
DECLARE
    guest_rsvp VARCHAR(30);
BEGIN
    SELECT status
    INTO guest_rsvp
    FROM event_rsvp
    WHERE guest_id = NEW.guest_id
      AND event_id = NEW.event_id;

    IF guest_rsvp = 'declined'
       AND NEW.status = 'attending' THEN
        RAISE EXCEPTION 'Declined guests cannot be marked as attending.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_consistency ON attendance;

CREATE TRIGGER trg_attendance_consistency
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION validate_attendance_consistency();