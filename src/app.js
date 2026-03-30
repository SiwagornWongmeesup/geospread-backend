const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,               // อนุญาตให้ส่ง Cookie/Headers พิเศษ
  methods: ["GET", "POST", "PUT", "DELETE"], // ระบุ Method ที่อนุญาต (เผื่อไว้)
  allowedHeaders: ["Content-Type", "Authorization"] // Header ที่ยอมรับ
}));

app.use(express.json());

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/incidents', require('./routes/incidentRoutes'));

const router = require('./routes/index');

module.exports = app;


