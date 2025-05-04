const express = require('express');
const path = require('path');
const pool = require('./config/db');
const bcrypt = require('bcryptjs');
const app = express();


// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Test DB connection
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL Connected!');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL Connection Failed:', err.message);
    process.exit(1);
});

// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { firstName, lastName, phone, email, password, licensePlate, mailingList } = req.body;
        
        // Check if email exists
        const [existingUser] = await pool.execute(
            'SELECT email FROM users WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ 
                message: 'Email already registered' 
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const fullName = `${firstName} ${lastName}`;
        const mailingStatus = mailingList ? 'Yes' : 'No';

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert user
            const [userResult] = await connection.execute(
                `INSERT INTO users 
                (full_name, phone_number, email, password_hash, mailing_list) 
                VALUES (?, ?, ?, ?, ?)`,
                [fullName, phone, email, hashedPassword, mailingStatus]
            );

            // Insert vehicle
            await connection.execute(
                `INSERT INTO driver_vehicles 
                (user_id, license_plate) 
                VALUES (?, ?)`,
                [userResult.insertId, licensePlate]
            );

            await connection.commit();
            res.status(201).json({ message: 'Registration successful' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ 
            message: error.message || 'Registration failed' 
        });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user by email
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                message: 'Invalid email or password' 
            });
        }
        
        const user = users[0];
        
        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            return res.status(401).json({ 
                message: 'Invalid email or password' 
            });
        }
        
        // Return user data (excluding password)
        const userData = {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            user_type: user.user_type
        };
        
        res.json({ 
            message: 'Login successful',
            user: userData
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: 'Login failed. Please try again.' 
        });
    }
});

// User Auth
app.get('/api/auth/user', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        const [users] = await pool.execute(
            'SELECT user_id, full_name, email, user_type FROM users WHERE user_id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(users[0]);
    } catch (error) {
        console.error('User data error:', error);
        res.status(500).json({ message: 'Failed to fetch user data' });
    }
});

// Feedback
app.post('/api/feedback', async (req, res) => {
    try {
        const { message, email } = req.body;
        
        if (!message || !email) {
            return res.status(400).json({ 
                message: 'Both message and email are required' 
            });
        }

        const [result] = await pool.execute(
            'INSERT INTO feedback (email, message, created_at) VALUES (?, ?, NOW())',
            [email, message]
        );

        res.json({ 
            success: true,
            feedbackId: result.insertId
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to store feedback'
        });
    }
});

