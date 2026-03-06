const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, 'backend_api_hostinger_full.zip'));
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

const backendDir = path.join(__dirname, 'secure-chat-backend');
const excludes = ['.env', '.git', 'node_modules', 'vendor', '.archive', 'archive', 'backups', 'deployments', 'dist', 'logs', 'public', 'release', 'test_extract', 'tests'];

// Add all files and directories dynamically, honoring exclusions
fs.readdirSync(backendDir).forEach(item => {
    if (excludes.includes(item)) return;
    
    const fullPath = path.join(backendDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
        archive.directory(fullPath, item);
        console.log(Added directory: );
    } else {
        archive.file(fullPath, { name: item });
        console.log(Added file: );
    }
});

// Explicitly add vendor back (if we want to exclude node_modules from it, though safer to just include pre-built vendor)
if (fs.existsSync(path.join(backendDir, 'vendor'))) {
    archive.directory(path.join(backendDir, 'vendor'), 'vendor');
    console.log('Added directory: vendor');
}


archive.finalize();
