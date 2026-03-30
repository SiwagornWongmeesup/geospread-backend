const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
// 🚩 1. ตั้งค่าการเชื่อมต่อ Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})
// 🚩 2. ตั้งค่า Storage (บอก Multer ว่าให้เอาไปเก็บที่ไหนใน Cloudinary)

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
    folder: 'geospread_incidents', // ชื่อโฟลเดอร์ใน Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg'], // จำกัดนามสกุลไฟล์
  },
})

const upload = multer({ storage: storage});

module.exports = upload;