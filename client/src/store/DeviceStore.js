import { makeAutoObservable } from "mobx";

export default class DeviceStore {
  constructor() {
    this._types = [];
    this._makes = [];
    this._models = [];
    this._subtypes = [];
    this._brands = [];
    this._devices = [];
    this._selectedType = {};
    this._selectedMake = {};
    this._selectedModel = {};
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

  setMakes(makes) {
    this._makes = makes;
  }
  setModels(models) {
    this._models = models;
  }

  setSubtypes(subtypes) {
    this._subtypes = subtypes.map((subtype) => ({
      ...subtype,
      translations: subtype.translations || {},
    }));
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
      this._selectedMake = {};
      this._selectedModel = {};
    } else {
      this.setPage(1);
      this._selectedType = type;
      this._selectedSubType = {};
    }
  }

  setSelectedMake(make) {
    if (this._selectedMake.id === make.id) {
      this._selectedMake = {};
      this._selectedModel = {};
      this._selectedSubType = {};
    } else {
      this._selectedMake = make;
      this._selectedModel = {};
      this._selectedSubType = {};
    }
    this.setPage(1);
  }

   setSelectedModel(model) {
    if (this._selectedModel.id === model.id) {
      this._selectedModel = {};
      this._selectedSubType = {};
    } else {
      this._selectedModel = model;
      this._selectedSubType = {};
    }
    this.setPage(1);
  }

   clearSelectedSubType() {
    this._selectedSubType = {};
    this.setPage(1);
  }

  setSelectedSubType(subtype) {
    if (!subtype || !subtype.id) {
      this._selectedSubType = {};
      this.setPage(1);
      return;
    }
    if (this._selectedSubType.id === subtype.id) {
      this._selectedSubType = {};
    } else {
      this._selectedSubType = subtype;
    }
    this.setPage(1);
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
  get makes() {
    return this._makes;
  }
  get models() {
    return this._models;
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
  get selectedMake() {
    return this._selectedMake;
  }
  get selectedModel() {
    return this._selectedModel;
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
