const axios = require("axios");

const generatePDFShiftBuffer = async (html) => {
  console.log("PDFSHIFT_API_KEY:", process.env.PDFSHIFT_API_KEY);
  const response = await axios.post(
    "https://api.pdfshift.io/v3/convert/html",
    { source: html },
    {
      auth: {
        username: process.env.PDFSHIFT_API_KEY, 
      },
      responseType: "arraybuffer",
    }
  );

  return response.data; 
};

module.exports = generatePDFShiftBuffer;







