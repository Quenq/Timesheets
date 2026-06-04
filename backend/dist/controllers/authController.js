"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const connection_1 = __importDefault(require("../database/connection"));
const auth_1 = require("../middleware/auth");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const validate_1 = require("../utils/validate");
class AuthController {
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password required' });
            }
            const result = await connection_1.default.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = result.rows[0];
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const token = (0, auth_1.generateToken)(user.id, user.email, user.role);
            const response = {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
            };
            res.json(response);
        }
        catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async register(req, res) {
        try {
            const { email, password, role, company_name } = req.body;
            if (!email || !password || !role) {
                return res.status(400).json({ error: 'Email, password, and role required' });
            }
            if (!(0, validate_1.isValidEmail)(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
            if (typeof password !== 'string' || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }
            if (!['admin', 'supervisor'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            // Check if user exists
            const existingUser = await connection_1.default.query('SELECT * FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            // Hash password
            const password_hash = await bcryptjs_1.default.hash(password, 10);
            const result = await connection_1.default.query('INSERT INTO users (email, password_hash, role, company_name) VALUES ($1, $2, $3, $4) RETURNING id, email, role', [email, password_hash, role, company_name || null]);
            const newUser = result.rows[0];
            const token = (0, auth_1.generateToken)(newUser.id, newUser.email, newUser.role);
            const response = {
                token,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role,
                },
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async me(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const result = await connection_1.default.query('SELECT id, email, role, name, company_name FROM users WHERE id = $1', [
                req.user.id,
            ]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(result.rows[0]);
        }
        catch (error) {
            console.error('Me error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async getSupervisors(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin only' });
            }
            const result = await connection_1.default.query(`SELECT u.id, u.email, u.name, u.is_active, u.created_at,
                (SELECT COUNT(*) FROM project_supervisors ps WHERE ps.supervisor_id = u.id) as project_count
         FROM users u
         WHERE u.role = 'supervisor'
         ORDER BY u.email`);
            res.json(result.rows);
        }
        catch (error) {
            console.error('Get supervisors error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async createSupervisor(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin only' });
            }
            const { email, password, name } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password required' });
            }
            if (!(0, validate_1.isValidEmail)(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
            if (typeof password !== 'string' || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }
            if (name && !(0, validate_1.isNonEmptyString)(name, 100)) {
                return res.status(400).json({ error: 'Name must be under 100 characters' });
            }
            const existing = await connection_1.default.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            const password_hash = await bcryptjs_1.default.hash(password, 10);
            const result = await connection_1.default.query(`INSERT INTO users (email, password_hash, role, name, is_active)
         VALUES ($1, $2, 'supervisor', $3, 1)
         RETURNING id, email, name, is_active, created_at`, [email, password_hash, name || '']);
            res.status(201).json(result.rows[0]);
        }
        catch (error) {
            console.error('Create supervisor error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async updateSupervisor(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin only' });
            }
            const { id } = req.params;
            const { email, name, password } = req.body;
            if (password) {
                const password_hash = await bcryptjs_1.default.hash(password, 10);
                const updateResult = await connection_1.default.query(`UPDATE users SET email = $1, name = $2, password_hash = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4 AND role = 'supervisor'
           RETURNING id, email, name, is_active`, [email, name || '', password_hash, id]);
                if (updateResult.rows.length === 0) {
                    return res.status(404).json({ error: 'Supervisor not found' });
                }
                return res.json(updateResult.rows[0]);
            }
            const result = await connection_1.default.query(`UPDATE users SET email = $1, name = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND role = 'supervisor'
         RETURNING id, email, name, is_active`, [email, name || '', id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Supervisor not found' });
            }
            res.json(result.rows[0]);
        }
        catch (error) {
            console.error('Update supervisor error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async toggleSupervisorActive(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin only' });
            }
            const { id } = req.params;
            const current = await connection_1.default.query(`SELECT is_active FROM users WHERE id = $1 AND role = 'supervisor'`, [id]);
            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Supervisor not found' });
            }
            const newActive = current.rows[0].is_active ? 0 : 1;
            await connection_1.default.query(`UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newActive, id]);
            res.json({ success: true, is_active: newActive });
        }
        catch (error) {
            console.error('Toggle supervisor error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map