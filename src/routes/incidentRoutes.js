const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/authorizeRoles');
const upload = require('../middlewares/uploadMiddleware');

const { 
    createIncident,
    getIncidents,
    updateIncidentStatus,
    acceptIncident,
    offerHelp,
    respondToVolunteer,
    getNearbyIncidents
} = require('../controllers/incidentController');

// 🚩 1. 
router.post(
    '/', 
    auth, 
    authorizeRoles(['user', 'rescuer', 'admin']), 
    upload.array('photos', 5), // 📸 รับรูปสูงสุด 5 รูป (ต้องสะกดว่า photos ตาม FormData)
    createIncident
);

// 🚩 2. 
router.get('/', getIncidents);

// 🚩 3. 
router.get('/nearby', getNearbyIncidents);

// อัพเดตสถานะหมุด (Admin เท่านั้น)
router.put('/:id/status', auth, authorizeRoles(['admin']), updateIncidentStatus);

// อาสารับหมุด (Rescuer/Admin)
router.put('/:id/accept', auth, authorizeRoles(['rescuer','admin']), acceptIncident);

// เสนอความช่วยเหลือ
router.put('/:id/offer', auth, authorizeRoles(['user', 'rescuer', 'admin']), offerHelp);

// ตอบรับอาสา
router.put('/:id/respond', auth, authorizeRoles(['user', 'rescuer', 'admin']), respondToVolunteer);

module.exports = router;