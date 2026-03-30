require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware สำหรับตรวจสอบสิทธิ์การใช้งาน (Authentication)
 * ตรวจสอบผ่าน HTTP-Only Cookie ชื่อ 'token'
 */
const auth = async (req, res, next) => {
    try {
        // 1. ดึง Token จาก Cookie (ต้องใช้ cookie-parser ใน server.js)
        const token = req.cookies.token;

        // 2. ถ้าไม่มี Token ส่งมา
        if (!token) {
            return res.status(401).json({ 
                message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' 
            });
        }

        // 3. ตรวจสอบความถูกต้องของ Token (Verify JWT)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. ค้นหา User ในฐานข้อมูลตาม ID ที่ถอดรหัสออกมาได้
        const user = await User.findById(decoded.id);

        // 5. กรณีไม่พบ User ในฐานข้อมูล
        if (!user) {
            res.clearCookie('token'); // ล้างคุกกี้ทิ้งเพราะข้อมูลไม่ตรงกับ DB
            return res.status(401).json({ 
                message: 'ไม่พบข้อมูลผู้ใช้งาน' 
            });
        }

        // 6. ตรวจสอบสถานะบัญชี (ถ้าโดนแบน หรือระงับการใช้งาน)
        if (user.status !== 'active') {
            return res.status(403).json({ 
                message: 'บัญชีของคุณถูกระงับการใช้งาน' 
            });
        }

        // 7. แนบข้อมูล User เข้าไปใน Request Object เพื่อให้ Controller ถัดไปใช้งานได้
        req.user = user;

        // 8. ผ่านการตรวจสอบ ให้ไปทำงานต่อที่ Controller หลัก
        next();

    } catch (error) {
        // กรณี Token หมดอายุ หรือถูกแก้ไข (Invalid/Expired)
        console.error('Auth Middleware Error:', error.message);
        
        res.clearCookie('token'); // ล้างคุกกี้ที่เน่าแล้วออกไป
        return res.status(401).json({ 
            message: 'เซสชันหมดอายุหรือข้อมูลไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' 
        });
    }
};

module.exports = auth;