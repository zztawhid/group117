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

ALTER TABLE users AUTO_INCREMENT = 100000;


UPDATE users SET user_type = 'admin' WHERE email = 'gud23rqu@uea.ac.uk';


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
('Main Visitors', FLOOR(1000 + RAND() * 9000), 150, 2.00, 10),
('Sports Park', FLOOR(1000 + RAND() * 9000), 80, 2.00, 24),
('Blackdale', FLOOR(1000 + RAND() * 9000), 60, 2.00, 12),
('Medical Center', FLOOR(1000 + RAND() * 9000), 40, 2.00, 6),
('Suffolk Road', FLOOR(1000 + RAND() * 9000), 30, 2.00, 24),
('Chancellors Drive', FLOOR(1000 + RAND() * 9000), 50, 2.00, 12),
('Waveney Road', FLOOR(1000 + RAND() * 9000), 25, 2.00, 24),
('Enterprise Center', FLOOR(1000 + RAND() * 9000), 35, 2.00, 8),
('Suffolk Terrace', FLOOR(1000 + RAND() * 9000), 20, 2.00, 24),
('Sainsbury''s Center', FLOOR(1000 + RAND() * 9000), 100, 2.00, 4);

-- Insert sample spaces for Main Visitors
INSERT INTO parking_spaces (location_id, space_number)
SELECT 1, CONCAT('A', n) FROM (
    SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
    UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
) AS numbers;parking_locations