const axios = require("axios");

const generatePDFShiftBuffer = async (html) => {
  try {
    const response = await axios.post(
      "https://api.pdfshift.io/v3/convert/html",
      html,
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
  } catch (error) {
    console.error("❌ PDFShift response:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = generatePDFShiftBuffer;








