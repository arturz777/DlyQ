import { makeAutoObservable } from "mobx";

class BasketStore {
  constructor() {
    this._items = []; // Товары в корзине
    makeAutoObservable(this);
    this.loadBasket();
  }

  addItem(item) {
    // Создаем уникальный ключ на основе ID товара и его опций
    const uniqueKey = JSON.stringify({ id: item.id, options: item.selectedOptions });
  
    // Проверяем, есть ли такой товар в корзине
    const existingItem = this._items.find((i) => i.uniqueKey === uniqueKey);
  
    if (existingItem) {
      existingItem.count += 1; // Увеличиваем количество, если товар уже есть
    } else {
      // Добавляем новый товар с уникальным ключом
      this._items.push({ ...item, count: 1, uniqueKey });
    }
  
    this.saveBasket();
  }


  removeItem(uniqueKey) {
    // Удаляем только товар с соответствующим уникальным ключом
    this._items = this._items.filter((item) => item.uniqueKey !== uniqueKey);
    this.saveBasket();
  }

  updateItemCount(uniqueKey, count) {
    const item = this._items.find((i) => i.uniqueKey === uniqueKey);
    if (item) {
      item.count = count; // Обновляем количество товара
    }
    this.saveBasket();
  }

  updateSelectedOption(itemUniqueKey, optionName, updatedOption) {
    const item = this._items.find((i) => i.uniqueKey === itemUniqueKey);
    if (item) {
      item.selectedOptions[optionName] = updatedOption;
      this.saveBasket(); // Сохраняем изменения в localStorage
    }
  }

  getItemCount(uniqueKey) {
    const item = this._items.find((i) => i.uniqueKey === uniqueKey);
    return item ? item.count : 0; // Возвращаем количество товара
  }

  getTotalPrice() {
    return this._items.reduce((total, item) => {
      const optionPrice = Object.values(item.selectedOptions || {}).reduce(
        (sum, opt) => sum + (opt.price || 0),
        0
      );
      return total + (item.price + optionPrice) * item.count;
    }, 0);
  }

  get items() {
    return this._items;
  }

  get totalItems() {
    return this._items.reduce((sum, item) => sum + item.count, 0);
  }

  get totalPrice() {
    return this._items.reduce((sum, item) => sum + item.price * item.count, 0);
  }

  // Метод для очистки корзины
  clearItems() {
    this._items = []; // Очищаем массив товаров
    this.saveBasket(); // Сохраняем пустую корзину в localStorage
  }

   // Сохранение корзины в localStorage
   saveBasket() {
    localStorage.setItem("basket", JSON.stringify(this._items));
  }

   // Загрузка корзины из localStorage
   loadBasket() {
    const savedItems = JSON.parse(localStorage.getItem("basket"));
    if (savedItems && Array.isArray(savedItems)) {
      this._items = savedItems;
    }
  }
}

export default BasketStore;
