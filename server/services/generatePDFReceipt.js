const puppeteer = require("puppeteer");
const fs = require("fs/promises");
const path = require("path");

async function generatePDFReceipt(html, outputPath) {
  try {
    console.log("🧭 Запуск Puppeteer");

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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




