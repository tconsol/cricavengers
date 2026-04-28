const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('./errorHandler');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = (subdir) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../../uploads', subdir);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});

const imageFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Only image files are allowed', 400, 'INVALID_FILE_TYPE'));
  }
  cb(null, true);
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5 MB

exports.uploadAvatar      = multer({ storage: storage('avatars'),      fileFilter: imageFilter, limits }).single('avatar');
exports.uploadTeamLogo    = multer({ storage: storage('teams'),        fileFilter: imageFilter, limits }).single('logo');
exports.uploadTournamentLogo = multer({ storage: storage('tournaments'), fileFilter: imageFilter, limits }).single('logo');

exports.fileUrl = (req, subdir, filename) => {
  const proto = req.protocol;
  const host  = req.get('host');
  return `${proto}://${host}/uploads/${subdir}/${filename}`;
};
