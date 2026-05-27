const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Old MD5 hash from database
const oldMd5Hash = '0192023a7bbd73250516f069df18b500';

// Password entered by user
const password = 'admin123';

// Verify MD5
const md5Hash = crypto
  .createHash('md5')
  .update(password)
  .digest('hex');

if (md5Hash === oldMd5Hash) {
  // Convert to bcrypt
  bcrypt.hash(password, 10, (err, bcryptHash) => {
    console.log('New bcrypt hash:', bcryptHash);

    // Save bcryptHash in DB
  });
}