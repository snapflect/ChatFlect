const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, 'backend_api_hostinger.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function() {
  console.log('Archive wrote ' + archive.pointer() + ' total bytes');
  console.log('Successfully created cross-platform ZIP.');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Append files from a directory, putting its contents at the root of archive
archive.directory('secure-chat-backend/api/', 'api');

archive.finalize();
