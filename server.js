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