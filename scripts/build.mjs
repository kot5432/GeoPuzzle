import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files = ['index.html', 'style.css', 'app.js'];
const directories = ['lib'];

console.log('Building GeoPuzzle...');

try {
  // Create dist directory
  await mkdir('dist', { recursive: true });

  // Copy files
  for (const file of files) {
    if (existsSync(file)) {
      await cp(file, `dist/${file}`);
      console.log(`Copied ${file} to dist/`);
    } else {
      console.warn(`Warning: ${file} not found, skipping`);
    }
  }

  // Copy directories
  for (const directory of directories) {
    if (existsSync(directory)) {
      await cp(directory, `dist/${directory}`, { recursive: true });
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
