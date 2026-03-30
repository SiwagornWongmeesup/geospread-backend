const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  reporterID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],//กำหนดให้เป็นจุดเดียว
      default: 'Point',//กำหนดค่าเริ่มต้นเป็นจุด
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
//(ตำแหน่งของคนแจ้งเหตุ)
  userLocation: {
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point',
  },
  coordinates: {
    type: [Number],
    required: true
  }
},

  //ส่วนที่ 2 ประเภทและความรุนแรงของเหตุการณ์
  
  type: {
    type: String,
    enum: ['report', 'sos'],
    required: true
    },
  severity: {
    type: String,
    enum: ['general', 'urgent', 'critical'],
    default: 'general',
    required: true
    },

  impact: {
    type: String,
    enum: ['point', 'area', 'wide'],
    default: 'point',
    required: true
  },

  photos: {
    type: [String],
    validate:{
        validator: function(value){
            if (this.severity === 'critical' && (!value || value.length === 0)) {
                return false; // ถ้าเป็น critical ต้องมีรูปภาพอย่างน้อย 1 รูป
            }
            return true; 
        },  message: 'Critical incidents must have at least one photo.'
    }
   },

   //ส่วนที่ 3
   //เช็ค EXIF Data ของรูปภาพเพื่อดูว่ารูปนั้นถ่ายเมื่อไหร่และที่ไหน ถ้าเก่ามากหรือไม่มีข้อมูลเลยให้แบนรูปนั้น
   isFlagged: {
    type: Boolean,
    default: false //ถ้า Backend ตรวจเจอว่ารูปเก่า ให้เซ็ตตัวนี้เป็น true เพื่อเตือนแอดมิน
   },
   flagReason: {
    type: String,//เก็บเหตุผลที่ถูกแบน เช่น รูปไม่ชัด, รูปเก่า, รูปซ้ำ
   },
   status: {
    type: String,
    enum: ['pending', 'verified', 'in_progress', 'resolved', 'rejected'],
    default: 'pending',
   },
   //ส่วนที่ 4 การจัดการอาสาสมัครและการสื่อสาร
   volunteers: [{
    userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' 
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'in_progress', 'resolved', 'rejected'],
        default: 'pending'
    },
    requestedAt: {
        type: Date,
        default: Date.now
    }
   }],
//ส่วนแสดงว่ามีคนช่วยกี่คน
   volunteerCount: {
    type: Number,
    default: 0
  },
// และอาจจะเพิ่มคนที่เป็น "หัวหน้าเคส" (Primary Responder)
  assignedRescuer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
//ห้องแชท
   chatroomID: {
    type: String,
   },
},
  {
    timestamps: true,//สร้างcreatedAt, updatedAtให้อัตโนมัติ
  }
);

incidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Incident', incidentSchema);