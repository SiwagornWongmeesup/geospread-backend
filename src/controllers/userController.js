require('dotenv').config();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

//POST/api/users/register
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง' });
        }
        
        const userExists = await User.findOne({ email });
        if(userExists){
            return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({ 
            name, 
            email, 
            password: hashedPassword,
            role: 'user',
        })

        res.status(201).json({
            message: 'สมัครสมาชิกสำเร็จเรียบร้อยแล้ว',
            id: user._id,
            name: user.name,
            email: user.email, 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
}

//POST/api/users/login
const loginUser = async (req, res) => {
    try {
        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        }

        email = email.trim().toLowerCase();

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error('ยังไม่ได้กำหนด JWT_SECRET ในระบบ');
        }

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.cookie('token', token,{
            httpOnly: true,// ป้องกัน XSS (Hacker ใช้ JS ขโมยไม่ได้)
            secure:process.env.NODE_ENV === 'production', // ใช้เฉพาะ HTTPS ในโปรดักชั่น
            sameSite: 'strict', // ป้องกันการโจมตีแบบ CSRF
            maxAge: 24 * 60 * 60 * 1000 // หมดอายุใน 1 วัน
        })
      
        return res.json({
            message: 'เข้าสู่ระบบสำเร็จ',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
}

const logoutUser = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });

        return res.status(200).json({
            success: true,
            message: 'ออกจากระบบสำเร็จ'
        });
    }catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการออกจากระบบ'});
    }
}
    
//GET/api/users/:id
const getUser = async (req, res) => {
   try {
    const userId =  req.user.id;
    const user = await User.findById(userId).select('-password');

    if(!user){
        return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    res.status(200).json(user);
   } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
   }
}

const alluser = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
}

//ฟังก์ชั่นสำหรับให้คะแนนความน่าเชื่อถือ
const adjustTrustScore = async (userID, points) => {
    try {
        const user = await User.findById(userID);
        if (!user) {
            console.error(`ไม่พบผู้ใช้งาน: ${userID}`);
            return;
        }
        user.trustScore += points;

        if (user.trustScore < 0) {
            user.trustScore = 0; 
        }

        if (user.trustScore >100) {
            user.trustScore = 100; 
        }

        user.status = user.trustScore < 50 ? 'banned' : 'active'; 
        await user.save();
        
        return user.trustScore
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการปรับคะแนนความน่าเชื่อถือ:', error);
    }
};

const updatedUserRole = async (req, res) => {
    try {
        const userID = req.params.id;
        const { newRole } = req.body;
        const user = await User.findById(userID);
        if (!user) {
          console.error(`ไม่พบผู้ใช้งาน: ${userID}`);
          return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
        }

        if (newRole === "rescuer" && user.trustScore < 55) {
            return res.status(400).json({ 
                success: false,
                message: `ไม่สามารถปรับเป็นอาสากู้ภัยได้ เนื่องจากคะแนนความน่าเชื่อถือ (${user.trustScore}) ต่ำกว่าเกณฑ์ที่กำหนด (ขั้นต่ำ 55 คะแนน)`
              });
        }

        user.role = newRole;
        await user.save();
        return res.status(200).json({
            success: true,
            message: `อัปเดตบทบาทผู้ใช้งานเป็น ${newRole} สำเร็จเรียบร้อยแล้ว!`,
            data: user
        })

        } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUser,
    alluser,
    adjustTrustScore,
    updatedUserRole,
    logoutUser
}