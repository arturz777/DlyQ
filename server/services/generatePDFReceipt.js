const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");

const generatePDFReceipt = async (htmlContent, outputPath) => {
 const browser = await puppeteer.launch({
  headless: true,
  executablePath: puppeteer.executablePath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
