const userController = require('./userController');
const Incident = require('../models/Incident');
const User = require('../models/User');
const { getDistance } = require('geolib');

// ฟังก์ชั่นสำหรับสร้างรายงานเหตุการณ์ใหม่
const createIncident = async (req, res) => {
    try {

        const photoUrls = req.files ? req.files.map(file => file.path) : [];

        let { title, description, location, type, severity, impact, userLocation } = req.body;

        if (typeof location === 'string') location = JSON.parse(location);
        if (typeof userLocation === 'string') userLocation = JSON.parse(userLocation);

        console.log("ข้อมูลที่ได้รับจากหน้าเว็บ:", req.body);    
        if (!title || !description || !location || !type || !severity || !impact || !userLocation) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง' });
        }

        if (userLocation.coordinates[0] === 0 && userLocation.coordinates[1] === 0) {
            return res.status(400).json({ message: 'กรุณาระบุตำแหน่งปัจจุบันของคุณ' });
        }

        const reporterID = req.user._id;

        const userCoords = {
            latitude: userLocation.coordinates[1],
            longitude: userLocation.coordinates[0]
        };
        const incidentCoords = {
            latitude: location.coordinates[1],
            longitude: location.coordinates[0]
        };
        const datastance = getDistance(userCoords, incidentCoords);
        const maxDistance = 15000; // 15 กิโลเมตร

        let isFlagged = false;
        let flagReason = '';

        if (datastance > maxDistance) {
            isFlagged = true;
            flagReason = `รายงานเหตุการณ์ห่างจากจุดเกิดเหตุจริงมากเกินไป (${(datastance / 1000).toFixed(2)} กม.)`;
        }

        const lastIncident = await Incident.findOne({ reporterID }).sort({ createdAt: -1 });

        if (lastIncident) {
            const timeDifference = Date.now() - lastIncident.createdAt.getTime();
            const cooldownTime = 7 * 60 * 1000; // 7 นาที

            if (timeDifference < cooldownTime) {
                const minutesLeft = Math.ceil((cooldownTime - timeDifference) / (60 * 1000));
                return res.status(400).json({ 
                    message: `กรุณารออีก ${minutesLeft} นาที ก่อนที่จะแจ้งเหตุครั้งต่อไป` 
                });
            }
        }   

        const duplicateIncident = await Incident.findOne({
            type: type,
            status: { $in: ['pending', 'verified'] },
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: location.coordinates
                    },
                    $maxDistance: 50 // 50 เมตร
                }
            }
        });

        if (duplicateIncident) {
            return res.status(400).json({ message: 'มีรายงานเหตุในลักษณะเดียวกันแจ้งเข้ามาแล้วในบริเวณนี้' });
        }

        if (severity === 'critical' && photoUrls.length === 0) {
            return res.status(400).json({ message: 'เหตุที่อยู่ในระดับวิกฤต จำเป็นต้องมีรูปภาพประกอบอย่างน้อย 1 รูป' });
        }

        const newIncident = await Incident.create({
            reporterID: reporterID,
            title: title,
            description: description,
            type: type,
            severity: severity,
            impact: impact,
            photos: photoUrls,
            location: {
                type: 'Point',
                coordinates: location.coordinates
            },
            isFlagged: isFlagged,
            flagReason: flagReason
        });

        return res.status(201).json({ 
            success: true,
            message: 'รายงานเหตุการณ์สำเร็จเรียบร้อยแล้ว!',
            data: newIncident 
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

// ฟังก์ชั่นดึงข้อมูลรายงานเหตุการณ์
const getIncidents = async (req, res) => {
    try {
        const { latitude, longitude, radius } = req.query;

        if (!latitude || !longitude || !radius) {
            return res.status(400).json({ message: 'กรุณาระบุพิกัดและระยะรัศมีที่ต้องการค้นหา' });
        }

        const parsedLat = parseFloat(latitude);
        const parsedLng = parseFloat(longitude);
        const parsedRadius = parseInt(radius);

        const incidents = await Incident.find({
            status: { $in: ['pending', 'verified'] },
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parsedLng, parsedLat]
                    },
                    $maxDistance: parsedRadius * 1000 
                }
            }
        });

        res.status(200).json({ 
            success: true,
            data: incidents 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

// ฟังก์ชั่นอัพเดตสถานะ (Admin)
const updateIncidentStatus = async (req, res) => {
    try {
        const incidentID = req.params.id;
        const { status } = req.body;
        const validStatuses = ['pending', 'verified', 'in_progress', 'resolved','rejected'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'ค่าสถานะไม่ถูกต้อง' });
        }

        const updatedIncident = await Incident.findByIdAndUpdate(
            incidentID,
            { status: status },
            { new: true }
        );

        if (!updatedIncident) {
            return res.status(404).json({ message: 'ไม่พบรายงานเหตุการณ์นี้' });
        }

        if (status === 'rejected') {
           if (updatedIncident.isFlagged === true) {
                const newScore = await userController.adjustTrustScore(updatedIncident.reporterID, -10);
                console.log(`🚫 [ระงับเหตุปลอม] หัก Trust Score ผู้ใช้ ${updatedIncident.reporterID} จำนวน -10 แต้ม`);
            } else {
                console.log(`ℹ️ [ยกเลิกเคส] แอดมินปฏิเสธรายงาน (ไม่มีการหักคะแนน)`);
            }
        }

        res.status(200).json({ 
            success: true,
            message: 'อัปเดตสถานะเหตุการณ์สำเร็จเรียบร้อยแล้ว',
            data: updatedIncident
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

// ฟังก์ชั่นสำหรับอาสาสมัครรับเคส
const acceptIncident = async (req, res) => {
    try {
        const incidentID = req.params.id;
        const rescuerID = req.user._id;

        const incident = await Incident.findById(incidentID);

        if (!incident) {
            return res.status(404).json({ message: 'ไม่พบรายงานเหตุการณ์นี้' });
        }   

        if (incident.status === 'resolved' || incident.status === 'rejected') {
            return res.status(400).json({ message: 'ไม่สามารถรับเคสได้เนื่องจากเหตุการณ์สิ้นสุดหรือถูกยกเลิกแล้ว' });
        }   

        const alreadyVolunteer = incident.volunteers.some(volunteer => volunteer.userID.toString() === rescuerID.toString());
        if (alreadyVolunteer) {
            return res.status(400).json({ message: 'คุณได้รับงานนี้ไปแล้ว' });
        }

        incident.status = 'in_progress';
        incident.volunteers.push({
            userID: rescuerID,
            status: 'in_progress',
            requestedAt: new Date()
        });
       
        await incident.save();

        res.status(200).json({
            success: true,
            message: 'รับเคสสำเร็จ ขณะนี้คุณกำลังเข้าช่วยเหลือเหตุการณ์นี้',
            data: incident
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

// ฟังก์ชั่นเสนอตัวเข้าช่วยเหลือ
const offerHelp = async (req, res) => {
    try {
        const incidentID = req.params.id;
        const userID = req.user._id;

        const incident = await Incident.findById(incidentID);

        if (!incident) {
            return res.status(404).json({ message: 'ไม่พบรายงานเหตุการณ์นี้' });
        }

        if (incident.reporterID.toString() === userID.toString()) {
            return res.status(400).json({ message: 'คุณไม่สามารถเสนอตัวช่วยเหตุการณ์ของตัวเองได้' });
        }

        if (incident.status === 'resolved' || incident.status === 'rejected') {
            return res.status(400).json({ message: 'ไม่สามารถส่งความช่วยเหลือได้เนื่องจากเหตุการณ์จบลงแล้ว' });
        } 

        const isSomeHelping = incident.volunteers.some(volunteer => volunteer.status === 'in_progress');

        if (isSomeHelping) {
            return res.status(400).json({ message: 'คุณกำลังเข้าช่วยเหลือเหตุการณ์นี้อยู่แล้ว' });
        }

        const alreadyOffered = incident.volunteers.some(volunteer => volunteer.userID.toString() === userID.toString());
        if (alreadyOffered) {
            return res.status(400).json({ message: 'คุณได้ส่งข้อเสนอความช่วยเหลือไปแล้ว' });
        } 

        incident.volunteers.push({
            userID: userID,
            status: 'pending',
            requestedAt: new Date()
        });

        await incident.save();

        res.status(200).json({
            success: true,
            message: 'ส่งข้อเสนอความช่วยเหลือสำเร็จเรียบร้อยแล้ว',
            data: incident
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

// ฟังก์ชั่นตอบกลับอาสาสมัคร
const respondToVolunteer = async (req, res) => {
    try {
        const incidentID = req.params.id;
        const ownerID = req.user._id; 
        const { volunteerID, action } = req.body; 
       
        const incident = await Incident.findById(incidentID);

        if (!incident) {
            return res.status(404).json({ message: 'ไม่พบรายงานเหตุการณ์นี้' });
        }

        if (incident.reporterID.toString() !== ownerID.toString()) {
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์จัดการข้อเสนอความช่วยเหลือของเหตุการณ์นี้' });
        }

        if (!volunteerID || !action) { 
            return res.status(400).json({ message: 'กรุณาระบุข้อมูลอาสาสมัครและการตอบกลับ' });
        }

        const volunteerIndex = incident.volunteers.findIndex(volunteer => volunteer.userID.toString() === volunteerID.toString());

        if (volunteerIndex === -1) {
            return res.status(404).json({ message: 'ไม่พบรายชื่ออาสาสมัครในเหตุการณ์นี้' });
        }

        if (action === 'accept') {
            incident.volunteers[volunteerIndex].status = 'in_progress';
            incident.status = 'in_progress';

            incident.volunteers.forEach((volunteer, index) => {
                if (index !== volunteerIndex && volunteer.status === 'pending') {
                    volunteer.status = 'rejected'; 
                }
            });

        } else if (action === 'reject') {
            incident.volunteers[volunteerIndex].status = 'rejected';
        } else {
            return res.status(400).json({ message: 'คำสั่งไม่ถูกต้อง (ต้องเป็น accept หรือ reject เท่านั้น)' });
        }

        await incident.save();

        res.status(200).json({
            success: true,
            message: `ทำการ ${action === 'accept' ? 'ตอบรับ' : 'ปฏิเสธ'} อาสาสมัครเรียบร้อยแล้ว`,
            data: incident
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

module.exports = {
    createIncident,
    getIncidents,
    updateIncidentStatus,
    acceptIncident,
    offerHelp,
    respondToVolunteer
}