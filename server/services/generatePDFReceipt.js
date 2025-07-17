const puppeteer = require("puppeteer-core");
const chrome = require("chrome-aws-lambda");
const fs = require("fs/promises");

async function generatePDFReceipt(html, outputPath) {
  try {
    console.log("🧭 Запуск Puppeteer (aws-lambda)");

    const browser = await puppeteer.launch({
      args: chrome.args,
      executablePath: (await chrome.executablePath) || "/usr/bin/chromium-browser",
      headless: chrome.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await fs.writeFile(outputPath, pdfBuffer);
    await browser.close();

    console.log("✅ PDF успешно сгенерирован:", outputPath);
  } catch (error) {
    console.error("❌ Ошибка генерации PDF:", error.message);
    throw error;
  }
}

module.exports = generatePDFReceipt;



