const path = require('path');
const multer = require('multer');

//multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'Uploads'));
    },
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        cb(null, `Prod-${Date.now()}.${ext}`);
    }
});

//file filter
const FileFilter = (req, file, cb) => {
    if(['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)){
        cb(null, true);
    } else {
        cb(new Error('invalid file'), false);
    }
}

//file upload kab chalna hai
const uploadd = multer({storage, fileFilter: FileFilter});

module.exports = uploadd;