// Vehicle endpoints
app.get('/api/vehicles', async (req, res) => {
    try {
        const userId = req.query.user_id;
        const [vehicles] = await pool.execute(
            'SELECT vehicle_id, license_plate FROM driver_vehicles WHERE user_id = ?',
            [userId]
        );
        res.json(vehicles);
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
});

app.post('/api/vehicles', async (req, res) => {
    try {
        const { user_id, license_plate } = req.body;
        
        if (!license_plate || !user_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const [result] = await pool.execute(
            'INSERT INTO driver_vehicles (user_id, license_plate) VALUES (?, ?)',
            [user_id, license_plate]
        );
        
        res.status(201).json({ 
            vehicle_id: result.insertId,
            license_plate
        });
    } catch (error) {
        console.error('Error adding vehicle:', error);
        res.status(500).json({ error: 'Failed to add vehicle' });
    }
});

app.delete('/api/vehicles/:vehicleId', async (req, res) => {
    try {
        const vehicleId = req.params.vehicleId;
        await pool.execute(
            'DELETE FROM driver_vehicles WHERE vehicle_id = ?',
            [vehicleId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing vehicle:', error);
        res.status(500).json({ error: 'Failed to remove vehicle' });
    }
});

// Admin routes
app.get('/api/admin/users', async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT user_id, full_name, email, phone_number, user_type FROM users'
        );
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

app.put('/api/admin/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { user_type } = req.body;

        if (!['admin', 'driver'].includes(user_type)) {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        await pool.execute(
            'UPDATE users SET user_type = ? WHERE user_id = ?',
            [user_type, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Failed to update user' });
    }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        const [user] = await pool.execute(
            'SELECT user_id FROM users WHERE user_id = ?',
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await pool.execute(
            'DELETE FROM users WHERE user_id = ?',
            [userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

// Parking Location Endpoints
app.get('/api/parking/locations', async (req, res) => {
    try {
        const [locations] = await pool.execute(`
            SELECT 
                location_id, 
                name, 
                code, 
                total_spaces,
                hourly_rate,
                disabled,
                disabled_reason
            FROM parking_locations
            ORDER BY name
        `);
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available spaces at a location
app.get('/api/parking/availability', async (req, res) => {
    try {
        const { location_id } = req.query;
        
        // Get total spaces
        const [location] = await pool.execute(`
            SELECT total_spaces FROM parking_locations 
            WHERE location_id = ? AND disabled = FALSE
        `, [location_id]);
        
        if (location.length === 0) {
            return res.status(404).json({ error: 'Location not found or unavailable' });
        }

        // Get occupied spaces
        const [occupied] = await pool.execute(`
            SELECT COUNT(*) AS occupied 
            FROM parking_spaces 
            WHERE location_id = ? AND is_disabled = FALSE
            AND (is_reserved = TRUE OR space_id IN (
                SELECT space_id FROM parking_occupancy 
                WHERE time_out IS NULL
            ))
        `, [location_id]);
        
        const available = location[0].total_spaces - occupied[0].occupied;
        
        res.json({
            total_spaces: location[0].total_spaces,
            available_spaces: available
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all locations with detailed status (for admin overview)
app.get('/api/admin/locations/status', async (req, res) => {
    try {
        // Get all locations
        const [locations] = await pool.execute(`
            SELECT 
                l.location_id,
                l.name,
                l.code,
                l.total_spaces,
                l.disabled,
                l.disabled_reason,
                l.updated_at
            FROM parking_locations l
            ORDER BY l.name
        `);
        
        // Get occupancy for each location
        const locationsWithStatus = await Promise.all(
            locations.map(async location => {
                try {
                    const [occupied] = await pool.execute(`
                        SELECT COUNT(*) AS occupied 
                        FROM parking_spaces 
                        WHERE location_id = ? AND is_disabled = FALSE
                        AND (is_reserved = TRUE OR space_id IN (
                            SELECT space_id FROM parking_occupancy 
                            WHERE time_out IS NULL
                        ))
                    `, [location.location_id]);
                    
                    const available = location.total_spaces - occupied[0].occupied;
                    const occupancyPercentage = Math.round((occupied[0].occupied / location.total_spaces) * 100);
                    
                    return {
                        ...location,
                        available_spaces: available,
                        occupancy_percentage: occupancyPercentage,
                        status: location.disabled ? 'Closed' : 'Open',
                        last_updated: new Date(location.updated_at).toLocaleString()
                    };
                } catch (error) {
                    console.error(`Error processing location ${location.location_id}:`, error);
                    return {
                        ...location,
                        available_spaces: location.total_spaces,
                        occupancy_percentage: 0,
                        status: 'Unknown',
                        last_updated: new Date(location.updated_at).toLocaleString()
                    };
                }
            })
        );
        
        res.json(locationsWithStatus);
    } catch (error) {
        console.error('Error getting location status:', error);
        res.status(500).json({ error: 'Failed to get location status' });
    }
});

// Update location status
app.put('/api/admin/locations/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason, notes } = req.body;
        
        let disabled = false;
        let disabledReason = null;
        
        switch (action) {
            case 'close':
                disabled = true;
                disabledReason = reason || 'Administrative closure';
                if (notes) disabledReason += ` (${notes})`;
                break;
            case 'event':
                disabled = false;
                disabledReason = 'Event access only';
                if (notes) disabledReason += `: ${notes}`;
                break;
            case 'maintenance':
                disabled = true;
                disabledReason = 'Maintenance: ' + (notes || 'Scheduled maintenance');
                break;
            case 'open':
                disabled = false;
                disabledReason = null;
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        
        await pool.execute(
            'UPDATE parking_locations SET disabled = ?, disabled_reason = ? WHERE location_id = ?',
            [disabled, disabledReason, id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating location status:', error);
        res.status(500).json({ error: 'Failed to update location status' });
    }
});

// Admin endpoints for managing locations
app.put('/api/admin/locations/:id/disable', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        await pool.execute(
            'UPDATE parking_locations SET disabled = TRUE, disabled_reason = ? WHERE location_id = ?',
            [reason, id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/locations/:id/enable', async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.execute(
            'UPDATE parking_locations SET disabled = FALSE, disabled_reason = NULL WHERE location_id = ?',
            [id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific location
app.get('/api/parking/locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [locations] = await pool.execute(`
            SELECT * FROM parking_locations 
            WHERE location_id = ?
        `, [id]);
        
        if (locations.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }
        
        res.json(locations[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Handle parking reservations
app.post('/api/parking/reservations', async (req, res) => {
    try {
        const { user_id, vehicle_id, location_id, start_time, duration_hours, needs_disabled } = req.body;
        
        // Validate inputs
        if (!user_id || !vehicle_id || !location_id || !start_time || !duration_hours) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const startTime = new Date(start_time);
        const endTime = new Date(startTime.getTime() + duration_hours * 60 * 60 * 1000);
        
        // Check if location is available
        const [location] = await pool.execute(
            'SELECT * FROM parking_locations WHERE location_id = ? AND disabled = FALSE',
            [location_id]
        );
        
        if (location.length === 0) {
            return res.status(400).json({ error: 'Location is not available' });
        }
        
        // Find available space
        let spaceQuery = `
            SELECT ps.space_id, ps.space_number 
            FROM parking_spaces ps
            LEFT JOIN parking_reservations pr ON ps.space_id = pr.space_id 
                AND NOT (pr.end_time <= ? OR pr.start_time >= ?)
                AND pr.payment_status = 'paid'
            WHERE ps.location_id = ? 
            AND ps.is_disabled = FALSE
            AND pr.reservation_id IS NULL
        `;
        
        if (needs_disabled) {
            spaceQuery += " AND ps.special_type = 'disabled'";
        } else {
            spaceQuery += " AND ps.special_type != 'disabled'";
        }
        
        spaceQuery += " LIMIT 1";
        
        const [availableSpaces] = await pool.execute(spaceQuery, [startTime, endTime, location_id]);
        
        if (availableSpaces.length === 0) {
            return res.status(400).json({ error: 'No available spaces for the selected time' });
        }
        
        const space_id = availableSpaces[0].space_id;
        const space_number = availableSpaces[0].space_number;
        
        // Calculate cost
        const hourly_rate = location[0].hourly_rate;
        let total_cost = hourly_rate * duration_hours;
        
        // Apply discounts
        if (duration_hours >= 24) total_cost *= 0.8;
        else if (duration_hours >= 12) total_cost *= 0.85;
        else if (duration_hours >= 8) total_cost *= 0.9;
        
        // Generate unique reference number
        const reference_number = `RES-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
        
        // Create reservation
        const [result] = await pool.execute(
            `INSERT INTO parking_reservations 
            (user_id, vehicle_id, location_id, space_id, space_number, start_time, end_time, 
             amount_paid, reference_number, payment_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')`,
            [user_id, vehicle_id, location_id, space_id, space_number, 
             startTime, endTime, total_cost, reference_number]
        );
        
        res.status(201).json({
            reservation_id: result.insertId,
            space_id,
            space_number,
            start_time: startTime,
            end_time: endTime,
            total_cost: total_cost.toFixed(2),
            reference_number,
            hourly_rate,
            duration_hours,
            location_name: location[0].name
        });
        
    } catch (error) {
        console.error('Reservation error:', error);
        
        if (error.code === 'ER_NO_DEFAULT_FOR_FIELD') {
            res.status(500).json({ error: 'Database configuration error. Missing required field.' });
        } else {
            res.status(500).json({ error: 'Failed to create reservation' });
        }
    }
});


// Process payment
app.post('/api/payment/process', async (req, res) => {
    try {
        const { reservation_id, card_number, card_expiry, card_cvv, card_name } = req.body;
        
        // Validate card with Luhn algorithm
        if (!validateCardWithLuhn(card_number)) {
            return res.status(400).json({ error: 'Invalid card number' });
        }
        
        // Basic validation
        if (!card_number || !card_expiry || !card_cvv || !card_name) {
            return res.status(400).json({ error: 'All card details are required' });
        }
        
        // Update reservation payment status
        await pool.execute(
            'UPDATE parking_reservations SET payment_status = "paid" WHERE reservation_id = ?',
            [reservation_id]
        );
        
        res.json({ success: true, message: 'Payment processed successfully' });
        
    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

// Luhn algorithm validation
function validateCardWithLuhn(cardNumber) {
    // Remove all non-digit characters
    cardNumber = cardNumber.replace(/\D/g, '');
    
    // Check if empty or not all digits
    if (!cardNumber || !/^\d+$/.test(cardNumber)) {
        return false;
    }
    
    let sum = 0;
    let shouldDouble = false;
    
    // Loop through digits from right to left
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber.charAt(i));
        
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    
    return (sum % 10) === 0;
}

// Sessions endpoint
app.post('/api/parking/sessions', async (req, res) => {
    try {
        const { user_id, vehicle_id, location_id, duration, amount_paid, needs_disabled } = req.body;
        
        // Validate inputs
        if (!user_id || !vehicle_id || !location_id || !duration || !amount_paid) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Find an available space
        const [availableSpace] = await pool.execute(`
            SELECT ps.space_id, ps.space_number 
            FROM parking_spaces ps
            LEFT JOIN parking_occupancy po ON ps.space_id = po.space_id 
                AND po.time_out IS NULL
            WHERE ps.location_id = ?
            AND ps.is_disabled = FALSE
            AND (ps.special_type = 'disabled' = ?)
            AND po.occupancy_id IS NULL
            LIMIT 1
        `, [location_id, needs_disabled || false]);

        if (!availableSpace || availableSpace.length === 0) {
            return res.status(400).json({ error: 'No available parking spaces' });
        }

        const space_id = availableSpace[0].space_id;
        const space_number = availableSpace[0].space_number;
        const reference_number = `PARK-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

        // Create parking session
        const [result] = await pool.execute(
            `INSERT INTO parking_occupancy 
            (space_id, vehicle_id, time_in, time_out, payment_status, amount_paid, reference_number) 
            VALUES (?, ?, NOW(), NULL, 'paid', ?, ?)`,
            [space_id, vehicle_id, amount_paid, reference_number]
        );

        res.status(201).json({
            success: true,
            reference: reference_number,
            space_number: space_number,
            space_id: space_id,
            amount_paid: amount_paid
        });

    } catch (error) {
        console.error('Parking session error:', error);
        res.status(500).json({ error: 'Failed to create parking session' });
    }
});

// Get active parking session for a user
app.get('/api/parking/sessions/active', async (req, res) => {
    try {
        const userId = req.query.user_id;
        
        // Get active parking session (either immediate parking or reservation)
        const [activeSessions] = await pool.execute(`
            (
                -- Immediate parking sessions
                SELECT 
                    o.occupancy_id,
                    o.reference_number,
                    o.time_in,
                    o.time_out,
                    s.space_number,
                    l.name AS location_name,
                    l.code AS location_code,
                    l.hourly_rate,
                    l.max_stay_hours AS duration_hours,
                    -- Calculate end time based on max stay duration
                    DATE_ADD(o.time_in, INTERVAL l.max_stay_hours HOUR) AS end_time,
                    'immediate' AS session_type,
                    -- Calculate remaining minutes
                    GREATEST(0, l.max_stay_hours * 60 - TIMESTAMPDIFF(MINUTE, o.time_in, NOW())) AS remaining_minutes
                FROM parking_occupancy o
                JOIN parking_spaces s ON o.space_id = s.space_id
                JOIN parking_locations l ON s.location_id = l.location_id
                WHERE o.vehicle_id IN (
                    SELECT vehicle_id FROM driver_vehicles WHERE user_id = ?
                ) 
                AND o.time_out IS NULL
                ORDER BY o.time_in DESC
                LIMIT 1
            )
            UNION
            (
                -- Reservation sessions
                SELECT 
                    r.reservation_id,
                    r.reference_number,
                    r.start_time AS time_in,
                    NULL AS time_out,
                    r.space_number,
                    l.name AS location_name,
                    l.code AS location_code,
                    l.hourly_rate,
                    TIMESTAMPDIFF(HOUR, r.start_time, r.end_time) AS duration_hours,
                    r.end_time,
                    'reservation' AS session_type,
                    -- Calculate remaining minutes for reservation
                    GREATEST(0, TIMESTAMPDIFF(MINUTE, NOW(), r.end_time)) AS remaining_minutes
                FROM parking_reservations r
                JOIN parking_locations l ON r.location_id = l.location_id
                WHERE r.user_id = ?
                AND r.start_time <= NOW()
                AND r.end_time >= NOW()
                AND r.payment_status = 'paid'
                ORDER BY r.start_time DESC
                LIMIT 1
            )
            ORDER BY time_in DESC
            LIMIT 1
        `, [userId, userId]);

        if (activeSessions.length > 0) {
            const session = activeSessions[0];
            // Convert remaining minutes to hours and minutes
            const remainingHours = Math.floor(session.remaining_minutes / 60);
            const remainingMinutes = session.remaining_minutes % 60;
            
            res.json({ 
                activeSession: {
                    ...session,
                    remaining_hours: remainingHours,
                    remaining_minutes: remainingMinutes,
                    total_remaining_minutes: session.remaining_minutes
                }
            });
        } else {
            res.json({ activeSession: null });
        }
    } catch (error) {
        console.error('Error fetching active session:', error);
        res.status(500).json({ error: 'Failed to fetch active session' });
    }
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// redirect routes that do not exist to error
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'error.html'));
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});