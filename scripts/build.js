const fs = require('fs');
const path = require('path');

const files = ['index.html', 'style.css', 'app.js', 'config.js', 'location.js', 'env.js'];
const directories = ['lib', 'components'];

console.log('Building GeoPuzzle...');

try {
  // Create dist directory
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Copy files
  for (const file of files) {
    const sourcePath = path.join(__dirname, '..', file);
    const destPath = path.join(__dirname, '..', 'dist', file);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${file} to dist/`);
    } else {
      console.warn(`Warning: ${file} not found, skipping`);
    }
  }

  // Copy directories
  for (const directory of directories) {
    const sourcePath = path.join(__dirname, '..', directory);
    const destPath = path.join(__dirname, '..', 'dist', directory);
    
    if (fs.existsSync(sourcePath)) {
      copyDirectoryRecursive(sourcePath, destPath);
      console.log(`Copied ${directory}/ to dist/`);
    } else {
      console.warn(`Warning: ${directory} not found, skipping`);
    }
  }

  console.log('Build complete! Output in dist/');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

function copyDirectoryRecursive(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    // Skip node_modules and other common directories to exclude
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache') {
      console.log(`Skipping ${entry.name}/`);
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}