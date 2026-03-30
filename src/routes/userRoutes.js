const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/authorizeRoles');

const {
    registerUser,
    loginUser,
    getUser,
    alluser,
    updatedUserRole,
    logoutUser
} = require('../controllers/userController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/profile', auth, getUser);
router.get('/admin', auth, authorizeRoles(['admin']), (req, res) => {
    res.json({ message: 'Welcome, admin!' });
});
router.put('/roleuser/:id', auth,authorizeRoles(['admin']),updatedUserRole)
router.get('/allusers', auth, authorizeRoles(['admin']), alluser);
            
module.exports = router;    