export async function fetchTranslations() {
	const response = await fetch(`${process.env.REACT_APP_API_URL}/translations`);
	const text = await response.text();
  
	if (!text) {
	  console.error("API вернул пустой ответ!");
	  return []; // Возвращаем пустой массив, чтобы избежать ошибки
	}
  
	try {
	  const data = JSON.parse(text);
	  return data;
	} catch (error) {
	  console.error("Ошибка парсинга JSON:", error);
	  return [];
	}
  }
  
  
  
  export async function updateTranslation(key, lang, text) {
	await fetch(`${process.env.REACT_APP_API_URL}/translations`, {
	  method: "PUT",
	  headers: { "Content-Type": "application/json" },
	  body: JSON.stringify({ key, lang, text }),
	});
  }
  
