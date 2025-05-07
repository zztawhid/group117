CREATE DATABASE ParkingManagementSystem;
USE ParkingManagementSystem;

CREATE TABLE users (
    user_id INT(6) PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    user_type ENUM('admin', 'driver') NOT NULL DEFAULT 'driver',
    mailing_list ENUM('Yes', 'No') NOT NULL DEFAULT 'No',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE driver_vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT(6) NOT NULL,
    license_plate VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY (license_plate) 
);

CREATE TABLE feedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT(6) NULL,  -- NULL for anonymous feedback
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('new', 'in_progress', 'resolved') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Parking Locations Table
CREATE TABLE parking_locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code CHAR(4) UNIQUE NOT NULL,  -- 4-digit random code
    total_spaces INT NOT NULL,
    disabled BOOLEAN DEFAULT FALSE,
    disabled_reason VARCHAR(255),
    hourly_rate DECIMAL(5,2) NOT NULL,
    max_stay_hours INT DEFAULT 24,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Parking Spaces Table
CREATE TABLE parking_spaces (
    space_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    space_number VARCHAR(10) NOT NULL,
    is_disabled BOOLEAN DEFAULT FALSE,
    is_reserved BOOLEAN DEFAULT FALSE,
    reserved_until DATETIME,
    special_type ENUM('standard', 'disabled', 'electric', 'family', 'visitor') DEFAULT 'standard',
    FOREIGN KEY (location_id) REFERENCES parking_locations(location_id),
    UNIQUE KEY (location_id, space_number)
);

-- Insert sample data with random 4-digit codes
INSERT INTO parking_locations (name, code, total_spaces, hourly_rate, max_stay_hours) VALUES
('Main Visitors', FLOOR(1000 + RAND() * 9000), 150, 2.00, 24),
('Sports Park', FLOOR(1000 + RAND() * 9000), 80, 2.00, 24),
('Blackdale', FLOOR(1000 + RAND() * 9000), 60, 2.00, 24),
('Medical Center', FLOOR(1000 + RAND() * 9000), 40, 2.00, 24),
('Suffolk Road', FLOOR(1000 + RAND() * 9000), 30, 2.00, 24),
('Chancellors Drive', FLOOR(1000 + RAND() * 9000), 50, 2.00, 24),
('Waveney Road', FLOOR(1000 + RAND() * 9000), 25, 2.00, 24),
('Enterprise Center', FLOOR(1000 + RAND() * 9000), 35, 2.00, 24),
('Suffolk Terrace', FLOOR(1000 + RAND() * 9000), 20, 2.00, 24),
('Sainsbury''s Center', FLOOR(1000 + RAND() * 9000), 100, 2.00, 24);

-- Parking Occupancy Table
CREATE TABLE parking_occupancy (
    occupancy_id INT AUTO_INCREMENT PRIMARY KEY,
    space_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    time_in DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_out DATETIME,
    payment_status ENUM('unpaid', 'paid', 'free') DEFAULT 'unpaid',
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (space_id) REFERENCES parking_spaces(space_id),
    FOREIGN KEY (vehicle_id) REFERENCES driver_vehicles(vehicle_id)
);

ALTER TABLE parking_occupancy 
ADD COLUMN duration_hours INT NULL 

ALTER TABLE users AUTO_INCREMENT = 100000;


UPDATE users SET user_type = 'admin' WHERE email = 'gud23rqu@uea.ac.uk';


-- Create parking_reservations table
CREATE TABLE parking_reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT(6) NOT NULL,
    vehicle_id INT NOT NULL,
    location_id INT NOT NULL,
    space_id INT,
    space_number VARCHAR(10),
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    payment_status ENUM('unpaid', 'paid', 'free') DEFAULT 'unpaid',
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    needs_disabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES driver_vehicles(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES parking_locations(location_id),
    FOREIGN KEY (space_id) REFERENCES parking_spaces(space_id)
);

