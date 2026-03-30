const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      trim: true, //   " Fiw "-> "Fiw"
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // Fiw@gmail.com -> "fiw@gmail.com"
    },

    password: {
      type: String,
      required: function() {
        return this.provider === 'local'; // ถ้าใช้ local ต้องมีรหัสผ่าน แต่ถ้าใช้ google ไม่ต้อง
      },
      select: false,//เพื่อไม่ให้รหัสผ่านหลุดไปตอนดึงข้อมูล
    },

    phone: {
      type: String,
      unique: true,//กันเบอร์ซ้ำ
      sparse: true,//ป้องกันerrorเมื่อมีค่าnull
      trim: true,
    },

    role: {
      type: String,
      enum: ['user','rescuer','admin'], // only allow these values
      default: 'user',
    },

    provider: {
      type: String,
      enum: ['google', 'local'],
      
    },

    isVerified: {//ยืนยันตัวตน
      type: Boolean,
      default: false,
    },

    verificationDoc: {
      type: String,//เก็บ URL ของเอกสารยืนยันตัวตน เช่น บัตรประชาชน
    },

    status: {//สถานะผู้ใช้
      type: String,
      enum: ['active','suspended','banned'],
      default: 'active',
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      //จำ userเปิดแอพครั้งล่าสุดเพื่ออัพเดตพิกัด ถ้าไม่อัพเดตเลยก็จะเก็บพิกัดเดิมไว้
      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0],
      },
    },

    trustScore: {//คะแนนความน่าเชื่อถือ
      type: Number,
      default: 100,
    },

    lastActiveAt: {//เวลาที่ใช้งานล่าสุด
      type: Date,
    },
  },
  {
    timestamps: true,//สร้างcreatedAt, updatedAtให้อัตโนมัติ
  }
);


userSchema.index({ location: '2dsphere' });//สร้างindexเชิงพื้นที่

module.exports = mongoose.model('User', userSchema);
