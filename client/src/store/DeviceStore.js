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
    this._selectedType = {};
    this._selectedSubType = {};
  }

  setActiveType(type) {
    this._selectedType = type;
  }

  setSubtypes(subtypes) {
    this._subtypes = subtypes;
    this._selectedSubType = {};
  }
  
  setBrands(brands) {
    this._brands = brands;
  }
  setDevices(devices) {
    this._devices = devices;
  }

  setSelectedType(type) {
    if (this._selectedType.id === type.id) {
      this._selectedType = {};
      this._selectedSubType = {};
    } else {
      this.setPage(1);
      this._selectedType = type;
      this._selectedSubType = {};
    }
  }

  setSelectedSubType(subtype) {
    if (this._selectedSubType.id === subtype.id) {
      this._selectedSubType = {};
    } else {
      this.setPage(1);
      this._selectedSubType = subtype;
    }
  }

  setSelectedBrand(brand) {
    if (this._selectedBrand.id === brand.id) {
      this._selectedBrand = {};
    } else {
      this.setPage(1);
      this._selectedBrand = brand;
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
