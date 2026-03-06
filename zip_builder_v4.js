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

const backendDir = path.join(__dirname, 'secure-chat-backend');
const includesDir = ['admin', 'api', 'cron', 'db', 'docs', 'includes', 'keys', 'migrations', 'relay', 'scripts', 'vendor', 'config'];
const includesFile = ['.htaccess', 'index.php', 'ping.php', 'fix_blocking.php', 'gen_keys.php', 'latest_schema_complete.sql', 'reset_db_final.sql'];

// Also grab dynamically any migration runner
const files = fs.readdirSync(backendDir);
files.forEach(f => {
   if (f.startsWith('run_migration_') && f.endsWith('.php')) {
       includesFile.push(f);
   }
});

includesDir.forEach(dir => {
    const fullPath = path.join(backendDir, dir);
    if (fs.existsSync(fullPath)) {
        archive.directory(fullPath, dir);
        console.log(Added Directory: );
    }
});

includesFile.forEach(file => {
    const fullPath = path.join(backendDir, file);
    if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: file });
        console.log(Added File: );
    }
});

archive.finalize();
