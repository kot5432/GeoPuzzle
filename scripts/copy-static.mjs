import { cp, copyFile, mkdir } from 'node:fs/promises';

const files = ['config.js', 'env.js', 'location.js', 'app.js'];
const directories = ['lib', 'api'];

await mkdir('dist', { recursive: true });

for (const file of files) {
  try {
    await copyFile(file, `dist/${file}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

for (const directory of directories) {
  try {
    await cp(directory, `dist/${directory}`, { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
