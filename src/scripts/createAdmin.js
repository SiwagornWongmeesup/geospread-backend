require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const mongoose = require('mongoose');

async function createAdmin() {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
        console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
        process.exit(1);
    }

    try{
        await mongoose.connect(process.env.MONGO_URL);
        
        const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }

        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

        const adminUser = new User({
            name: 'Admin',
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            role: 'admin',
            provider: 'local',
            isVerified: true,
        });
        await adminUser.save();
        console.log('Admin user created successfully');
    }catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await mongoose.disconnect() //ปิดการเชื่อมต่อฐานข้อมูลหลังจากเสร็จสิ้นการทำงาน
        process.exit();//ออกจากโปรแกรมหลังจากเสร็จสิ้นการทำงาน   
    }
}

createAdmin();