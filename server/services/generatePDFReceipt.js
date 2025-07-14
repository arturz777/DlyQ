const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const generatePDFReceipt = async (htmlContent, outputPath) => {
  const chromeVersionDir = fs.readdirSync('/opt/render/.cache/puppeteer/chrome')[0];
  const executablePath = path.join(
    '/opt/render/.cache/puppeteer/chrome',
    chromeVersionDir,
    'chrome-linux64',
    'chrome'
  );

  console.log("🧭 Используется Chrome по пути:", executablePath);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath
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

