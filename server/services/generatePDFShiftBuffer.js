const axios = require("axios");

const generatePDFShiftBuffer = async (html) => {
  const response = await axios.post(
    "https://api.pdfshift.io/v3/convert/html",
    { source: html }, // ✅ обязательно обернуть в { source: html }
    {
      auth: {
        username: process.env.PDFSHIFT_API_KEY,
      },
      headers: {
        "Content-Type": "application/json", // ✅ важно
      },
      responseType: "arraybuffer",
    }
  );

  return response.data;
};

module.exports = generatePDFShiftBuffer;









