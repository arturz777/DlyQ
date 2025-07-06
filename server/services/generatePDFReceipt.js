const fs = require("fs");
const puppeteer = require("puppeteer");

/**
 * Генерирует PDF-файл на основе HTML-контента
 * @param {string} htmlContent - HTML-разметка квитанции
 * @param {string} outputPath - Путь, куда сохранить PDF (например, 'receipt.pdf')
 */
const generatePDFReceipt = async (htmlContent, outputPath = "receipt.pdf") => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "20px",
      bottom: "30px",
      left: "20px",
      right: "20px",
    },
  });

  await browser.close();
  console.log(`✅ PDF сохранён как ${outputPath}`);
};

module.exports = generatePDFReceipt;
