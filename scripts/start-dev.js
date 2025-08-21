#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');

console.log('🚀 Starting AI PDF Chat Development Environment...\n');

// Function to check if ChromaDB is running
function checkChromaDB() {
  return new Promise((resolve) => {
    exec('docker ps --filter name=ai-pdf-chroma-dev --format "{{.Names}}"', (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.trim() === 'ai-pdf-chroma-dev');
      }
    });
  });
}

// Function to start ChromaDB
function startChromaDB() {
  return new Promise((resolve, reject) => {
    console.log('🐳 Starting ChromaDB for development...');
    const dockerProcess = spawn('npm', ['run', 'docker:dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ ChromaDB started successfully!\n');
        resolve();
      } else {
        reject(new Error(`ChromaDB failed to start with code ${code}`));
      }
    });
  });
}

// Function to start development servers
function startDevServers() {
  console.log('🚀 Starting backend and frontend servers...\n');
  const devProcess = spawn('npx', ['concurrently', '"npm run dev:backend"', '"npm run dev:frontend"'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development environment...');
    devProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down development environment...');
    devProcess.kill('SIGTERM');
    process.exit(0);
  });
}

// Main function
async function main() {
  try {
    const isChromaRunning = await checkChromaDB();
    
    if (isChromaRunning) {
      console.log('✅ ChromaDB is already running!\n');
    } else {
      await startChromaDB();
    }

    startDevServers();
  } catch (error) {
    console.error('❌ Error starting development environment:', error.message);
    process.exit(1);
  }
}

main();
