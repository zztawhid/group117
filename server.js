const express = require('express');
const path = require('path');
const pool = require('./config/db');
const bcrypt = require('bcrypt');
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

//User Auth//
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


// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});