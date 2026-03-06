const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, 'backend_api_hostinger.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', function() {
  console.log('Archive wrote ' + archive.pointer() + ' total bytes');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Add directories
archive.directory('secure-chat-backend/api/', 'api');
archive.directory('secure-chat-backend/includes/', 'includes');
archive.directory('secure-chat-backend/vendor/', 'vendor');
archive.directory('secure-chat-backend/config/', 'config');

// Add root files
const files = ['.htaccess', 'index.php'];
files.forEach(file => {
    const fullPath = path.join(__dirname, 'secure-chat-backend', file);
    if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: file });
    }
});

archive.finalize();
