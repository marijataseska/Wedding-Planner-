SET search_path TO project;

TRUNCATE TABLE
    event_rsvp,
    attendance,
    event,
    guest,
    priest,
    church,
    registrar_booking,
    registrar,
    venue_booking,
    photographer_booking,
    band_booking,
    venue,
    venue_type,
    photographer,
    band,
    wedding,
    "user"
RESTART IDENTITY CASCADE;

-- Demo user for sample bookings (use this to test before creating your own wedding)
INSERT INTO "user"(first_name, last_name, email, password_hash, phone_number, gender, birthday) VALUES
('Demo', 'User', 'demo@wedding.app', '$2a$10$YourHashedDemoPasswordHere123456789', '+38970000000', 'Other', NULL);

-- Demo weddings to showcase booking features
INSERT INTO wedding("date", budget, notes, user_id) VALUES
('2025-06-15', 5000, 'Sample wedding - replace with your own', 1),
('2025-07-20', 6000, 'Sample wedding - replace with your own', 1);

INSERT INTO church(name, location, contact) VALUES
('St. Clement Church', 'Skopje', 'contact@church.mk'),
('St. Panteleimon', 'Nerezi', 'info@church.mk');

INSERT INTO priest(name, contact, church_id) VALUES
('Father Nikola', '+38970123456', 1),
('Father Petar', '+38970222333', 2);

INSERT INTO venue_type(type_name) VALUES
('Restaurant'), ('Wedding Hall'), ('Outdoor Garden');

INSERT INTO venue(name, location, city, address, capacity, menu, phone_number, price_per_guest, type_id) VALUES
('Lakeside Garden', 'Matka', 'Skopje', 'Matka 12', 200, 'Garden menu', '+38971123456', 35, 3),
('Royal Hall', 'Centar', 'Skopje', 'Main St 5', 350, 'Full menu', '+38972234567', 45, 2);

INSERT INTO photographer(name, email, phone_number, price_per_hour) VALUES
('Luna Studio', 'luna@studio.mk', '+38970101010', 55),
('Golden Frame', 'golden@frame.mk', '+38970202020', 65);

INSERT INTO band(band_name, genre, equipment, phone_number, price_per_hour) VALUES
('Wedding Vibes', 'Pop', 'Sound + lights', '+38970909090', 80),
('Balkan Groove', 'Traditional', 'Full instruments', '+38970707070', 95);

INSERT INTO registrar(name, contact, location, working_hours) VALUES
('Skopje Civil Registry', '+38970123456', 'Skopje', '08:00-16:00'),
('Centar Registry', '+38970222333', 'Skopje', '09:00-17:00');

INSERT INTO venue_booking("date", start_time, end_time, status, price, venue_id, wedding_id) VALUES
('2025-06-15', '18:00', '23:00', 'confirmed', 3500, 1, 1),
('2025-07-20', '17:00', '22:00', 'confirmed', 4500, 2, 2);

INSERT INTO photographer_booking("date", start_time, end_time, status, photographer_id, wedding_id) VALUES
('2025-06-15', '16:00', '23:00', 'confirmed', 1, 1),
('2025-07-20', '15:00', '22:00', 'confirmed', 2, 2);

INSERT INTO band_booking("date", start_time, end_time, status, band_id, wedding_id) VALUES
('2025-06-15', '18:30', '23:00', 'confirmed', 1, 1),
('2025-07-20', '19:00', '23:00', 'confirmed', 2, 2);

INSERT INTO registrar_booking("date", start_time, end_time, status, registrar_id, wedding_id) VALUES
('2025-06-15', '10:00', '12:00', 'confirmed', 1, 1),
('2025-07-20', '10:00', '12:00', 'confirmed', 2, 2);

INSERT INTO event(event_type, "date", start_time, end_time, status, wedding_id) VALUES
('Ceremony', '2025-06-15', '16:00', '17:30', 'scheduled', 1),
('Reception', '2025-06-15', '18:00', '23:00', 'scheduled', 1),
('Ceremony', '2025-07-20', '15:00', '16:30', 'scheduled', 2),
('Reception', '2025-07-20', '17:00', '22:00', 'scheduled', 2);

INSERT INTO guest(first_name, last_name, email, role, wedding_id) VALUES
('John', 'Smith', 'john@email.com', 'Best Man', 1),
('Mary', 'Johnson', 'mary@email.com', 'Bridesmaid', 1),
('Alex', 'Williams', 'alex@email.com', 'Groomsman', 2),
('Sarah', 'Brown', 'sarah@email.com', 'Guest', 2);

INSERT INTO event_rsvp(status, response_date, guest_id, event_id) VALUES
('accepted', '2025-05-20', 1, 1),
('accepted', '2025-05-21', 2, 2),
('declined', '2025-05-22', 3, 3),
('pending', '2025-05-23', 4, 4);

INSERT INTO attendance(status, table_number, role, guest_id, event_id) VALUES
('attending', 5, 'Guest', 1, 2),
('attending', 7, 'Guest', 2, 2),
('attending', 8, 'Guest', 3, 4),
('not_attending', NULL, 'Guest', 4, 4);
