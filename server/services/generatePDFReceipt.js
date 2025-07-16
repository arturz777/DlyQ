const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");

const generatePDFReceipt = async (htmlContent, outputPath) => {
  console.log("🛠️ Puppeteer executablePath по умолчанию:", puppeteer.executablePath());
  const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "/opt/render/.cache/puppeteer/chrome/linux-138.0.7204.94/chrome-linux64/chrome",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
