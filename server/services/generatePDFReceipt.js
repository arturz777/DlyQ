const fs = require("fs");
const os = require("os");
const path = require("path");
const chromium = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");

const generatePDFReceipt = async (htmlContent, outputPath) => {
  console.log("🧭 Запуск Puppeteer (aws-lambda)");

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
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




