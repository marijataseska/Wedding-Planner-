ALTER TABLE event_rsvp
ADD CONSTRAINT chk_rsvp_status
CHECK (status IN ('accepted', 'declined', 'pending'));

ALTER TABLE attendance
ADD CONSTRAINT chk_attendance_status
CHECK (status IN ('attending', 'absent'));

ALTER TABLE event_rsvp
ADD CONSTRAINT uq_guest_event_rsvp
UNIQUE (guest_id, event_id);

ALTER TABLE attendance
ADD CONSTRAINT uq_guest_event_attendance
UNIQUE (guest_id, event_id);