const axios = require("axios");

const generatePDFShiftBuffer = async (html) => {
  const response = await axios.post(
    "https://api.pdfshift.io/v3/convert/pdf",
    { source: html },
    {
      headers: {
        "X-API-Key": process.env.PDFSHIFT_API_KEY,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    }
  );

  return response.data;
};

module.exports = generatePDFShiftBuffer;










