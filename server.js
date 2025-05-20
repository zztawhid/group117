const express = require('express');
const path = require('path');
const pool = require('./config/db');
const bcrypt = require('bcryptjs');
const app = express();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET || 'parkueasecret';
const RESET_TOKEN_EXPIRY = '1h';

const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
        user: "chasity.runolfsson@ethereal.email",  
        pass: "MS2JWDmVYwxMUuh27u"              
    }
});

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

async function addNotification(title, message) {
    try {
        await pool.execute(
            'INSERT INTO notifications (title, message) VALUES (?, ?)',
            [title, message]
        );
    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

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

            // Send confirmation email
            const mailOptions = {
                from: 'chasity.runolfsson@ethereal.email',
                to: email,
                subject: 'Registration Confirmation',
                text: `Hello ${firstName},\n\nThank you for registering! Your account has been created successfully.\n\nBest regards,\nThe Team`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });

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

//PASSWORD HASHING
// password hashing done through bcrypt (imported at top using require 'bcrypt')
// define salt round = 10 (computational cost of hashing, higher number makes hashing more secure. Here 10 is commonly used)
// hashing password using await bcrypt.hash(password, saltRounds)
// bcrypt.hash() function takes plain-text password and saltRounds as inputs
// generates hashed version of password asynchronously
// resulting hashed password is a secure, irreversible string that is stored in database


// Track failed login attempts
async function trackFailedLoginAttempt(ip, email) {
    const now = new Date();
    const expiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
    
    await pool.execute(
        'INSERT INTO login_attempts (ip_address, email, attempt_time, expiry_time) VALUES (?, ?, ?, ?)',
        [ip, email, now, expiry]
    );
    
    // Clean up old attempts
    await pool.execute(
        'DELETE FROM login_attempts WHERE expiry_time < ?',
        [now]
    );
}

async function checkLoginRateLimit(ip, email) {
    const [attempts] = await pool.execute(
        'SELECT COUNT(*) AS count FROM login_attempts ' +
        'WHERE (ip_address = ? OR email = ?) AND attempt_time > DATE_SUB(NOW(), INTERVAL 15 MINUTE)',
        [ip, email]
    );
    
    return attempts[0].count >= 5; // Limit to 5 attempts
}

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const ip = req.ip;
        
        // Check rate limit
        if (await checkLoginRateLimit(ip, email)) {
            return res.status(429).json({ 
                message: 'Too many login attempts. Please try again in 15 minutes.' 
            });
        }
        
        // Rest of your login logic...
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            await trackFailedLoginAttempt(ip, email);
            return res.status(401).json({ 
                message: 'Invalid email or password' 
            });
        }
        
        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            await trackFailedLoginAttempt(ip, email);
            return res.status(401).json({ 
                message: 'Invalid email or password' 
            });
        }
        
        // Successful login
        res.json({ 
            message: 'Login successful',
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                user_type: user.user_type
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: 'Login failed. Please try again.' 
        });
    }
});


// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if user exists
        const [users] = await pool.execute(
            'SELECT user_id, email FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'No account with that email exists' });
        }

        const user = users[0];
        
        // Generate reset token
        const resetToken = jwt.sign(
            { userId: user.user_id },
            RESET_TOKEN_SECRET,
            { expiresIn: RESET_TOKEN_EXPIRY }
        );
        
        // Store token in database (with expiry)
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
        await pool.execute(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?',
            [resetToken, expiresAt, user.user_id]
        );
        
        // Send email with reset link
        const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;
        
        const mailOptions = {
            from: 'parking@uea.ac.uk',
            to: user.email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Please click the following link to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending reset email:', error);
                return res.status(500).json({ message: 'Failed to send reset email' });
            }
            res.json({ message: 'Password reset link sent to your email' });
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Failed to process password reset' });
    }
});

//JWT imported at top of file
// JWT (JSON Web token) used to generate secure token for resetting users password
// const resetToken = jwt.sign(
//     { userId: user.user_id }, // Payload: Contains the user's ID
//     RESET_TOKEN_SECRET,       // Secret key: Used to sign the token
//     { expiresIn: RESET_TOKEN_EXPIRY } // Expiry: Token is valid for a limited time (the time defined)
// );
// Token then stored in databased
// Using token in password reset link 

