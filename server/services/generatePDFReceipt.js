const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const generatePDFReceipt = async (htmlContent, outputPath) => {
  const chromeBase = '/opt/render/.cache/puppeteer/chrome';

  // 🛡️ Проверка: существует ли папка chrome
  if (!fs.existsSync(chromeBase)) {
    throw new Error(`Chrome folder not found at ${chromeBase}`);
  }

  const versionDirs = fs.readdirSync(chromeBase);
  if (!versionDirs.length) {
    throw new Error("No versions found in Puppeteer Chrome folder.");
  }

  const chromeVersionDir = versionDirs[0];
  const executablePath = path.join(
    chromeBase,
    chromeVersionDir,
    'chrome-linux64',
    'chrome'
  );

  console.log("🧭 Используется Chrome по пути:", executablePath);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "30px", left: "20px", right: "20px" },
  });

  await browser.close();
  console.log(`✅ PDF сохранён как ${outputPath}`);
};

module.exports = generatePDFReceipt;
