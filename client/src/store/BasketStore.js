import { makeAutoObservable } from "mobx";

class BasketStore {
  constructor() {
    this._items = [];
    this._selected = {};

    makeAutoObservable(this);

    this.loadBasket();
    this.loadSelection();

    this.initSelectionDefaults();
    this.normalizeSelectionConflicts();
    this.cleanupSelectionKeys();
  }

  getItemStockQty(item) {
    const raw = item?.stockQuantity ?? item?.quantity ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  isOOS(item) {
    const qty = this.getItemStockQty(item);
    const count = Number(item?.count || 1);
    return qty <= 0 || qty < count;
  }

  get stockItems() {
    return this._items.filter((i) => !this.isOOS(i));
  }

  get oosItems() {
    return this._items.filter((i) => this.isOOS(i));
  }

  isSelected(uniqueKey) {
    return !!this._selected[uniqueKey];
  }

  get selectedItems() {
    return this._items.filter((i) => this._selected[i.uniqueKey]);
  }

  get hasSelectedPreorders() {
    return this._items.some(
      (i) => this._selected[i.uniqueKey] && this.isOOS(i)
    );
  }

  get hasSelectedStockItems() {
    return this._items.some(
      (i) => this._selected[i.uniqueKey] && !this.isOOS(i)
    );
  }

  canSelectKey(uniqueKey) {
    const item = this._items.find((i) => i.uniqueKey === uniqueKey);
    if (!item) return false;

    const itemIsOOS = this.isOOS(item);

    if (itemIsOOS && this.hasSelectedStockItems) return false;
    if (!itemIsOOS && this.hasSelectedPreorders) return false;

    return true;
  }

  toggleSelect(uniqueKey) {
    const item = this._items.find((i) => i.uniqueKey === uniqueKey);
    if (!item) return false;

    const next = !this._selected[uniqueKey];

    if (next && !this.canSelectKey(uniqueKey)) return false;

    this._selected[uniqueKey] = next;

    this.normalizeSelectionConflicts();
    this.saveSelection();
    return true;
  }

  setSelected(uniqueKey, value) {
    const item = this._items.find((i) => i.uniqueKey === uniqueKey);
    if (!item) return false;

    const next = !!value;

    if (next && !this.canSelectKey(uniqueKey)) return false;

    this._selected[uniqueKey] = next;

    this.normalizeSelectionConflicts();
    this.saveSelection();
    return true;
  }

  initSelectionDefaults() {
    for (const item of this._items) {
      if (this._selected[item.uniqueKey] == null) {
        this._selected[item.uniqueKey] = !this.isOOS(item);
      }
    }
    this.normalizeSelectionConflicts();
    this.saveSelection();
  }

  normalizeSelectionConflicts() {
    const hasStock = this.hasSelectedStockItems;
    const hasOOS = this.hasSelectedPreorders;

    if (hasStock && hasOOS) {
      for (const item of this._items) {
        if (this.isOOS(item)) {
          this._selected[item.uniqueKey] = false;
        }
      }
    }
  }

  cleanupSelectionKeys() {
    const keys = new Set(this._items.map((i) => i.uniqueKey));
    for (const k of Object.keys(this._selected)) {
      if (!keys.has(k)) delete this._selected[k];
    }
    this.saveSelection();
  }

  clearSelection() {
    this._selected = {};
    this.saveSelection();
  }

  get allSelectedStockItems() {
    const list = this.stockItems;
    return list.length > 0 && list.every((i) => this.isSelected(i.uniqueKey));
  }

  get allSelectedOOSItems() {
    const list = this.oosItems;
    return list.length > 0 && list.every((i) => this.isSelected(i.uniqueKey));
  }

  clearStockSelection() {
    for (const item of this.stockItems) {
      this._selected[item.uniqueKey] = false;
    }
  }

  clearOOSSelection() {
    for (const item of this.oosItems) {
      this._selected[item.uniqueKey] = false;
    }
  }

  selectAllStock() {
    this.clearOOSSelection();
    for (const item of this.stockItems) {
      this._selected[item.uniqueKey] = true;
    }
  }

  selectAllOOS() {
    this.clearStockSelection();
    for (const item of this.oosItems) {
      this._selected[item.uniqueKey] = true;
    }
  }

  toggleSelectAllStock() {
    if (this.allSelectedStockItems) {
      this.clearStockSelection();
    } else {
      this.selectAllStock();
    }
    this.saveSelection();
  }

  toggleSelectAllOOS() {
    if (this.allSelectedOOSItems) {
      this.clearOOSSelection();
    } else {
      this.selectAllOOS();
    }
    this.saveSelection();
  }

  removeSelectedItems() {
    const keys = new Set(
      this._items.map((i) => i.uniqueKey).filter((k) => this._selected[k])
    );

    this._items = this._items.filter((i) => !keys.has(i.uniqueKey));
    for (const k of keys) delete this._selected[k];

    this.saveBasket();
    this.saveSelection();
  }

  addItem(item) {
    const uniqueKey = JSON.stringify({
      id: item.id,
      options: item.selectedOptions,
    });

    const existingItem = this._items.find((i) => i.uniqueKey === uniqueKey);

    if (existingItem) {
      existingItem.count += 1;

      if (this.isOOS(existingItem)) {
        this._selected[uniqueKey] = false;
      }

      this.normalizeSelectionConflicts();
      this.saveBasket();
      this.saveSelection();
      return;
    }

    const newItem = {
      ...item,
      selectedOptions: item.selectedOptions || {},
      count: 1,
      uniqueKey,
    };

    this._items.push(newItem);

    if (this._selected[uniqueKey] == null) {
      const defaultSelected =
        !this.isOOS(newItem) && !this.hasSelectedPreorders;

      this._selected[uniqueKey] = defaultSelected;
    }

    this.normalizeSelectionConflicts();
    this.saveBasket();
    this.saveSelection();
  }

  removeItem(uniqueKey) {
    this._items = this._items.filter((item) => item.uniqueKey !== uniqueKey);
    delete this._selected[uniqueKey];

    this.saveBasket();
    this.saveSelection();
  }

  updateItemCount(uniqueKey, count) {
    const item = this._items.find((i) => i.uniqueKey === uniqueKey);
    if (!item) return;

    item.count = count;

    if (this.isOOS(item)) {
      this._selected[uniqueKey] = false;
    }

    this.normalizeSelectionConflicts();
    this.saveBasket();
    this.saveSelection();
  }

  updateSelectedOption(itemUniqueKey, optionName, updatedOption) {
    const item = this._items.find((i) => i.uniqueKey === itemUniqueKey);
    if (!item) return;

    if (!item.selectedOptions) item.selectedOptions = {};
    item.selectedOptions[optionName] = updatedOption;

    this.normalizeSelectionConflicts();

    this.saveBasket();
    this.saveSelection();
  }

  getItemCount(uniqueKey) {
    const item = this._items.find((i) => i.uniqueKey === uniqueKey);
    return item ? item.count : 0;
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

  getSelectedTotalPrice() {
    return this.selectedItems.reduce((total, item) => {
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

  clearItems() {
    this._items = [];
    this.clearSelection();
    this.saveBasket();
  }

  saveBasket() {
    localStorage.setItem("basket", JSON.stringify(this._items));
  }

  loadBasket() {
    const savedItems = JSON.parse(localStorage.getItem("basket"));
    if (savedItems && Array.isArray(savedItems)) {
      this._items = savedItems;
    }
  }

  saveSelection() {
    localStorage.setItem("basket_selection", JSON.stringify(this._selected));
  }

  loadSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem("basket_selection"));
      if (saved && typeof saved === "object") {
        this._selected = saved;
      }
    } catch {
      this._selected = {};
    }
  }
}

export default BasketStore;