-- Insert parking spaces for Main Visitors (150 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('A', n), 
       CASE WHEN n <= 8 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Main Visitors' AND n <= 150;

-- Insert parking spaces for Sports Park (80 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('B', n), 
       CASE WHEN n <= 4 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Sports Park' AND n <= 80;

-- Insert parking spaces for Blackdale (60 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('C', n), 
       CASE WHEN n <= 3 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Blackdale' AND n <= 60;

-- Insert parking spaces for Medical Center (40 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('D', n), 
       CASE WHEN n <= 2 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Medical Center' AND n <= 40;

-- Insert parking spaces for Suffolk Road (30 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('E', n), 
       CASE WHEN n <= 2 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Suffolk Road' AND n <= 30;

-- Insert parking spaces for Chancellors Drive (50 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('F', n), 
       CASE WHEN n <= 3 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Chancellors Drive' AND n <= 50;

-- Insert parking spaces for Waveney Road (25 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('G', n), 
       CASE WHEN n <= 2 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Waveney Road' AND n <= 25;

-- Insert parking spaces for Enterprise Center (35 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('H', n), 
       CASE WHEN n <= 2 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Enterprise Center' AND n <= 35;

-- Insert parking spaces for Suffolk Terrace (20 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('J', n), 
       CASE WHEN n <= 1 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Suffolk Terrace' AND n <= 20;

-- Insert parking spaces for Sainsbury's Center (100 spaces)
INSERT INTO parking_spaces (location_id, space_number, special_type)
SELECT location_id, CONCAT('K', n), 
       CASE WHEN n <= 5 THEN 'disabled' ELSE 'standard' END
FROM parking_locations,
(SELECT a.N + b.N * 10 + 1 AS n
 FROM 
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
 ORDER BY n) numbers
WHERE name = 'Sainsbury''s Center' AND n <= 100;

-- Create index for better performance on reservation queries
CREATE INDEX idx_reservation_times ON parking_reservations (start_time, end_time);
CREATE INDEX idx_reservation_space ON parking_reservations (space_id, start_time, end_time);
CREATE INDEX idx_reservation_location ON parking_reservations (location_id, start_time, end_time);

-- Add reference number column to parking_occupancy
ALTER TABLE parking_occupancy ADD COLUMN reference_number VARCHAR(20) AFTER occupancy_id;
UPDATE parking_occupancy SET reference_number = CONCAT('PARK-', LPAD(occupancy_id, 8, '0')) WHERE reference_number IS NULL;
ALTER TABLE parking_occupancy MODIFY COLUMN reference_number VARCHAR(20) NOT NULL;
ALTER TABLE parking_occupancy ADD UNIQUE INDEX idx_reference_number (reference_number);

-- Add reference number column to parking_reservations
ALTER TABLE parking_reservations ADD COLUMN reference_number VARCHAR(20) AFTER reservation_id;
UPDATE parking_reservations SET reference_number = CONCAT('RES-', LPAD(reservation_id, 8, '0')) WHERE reference_number IS NULL;
ALTER TABLE parking_reservations MODIFY COLUMN reference_number VARCHAR(20) NOT NULL;
ALTER TABLE parking_reservations ADD UNIQUE INDEX idx_reservation_reference (reference_number);


-- First check if the column exists before adding it
SET @dbname = DATABASE();
SET @tablename = 'parking_occupancy';
SET @columnname = 'reference_number';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20)') -- Column doesn't exist, add it
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Now update the reference numbers
SET SQL_SAFE_UPDATES = 0;
UPDATE parking_occupancy SET reference_number = CONCAT('PARK-', LPAD(occupancy_id, 8, '0')) 
WHERE reference_number IS NULL OR reference_number = '';
SET SQL_SAFE_UPDATES = 1;

-- Modify the column to be NOT NULL and add unique index
ALTER TABLE parking_occupancy MODIFY COLUMN reference_number VARCHAR(20) NOT NULL;
ALTER TABLE parking_occupancy ADD UNIQUE INDEX idx_reference_number (reference_number);

-- Repeat the process for parking_reservations
SET @tablename = 'parking_reservations';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Update reservation reference numbers
SET SQL_SAFE_UPDATES = 0;
UPDATE parking_reservations SET reference_number = CONCAT('RES-', LPAD(reservation_id, 8, '0')) 
WHERE reference_number IS NULL OR reference_number = '';
SET SQL_SAFE_UPDATES = 1;

-- Final modifications for reservations table
ALTER TABLE parking_reservations MODIFY COLUMN reference_number VARCHAR(20) NOT NULL;
ALTER TABLE parking_reservations ADD UNIQUE INDEX idx_reservation_reference (reference_number);