// Reset password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }
        
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, RESET_TOKEN_SECRET);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }
        
        // Check if token exists in database and isn't expired
        const [users] = await pool.execute(
            'SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
            [token]
        );
        
        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }
        
        const user = users[0];
        
        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password and clear reset token
        await pool.execute(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?',
            [hashedPassword, user.user_id]
        );
        
        res.json({ message: 'Password reset successfully' });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Failed to reset password' });
    }
});

// User Auth
app.get('/api/auth/user', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        const [users] = await pool.execute(
            'SELECT user_id, full_name, phone_number, email, user_type FROM users WHERE user_id = ?',
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

// Fetch notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const [notifications] = await pool.execute(
            'SELECT id, title, message, created_at FROM notifications ORDER BY created_at DESC LIMIT 50'
        );
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

app.post('/api/notifications', async (req, res) => {
    try {
        const { title, message } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        // Add the notification to the database
        await addNotification(title, message);

        // Fetch mailing list users
        const [users] = await pool.execute(
            "SELECT email, full_name FROM users WHERE mailing_list = 'Yes'"
        );

        if (users.length > 0) {
            // Loop through each user and send an email
            for (const user of users) {
                const mailOptions = {
                    from: 'parking@uea.ac.uk', // Use the same sender email as in your existing logic
                    to: user.email,
                    subject: title,
                    text: `Dear ${user.full_name},\n\n` +
                          `${message}\n\n` +
                          `Best regards,\nUEA Parking Team`
                };

                // Send the email using the existing transporter
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error(`Failed to send email to ${user.email}:`, error);
                    } else {
                        console.log(`Email sent to ${user.email}:`, info.response);
                    }
                });
            }
        }

        res.status(201).json({ success: true, message: 'Notification created and emails sent successfully' });
    } catch (error) {
        console.error('Error creating notification or sending emails:', error);
        res.status(500).json({ error: 'Failed to create notification or send emails' });
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

// Add new parking location
app.post('/api/admin/locations', async (req, res) => {
    try {
        const { name, code, total_spaces, hourly_rate } = req.body;

        // Validate inputs
        if (!name || !code || !total_spaces || !hourly_rate) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (code.length !== 4) {
            return res.status(400).json({ error: 'Location code must be 4 characters' });
        }

        if (total_spaces < 1) {
            return res.status(400).json({ error: 'Location must have at least 1 space' });
        }

        if (hourly_rate < 0.5) {
            return res.status(400).json({ error: 'Hourly rate must be at least £0.50' });
        }

        // Check if code already exists
        const [existing] = await pool.execute(
            'SELECT code FROM parking_locations WHERE code = ?',
            [code]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Location code already exists' });
        }

        // Create new location
        const [result] = await pool.execute(
            `INSERT INTO parking_locations 
            (name, code, total_spaces, hourly_rate) 
            VALUES (?, ?, ?, ?)`,
            [name, code, total_spaces, hourly_rate]
        );

        // Create parking spaces
        const spaceNumbers = Array.from({ length: total_spaces }, (_, i) => i + 1);
        for (const spaceNum of spaceNumbers) {
            await pool.execute(
                'INSERT INTO parking_spaces (location_id, space_number) VALUES (?, ?)',
                [result.insertId, spaceNum]
            );
        }

        // Add notification
        await addNotification(
            'New Parking Location Added',
            `A new parking location "${name}" with code "${code}" has been added.`
        );

        res.status(201).json({
            success: true,
            location_id: result.insertId
        });
    } catch (error) {
        console.error('Error adding location:', error);
        res.status(500).json({ error: 'Failed to add new location' });
    }
});

// Update user profile endpoint
app.put('/api/auth/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { full_name, email, phone_number } = req.body;

        // Validate inputs
        if (!full_name || !email || !phone_number) {
            return res.status(400).json({ 
                message: 'All fields are required' 
            });
        }

        // Update user in database
        await pool.execute(
            'UPDATE users SET full_name = ?, email = ?, phone_number = ? WHERE user_id = ?',
            [full_name, email, phone_number, userId]
        );

        // Get updated user data
        const [users] = await pool.execute(
            'SELECT user_id, full_name, phone_number, email, user_type FROM users WHERE user_id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            success: true,
            user: users[0] 
        });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ 
            message: 'Failed to update user profile' 
        });
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

        const locationsWithAvailability = await Promise.all(
            locations.map(async (location) => {
                const [occupied] = await pool.execute(`
                    SELECT COUNT(*) AS occupied 
                    FROM parking_spaces 
                    WHERE location_id = ? AND is_disabled = FALSE
                    AND (is_reserved = TRUE OR space_id IN (
                        SELECT space_id FROM parking_occupancy 
                        WHERE time_out IS NULL
                    ))
                `, [location.location_id]);

                const availableSpaces = location.total_spaces - occupied[0].occupied;

                return {
                    ...location,
                    available_spaces: availableSpaces,
                };
            })
        );

        res.json(locationsWithAvailability);
    } catch (error) {
        console.error('Error fetching parking locations:', error);
        res.status(500).json({ error: 'Failed to fetch parking locations' });
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
                disabledReason = `Closed: ${reason || 'Administrative closure'}`;
                if (notes) disabledReason += ` (${notes})`;
                break;
            case 'event':
                disabled = false; // Location is open but with restrictions
                disabledReason = `Event Only: ${notes || 'Special event access required'}`;
                break;
            case 'maintenance':
                disabled = true;
                disabledReason = `Maintenance: ${notes || 'Scheduled maintenance'}`;
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

        // Fetch the location name
        const [rows] = await pool.execute(
            'SELECT name FROM parking_locations WHERE location_id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const locationName = rows[0].name;

        // Add notification
        const actionText = {
            close: 'closed',
            event: 'set to event-only mode',
            maintenance: 'put into maintenance mode',
            open: 'reopened'
        }[action];

        const notificationMessage = action === 'open'
            ? `The location "${locationName}" has been ${actionText}.`
            : `The location "${locationName}" has been ${actionText}. Reason: ${reason || 'N/A'}.`;

        await addNotification(
            'Location Status Updated',
            notificationMessage
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


// Add new parking location
app.post('/api/admin/locations', async (req, res) => {
    try {
        const { name, code, total_spaces, hourly_rate } = req.body;
        
        // Validate inputs
        if (!name || !code || !total_spaces || !hourly_rate) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (code.length !== 4) {
            return res.status(400).json({ error: 'Location code must be 4 characters' });
        }
        
        if (total_spaces < 1) {
            return res.status(400).json({ error: 'Location must have at least 1 space' });
        }
        
        if (hourly_rate < 0.5) {
            return res.status(400).json({ error: 'Hourly rate must be at least £0.50' });
        }
        
        // Check if code already exists
        const [existing] = await pool.execute(
            'SELECT code FROM parking_locations WHERE code = ?',
            [code]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Location code already exists' });
        }
        
        // Create new location
        const [result] = await pool.execute(
            `INSERT INTO parking_locations 
            (name, code, total_spaces, hourly_rate) 
            VALUES (?, ?, ?, ?)`,
            [name, code, total_spaces, hourly_rate]
        );
        
        // Create parking spaces
        const spaceNumbers = Array.from({length: total_spaces}, (_, i) => i + 1);
        for (const spaceNum of spaceNumbers) {
            await pool.execute(
                'INSERT INTO parking_spaces (location_id, space_number) VALUES (?, ?)',
                [result.insertId, spaceNum]
            );
        }
        
        res.status(201).json({ 
            success: true,
            location_id: result.insertId
        });
        
    } catch (error) {
        console.error('Error adding location:', error);
        res.status(500).json({ error: 'Failed to add new location' });
    }
});

// Update parking spaces
app.put('/api/admin/locations/:id/spaces', async (req, res) => {
    try {
        const { id } = req.params;
        const { add, remove } = req.body;

        // Get current location info
        const [location] = await pool.execute(
            'SELECT total_spaces, name FROM parking_locations WHERE location_id = ?',
            [id]
        );

        if (location.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const currentSpaces = location[0].total_spaces;
        const locationName = location[0].name;
        const newTotal = currentSpaces + (add || 0) - (remove || 0);

        if (newTotal < 1) {
            return res.status(400).json({ error: 'Location must have at least 1 space' });
        }

        // Update total spaces count
        await pool.execute(
            'UPDATE parking_locations SET total_spaces = ? WHERE location_id = ?',
            [newTotal, id]
        );

        // Add new spaces if needed
        if (add > 0) {
            // Get current max space number
            const [spaces] = await pool.execute(
                'SELECT MAX(space_number) AS max_num FROM parking_spaces WHERE location_id = ?',
                [id]
            );

            const startNum = (spaces[0].max_num || 0) + 1;
            const newSpaceNumbers = Array.from({ length: add }, (_, i) => startNum + i);

            for (const spaceNum of newSpaceNumbers) {
                await pool.execute(
                    'INSERT INTO parking_spaces (location_id, space_number) VALUES (?, ?)',
                    [id, spaceNum]
                );
            }
        }

        // Remove spaces if needed
        if (remove > 0) {
            await pool.execute(
                `DELETE FROM parking_spaces 
                WHERE location_id = ? 
                AND space_id IN (
                    SELECT space_id FROM (
                        SELECT space_id FROM parking_spaces 
                        WHERE location_id = ? 
                        ORDER BY space_number DESC 
                        LIMIT ?
                    ) AS temp_table
                )`,
                [id, id, parseInt(remove, 10)]
            );
        }

        // Add notification
        await addNotification(
            'Parking Spaces Updated',
            `The parking spaces for location "${locationName}" (ID: ${id}) have been updated. Added: ${add || 0}, Removed: ${remove || 0}.`
        );

        res.json({
            success: true,
            new_total_spaces: newTotal
        });
    } catch (error) {
        console.error('Error updating spaces:', error);
        res.status(500).json({ error: 'Failed to update parking spaces' });
    }
});

// Delete parking location
app.delete('/api/admin/locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if location exists
        const [location] = await pool.execute(
            'SELECT name FROM parking_locations WHERE location_id = ?',
            [id]
        );
        
        if (location.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }
        
        // Check for active reservations
        const [activeReservations] = await pool.execute(
            `SELECT COUNT(*) AS count 
            FROM parking_reservations 
            WHERE location_id = ? 
            AND end_time > NOW()`,
            [id]
        );
        
        if (activeReservations[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete location with active reservations' 
            });
        }
        
        // Delete in transaction
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        
        try {
            // Delete spaces
            await conn.execute(
                'DELETE FROM parking_spaces WHERE location_id = ?',
                [id]
            );
            
            // Delete location
            await conn.execute(
                'DELETE FROM parking_locations WHERE location_id = ?',
                [id]
            );
            
            await conn.commit();
            res.json({ success: true });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error deleting location:', error);
        res.status(500).json({ error: 'Failed to delete location' });
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

// Get all reservations for a user Endpoint
app.get('/api/parking/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [reservations] = await pool.execute(`
            SELECT 
                r.*, 
                l.name AS location_name,
                v.license_plate,
                s.special_type,
                r.needs_disabled
            FROM parking_reservations r
            JOIN parking_locations l ON r.location_id = l.location_id
            JOIN driver_vehicles v ON r.vehicle_id = v.vehicle_id
            LEFT JOIN parking_spaces s ON r.space_id = s.space_id
            WHERE r.reservation_id = ?
        `, [id]);
        
        if (reservations.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }
        
        res.json(reservations[0]);
    } catch (error) {
        console.error('Error fetching reservation:', error);
        res.status(500).json({ error: 'Failed to fetch reservation' });
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
    if (!cardNumber || !/^\d+$/.test(cardNumber)) { //Ensures input is not empty and contains only digits
        return false;
    }
    
    let sum = 0; //Keeps track of cumulative sum of digits
    let shouldDouble = false; //Flag to determine whether current digit should be doubled (alternates between True and false)
    
    // Loop through digits from right to left
    for (let i = cardNumber.length - 1; i >= 0; i--) { //Starting from rightmost digit (last digit)
        let digit = parseInt(cardNumber.charAt(i));
        
        if (shouldDouble) { //Doubles every second digit
            digit *= 2; //If shouldDouble is true, digit is doubled
            if (digit > 9) { //Doubled value is greater than 9
                digit -= 9; //If doubled value is greater than 9, substract 9 (equivalant to summing digits of doubled value )
            }
        }
        
        sum += digit; //Add processed digit to cumulative sum
        shouldDouble = !shouldDouble; //Toggle shouldDouble flag for next digit
    }
    
    return (sum % 10) === 0; //Card Number is valid if total sum is divisble by 10 (i.e. reminader when divided by 10 is 0)
}

//Final sum = 70 (e.g.)
//70 % 10 === 0 (remainder), so card value is valid

// Parking sessions endpoint
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

        // Create parking session with duration
        const [result] = await pool.execute(
            `INSERT INTO parking_occupancy 
            (space_id, vehicle_id, time_in, time_out, payment_status, amount_paid, reference_number, duration_hours) 
            VALUES (?, ?, NOW(), NULL, 'paid', ?, ?, ?)`,
            [space_id, vehicle_id, amount_paid, reference_number, duration]
        );

        res.status(201).json({
            success: true,
            reference: reference_number,
            space_number: space_number,
            space_id: space_id,
            amount_paid: amount_paid,
            duration_hours: duration
        });

    } catch (error) {
        console.error('Parking session error:', error);
        res.status(500).json({ error: 'Failed to create parking session' });
    }
});

// End parking session
app.post('/api/parking/sessions/:reference/end', async (req, res) => {
    try {
        const { reference } = req.params;
        
        // Update the parking session to set time_out
        const [result] = await pool.execute(
            `UPDATE parking_occupancy 
            SET time_out = NOW() 
            WHERE reference_number = ? AND time_out IS NULL`,
            [reference]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No active session found with this reference' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error ending parking session:', error);
        res.status(500).json({ error: 'Failed to end parking session' });
    }
});

// Get active parking session for a user
app.get('/api/parking/sessions/active', async (req, res) => {
    try {
        const userId = req.query.user_id;
        
        // Check both parking_occupancy and parking_reservations
        const [activeSessions] = await pool.execute(`
            (
                SELECT 
                    o.reference_number,
                    o.time_in,
                    o.time_out,
                    s.space_number,
                    l.name AS location_name,
                    l.code AS location_code,
                    TIMESTAMPDIFF(HOUR, o.time_in, NOW()) AS hours_parked,
                    o.duration_hours,
                    DATE_ADD(o.time_in, INTERVAL o.duration_hours HOUR) AS end_time,
                    'immediate' AS session_type
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
                SELECT 
                    r.reference_number,
                    r.start_time AS time_in,
                    NULL AS time_out,
                    r.space_number,
                    l.name AS location_name,
                    l.code AS location_code,
                    TIMESTAMPDIFF(HOUR, r.start_time, NOW()) AS hours_parked,
                    TIMESTAMPDIFF(HOUR, r.start_time, r.end_time) AS duration_hours,
                    r.end_time,
                    'reservation' AS session_type
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
            res.json({ activeSession: activeSessions[0] });
        } else {
            res.json({ activeSession: null });
        }
    } catch (error) {
        console.error('Error fetching active session:', error);
        res.status(500).json({ error: 'Failed to fetch active session' });
    }
});

// Get parking history for a user
app.get('/api/parking/history', async (req, res) => {
    try {
        const userId = req.query.user_id;
        
        // Get both completed sessions and reservations
        const [history] = await pool.execute(`
            (
                SELECT 
                    'session' AS type,
                    o.reference_number,
                    o.time_in,
                    o.time_out,
                    l.name AS location,
                    o.duration_hours,
                    o.amount_paid AS cost,
                    v.license_plate
                FROM parking_occupancy o
                JOIN parking_spaces s ON o.space_id = s.space_id
                JOIN parking_locations l ON s.location_id = l.location_id
                JOIN driver_vehicles v ON o.vehicle_id = v.vehicle_id
                WHERE v.user_id = ?
                AND o.time_out IS NOT NULL
            )
            UNION
            (
                SELECT 
                    'reservation' AS type,
                    r.reference_number,
                    r.start_time AS time_in,
                    r.end_time AS time_out,
                    l.name AS location,
                    TIMESTAMPDIFF(HOUR, r.start_time, r.end_time) AS duration_hours,
                    r.amount_paid AS cost,
                    v.license_plate
                FROM parking_reservations r
                JOIN parking_locations l ON r.location_id = l.location_id
                JOIN driver_vehicles v ON r.vehicle_id = v.vehicle_id
                WHERE r.user_id = ?
                AND r.payment_status = 'paid'
                AND r.end_time < NOW()
            )
            ORDER BY time_in DESC
            LIMIT 100
        `, [userId, userId]);
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching parking history:', error);
        res.status(500).json({ error: 'Failed to fetch parking history' });
    }
});

// Get all parking history for download
app.get('/api/parking/history/all', async (req, res) => {
    try {
        const userId = req.query.user_id;
        
        const [history] = await pool.execute(`
            (
                SELECT 
                    'session' AS type,
                    o.reference_number,
                    o.time_in,
                    o.time_out,
                    l.name AS location,
                    o.duration_hours,
                    o.amount_paid AS cost,
                    v.license_plate
                FROM parking_occupancy o
                JOIN parking_spaces s ON o.space_id = s.space_id
                JOIN parking_locations l ON s.location_id = l.location_id
                JOIN driver_vehicles v ON o.vehicle_id = v.vehicle_id
                WHERE v.user_id = ?
                AND o.time_out IS NOT NULL
            )
            UNION
            (
                SELECT 
                    'reservation' AS type,
                    r.reference_number,
                    r.start_time AS time_in,
                    r.end_time AS time_out,
                    l.name AS location,
                    TIMESTAMPDIFF(HOUR, r.start_time, r.end_time) AS duration_hours,
                    r.amount_paid AS cost,
                    v.license_plate
                FROM parking_reservations r
                JOIN parking_locations l ON r.location_id = l.location_id
                JOIN driver_vehicles v ON r.vehicle_id = v.vehicle_id
                WHERE r.user_id = ?
                AND r.payment_status = 'paid'
                AND r.end_time < NOW()
            )
            ORDER BY time_in DESC
        `, [userId, userId]);
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching complete parking history:', error);
        res.status(500).json({ error: 'Failed to fetch complete history' });
    }
});

// Endpoint for admin bookings
app.get('/api/admin/bookings', async (req, res) => {
    try {
        const [bookings] = await pool.execute(`
            SELECT 
                r.reservation_id,
                r.reference_number,
                r.start_time,
                r.end_time,
                TIMESTAMPDIFF(HOUR, r.start_time, r.end_time) AS duration_hours,
                r.status,
                r.needs_disabled,
                u.full_name AS user_name,
                u.email AS user_email,
                v.license_plate,
                l.name AS location_name,
                l.code AS location_code,
                a.full_name AS processed_by_name
            FROM parking_reservations r
            JOIN users u ON r.user_id = u.user_id
            JOIN driver_vehicles v ON r.vehicle_id = v.vehicle_id
            JOIN parking_locations l ON r.location_id = l.location_id
            LEFT JOIN users a ON r.processed_by = a.user_id
            WHERE r.start_time > NOW()
            ORDER BY r.start_time ASC
        `);
        
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});
// Endpoint for rejecting bookings
app.post('/api/admin/bookings/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, admin_id } = req.body;
        
        // Update instead of delete to maintain records
        await pool.execute(
            `UPDATE parking_reservations 
             SET status = 'rejected', 
                 rejection_reason = ?,
                 processed_by = ?,
                 updated_at = NOW()
             WHERE reservation_id = ?`,
            [reason, admin_id, id]
        );
        
        // Get booking details for notification
        const [booking] = await pool.execute(`
            SELECT 
                r.reference_number,
                u.email,
                u.full_name,
                l.name AS location_name,
                r.start_time
            FROM parking_reservations r
            JOIN users u ON r.user_id = u.user_id
            JOIN parking_locations l ON r.location_id = l.location_id
            WHERE r.reservation_id = ?
        `, [id]);
        
        if (booking.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Send notification email
        const mailOptions = {
            from: 'parking@uea.ac.uk',
            to: booking[0].email,
            subject: 'Your parking reservation has been rejected',
            text: `Dear ${booking[0].full_name},\n\n` +
                  `Your parking reservation (Ref: ${booking[0].reference_number}) for ${booking[0].location_name} ` +
                  `on ${new Date(booking[0].start_time).toLocaleString()} has been rejected.\n\n` +
                  (reason ? `Reason: ${reason}\n\n` : '') +
                  `Please contact us if you have any questions.\n\n` +
                  `Best regards,\nUEA Parking Team`
        };
        
        transporter.sendMail(mailOptions);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error rejecting booking:', error);
        res.status(500).json({ error: 'Failed to reject booking' });
    }
});

// Accept booking endpoint
async function confirmAccept(bookingId) {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        showError('You must be logged in to perform this action');
        return;
    }
    
    try {
        showLoading(true, 'Processing acceptance...');
        const response = await fetch(`/api/admin/bookings/${bookingId}/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                admin_id: user.user_id 
            })
        });
        
        if (!response.ok) throw new Error('Failed to accept booking');
        
        // Refresh the bookings list
        await loadAdvancedBookings();
        showSuccess('Booking accepted successfully');
    } catch (error) {
        console.error('Error accepting booking:', error);
        showError(error.message || 'Failed to accept booking');
    } finally {
        showLoading(false);
    }
}


// Accept booking for Admin endpoint
app.post('/api/admin/bookings/:id/accept', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;
        
        // Update booking status to confirmed
        await pool.execute(
            `UPDATE parking_reservations 
             SET status = 'confirmed', 
                 processed_by = ?,
                 updated_at = NOW()
             WHERE reservation_id = ?`,
            [admin_id, id]
        );
        
        // Get booking details for notification
        const [booking] = await pool.execute(`
            SELECT 
                r.reference_number,
                u.email,
                u.full_name,
                l.name AS location_name,
                r.start_time,
                r.space_number
            FROM parking_reservations r
            JOIN users u ON r.user_id = u.user_id
            JOIN parking_locations l ON r.location_id = l.location_id
            WHERE r.reservation_id = ?
        `, [id]);
        
        if (booking.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Send confirmation email
        const mailOptions = {
            from: 'parking@uea.ac.uk',
            to: booking[0].email,
            subject: 'Your parking reservation has been confirmed',
            text: `Dear ${booking[0].full_name},\n\n` +
                  `Your parking reservation (Ref: ${booking[0].reference_number}) for ${booking[0].location_name} ` +
                  `on ${new Date(booking[0].start_time).toLocaleString()} has been confirmed.\n\n` +
                  `Parking space: ${booking[0].space_number || 'Will be assigned on arrival'}\n\n` +
                  `Best regards,\nUEA Parking Team`
        };
        
        transporter.sendMail(mailOptions);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error accepting booking:', error);
        res.status(500).json({ error: 'Failed to accept booking' });
    }
});

// Get user's bookings
app.get('/api/user/bookings', async (req, res) => {
    try {
        const userId = req.query.user_id;
        
        const [bookings] = await pool.execute(`
            SELECT 
                r.reservation_id,
                r.reference_number,
                r.start_time,
                r.end_time,
                r.status,
                r.rejection_reason,
                l.name AS location_name,
                l.code AS location_code
            FROM parking_reservations r
            JOIN parking_locations l ON r.location_id = l.location_id
            WHERE r.user_id = ?
            ORDER BY r.start_time DESC
        `, [userId]);
        
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Cancel booking
app.post('/api/user/bookings/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, user_id } = req.body;
        
        // Verify the booking belongs to the user
        const [booking] = await pool.execute(
            'SELECT user_id FROM parking_reservations WHERE reservation_id = ?',
            [id]
        );
        
        if (booking.length === 0 || booking[0].user_id !== parseInt(user_id)) {
            return res.status(403).json({ error: 'Not authorized to cancel this booking' });
        }
        
        // Update status to cancelled
        await pool.execute(
            `UPDATE parking_reservations 
             SET status = 'cancelled', 
                 rejection_reason = ?,
                 updated_at = NOW()
             WHERE reservation_id = ?`,
            [reason || 'User cancelled', id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

// Extend parking session endpoint
app.post('/api/parking/sessions/extend', async (req, res) => {
    try {
        const { reference_number, additional_hours, card_number, card_expiry, card_cvv, card_name } = req.body;
        
        // Validate card details
        if (!validateCardWithLuhn(card_number)) {
            return res.status(400).json({ error: 'Invalid card number' });
        }
        
        if (!card_number || !card_expiry || !card_cvv || !card_name) {
            return res.status(400).json({ error: 'All card details are required' });
        }

        // Get current session
        const [sessions] = await pool.execute(`
            SELECT 
                o.*,
                l.hourly_rate
            FROM parking_occupancy o
            JOIN parking_spaces s ON o.space_id = s.space_id
            JOIN parking_locations l ON s.location_id = l.location_id
            WHERE o.reference_number = ?
            AND o.time_out IS NULL
        `, [reference_number]);

        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Active parking session not found' });
        }

        const session = sessions[0];
        const amount_paid = session.hourly_rate * additional_hours;

        // Only update duration_hours and amount_paid - DON'T set time_out!
        await pool.execute(`
            UPDATE parking_occupancy 
            SET 
                amount_paid = amount_paid + ?,
                duration_hours = duration_hours + ?
            WHERE reference_number = ?
        `, [amount_paid, additional_hours, reference_number]);

        res.json({ 
            success: true,
            additional_hours: additional_hours,
            new_total_duration: session.duration_hours + additional_hours,
            amount_paid: amount_paid
        });

        // success --> boolean indicating it was successful
        // additional_hours --> no. of hours added to parking session
        // example output would be 
        //{
        //   "success": true,
        //   "additional_hours": 2,
        //   "new_total_duration": 5,
        //   "amount_paid": 10.0
        // }

    } catch (error) {
        console.error('Error extending parking session:', error);
        res.status(500).json({ error: 'Failed to extend parking session' });
    }
});

// Message endpoints
app.get('/api/messages/users', async (req, res) => {
    try {
        // Only return non-admin users
        const [users] = await pool.execute(
            'SELECT user_id, full_name, email FROM users WHERE user_type = "driver"'
        );
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const { sender_id, receiver_id } = req.query;
        
        if (!sender_id || !receiver_id) {
            return res.status(400).json({ message: 'Both sender and receiver IDs are required' });
        }

        // Get messages between these two users in either direction
        const [messages] = await pool.execute(`
            SELECT m.*, u.full_name as sender_name 
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id
            WHERE (sender_id = ? AND receiver_id = ?)
            OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC
        `, [sender_id, receiver_id, receiver_id, sender_id]);

        // Mark messages as read when fetched
        await pool.execute(
            'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
            [sender_id, receiver_id]
        );

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const { sender_id, receiver_id, content } = req.body;
        
        if (!sender_id || !receiver_id || !content) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const [result] = await pool.execute(
            'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
            [sender_id, receiver_id, content]
        );

        res.status(201).json({
            message_id: result.insertId,
            success: true
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
});

// Check for new messages (for auto-refresh)
app.get('/api/messages/unread', async (req, res) => {
    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const [result] = await pool.execute(
            'SELECT COUNT(*) as unread_count FROM messages WHERE receiver_id = ? AND is_read = 0',
            [user_id]
        );

        res.json({
            unread: result[0].unread_count > 0
        });
    } catch (error) {
        console.error('Error checking unread messages:', error);
        res.status(500).json({ message: 'Failed to check messages' });
    }
});

//Admin default a-main.html route
app.get('*', (req, res, next) => {
    if (req.path.includes('a-main')) {
        const user = req.user || JSON.parse(req.headers['x-user'] || 'null');
        if (user?.user_type !== 'admin') {
            return res.redirect('/main.html');
        }
    }
    next();
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

//async makes function handle asynchronous tasks (e.g. waiting for database or api response)
// req --> requests object, containing data sent by client (e.g. query / headers)
// res --> response object, used to send data back to client

// promise --> represents value that may be available now, in future or never. it is used to handle asyncrhonmous operations
// --> can be pending / fulfilled or rejected

// res.json --> converts js object or array into json string 

// pool.execute 
// pool --> represents database connection pool (manages multiple database connections for efficiency)
// execute --> executes paramatalised SQL query (helps prevent SQL injection safely passing user inputs), i.e. using placeholder (?)