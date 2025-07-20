const axios = require("axios");

const generatePDFShiftBuffer = async (html) => {
  try {
    const response = await axios.post(
       "https://api.pdfshift.io/v3/convert",
      { source: html },
      {
        auth: {
          username: process.env.PDFSHIFT_API_KEY,
        },
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );
    return response.data;
  } catch (err) {
    console.error("❌ Ошибка PDFShift:", err.message);
    if (err.response) {
      console.error("📄 Ответ PDFShift:", err.response.data.toString());
    }
    throw err;
  }
};

module.exports = generatePDFShiftBuffer;








