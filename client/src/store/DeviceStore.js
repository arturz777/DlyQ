import { makeAutoObservable } from "mobx";

export default class DeviceStore {
  constructor() {
    this._types = [];
    this._subtypes = [];
    this._brands = [];
    this._devices = [];
    this._selectedType = {};
    this._selectedSubType = {};
    this._selectedBrand = {};
    this._page = 1;
    this._totalCount = 0;
    this._limit = 20;
    makeAutoObservable(this);
  }

  setTypes(types) {
    this._types = types;
  }
  setActiveType(type) {
    this._selectedType = type;
  }
  setSubtypes(subtypes) {
    this._subtypes = subtypes;
  }
  
  setBrands(brands) {
    this._brands = brands;
  }
  setDevices(devices) {
    this._devices = devices;
  }

  setSelectedType(type) {
    if (this._selectedType.id === type.id) {
      this._selectedType = {}; // Сбрасываем выбранный тип
      this._selectedSubType = {}; // Сбрасываем подтип
    } else {
      this.setPage(1);
      this._selectedType = type;
      this._selectedSubType = {}; // Сбрасываем подтип при смене типа
    }
  }

  setSelectedSubType(subtype) {
    // Если выбранный подтип тот же, что и уже выбранный, сбрасываем фильтр
    if (this._selectedSubType.id === subtype.id) {
      this._selectedSubType = {}; // Сбрасываем выбранный подтип
    } else {
      this.setPage(1);
      this._selectedSubType = subtype; // Устанавливаем новый подтип
    }
  }

  setSelectedBrand(brand) {
    // Если выбранный бренд тот же, что и уже выбранный, сбрасываем фильтр
    if (this._selectedBrand.id === brand.id) {
      this._selectedBrand = {}; // Сбрасываем выбранный бренд
    } else {
      this.setPage(1);
      this._selectedBrand = brand; // Устанавливаем новый бренд
    }
  }
  setPage(page) {
    this._page = page;
  }
  setTotalCount(count) {
    this._totalCount = count;
  }

  get types() {
    return this._types;
  }
  get subtypes() {
    return this._subtypes;
  }
  get brands() {
    return this._brands;
  }
  get devices() {
    return this._devices;
  }
  get selectedType() {
    return this._selectedType;
  }
  get selectedSubType() {
    return this._selectedSubType;
  }
  get selectedBrand() {
    return this._selectedBrand;
  }
  get totalCount() {
    return this._totalCount;
  }
  get page() {
    return this._page;
  }
  get limit() {
    return this._limit;
  }
}
