const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// Create new user
exports.createUser = async (req, res) => {
    try {
        const { name, email, role, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            name,
            email,
            role,
            password: hashedPassword,
            status: 'active'
        });

        await user.save();

        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const userId = req.params.id;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user fields
        user.name = name || user.name;
        user.email = email || user.email;
        user.role = role || user.role;

        // If password is provided, hash and update it
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.password, salt);
        }

        await user.save();

        // Return updated user without password
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json(userResponse);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

// Update user status
exports.updateUserStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.params.id;

        // Validate status
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Find and update user
        const user = await User.findByIdAndUpdate(
            userId,
            { status },
            { new: true, select: '-password' }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ message: 'Error updating user status' });
    }
}; 