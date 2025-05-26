// const admin = require('firebase-admin');

// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccountKey.json')),
// });

// module.exports = admin;

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Read the serviceAccountKey.json file created as a Secret File in Render
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
