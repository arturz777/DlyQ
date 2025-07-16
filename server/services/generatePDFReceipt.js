const puppeteer = require("puppeteer");

async function generatePDFReceipt(html, outputPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({ path: outputPath, format: "A4" });
  await browser.close();
}

module.exports = generatePDFReceipt;


