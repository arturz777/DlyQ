const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const findChromeExecutable = () => {
  const basePath = '/opt/render/.cache/puppeteer/chrome/';
  try {
    const versions = fs.readdirSync(basePath);
    const latestVersion = versions.sort().reverse()[0]; // Берём последнюю версию
    const chromePath = path.join(basePath, latestVersion, 'chrome-linux64', 'chrome');
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  } catch (err) {
    console.error('❌ Не удалось найти Chrome:', err);
  }
  return null;
};

const generatePDFReceipt = async (html, fileName) => {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error('Chrome executable not found!');
  }

  const tempPath = path.join(os.tmpdir(), fileName);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: tempPath,
    format: 'A4',
    printBackground: true,
  });

  await browser.close();

  return tempPath;
};

module.exports = generatePDFReceipt;

