require('dotenv').config();
const net = require('net');
const { spawn } = require('child_process');
const { URL } = require('url');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    return false;
  }
  const host = parsed.hostname;
  const port = parseInt(parsed.port || '5432', 10);
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const ok = await canConnect(host, port);
    if (ok) return true;
    console.log(`DB not ready yet (${attempt}/20)...`);
    await wait(2000);
  }
  return false;
}

function runNodeScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function startServer() {
  require('./server');
}

(async () => {
  const dbReady = await waitForDatabase();
  if (dbReady) {
    try {
      console.log('Database reachable. Loading courses...');
      await runNodeScript('./load-courses.js');
    } catch (error) {
      console.warn('Course load failed, continuing in current mode:', error.message);
    }
  } else {
    console.log('Database not reachable. Starting in demo mode.');
  }
  startServer();
})();
