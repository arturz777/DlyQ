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

    this._limit = 50;
    this._facets = { subtypes: [], brands: [], mmSubtypeIdsAll: [] };
    this._loading = { devices: false, subtypes: false };
    this._cursor = null;
    this._hasMore = true;
    this._sort = "price_desc";

    this._totalCount = 0;

    makeAutoObservable(this);
  }

  setTypes(v) {
    this._types = v || [];
  }
  setMakes(v) {
    this._makes = v || [];
  }
  setModels(v) {
    this._models = v || [];
  }

  setSubtypes(v) {
    this._subtypes = v || [];
  }

  setBrands(v) {
    this._brands = v || [];
  }

  setDevices(v) {
    this._devices = typeof v === "function" ? v(this._devices) : v || [];
  }

  setFacets(v) {
    const next = typeof v === "function" ? v(this._facets) : v;
    this._facets = next || { subtypes: [], brands: [], mmSubtypeIdsAll: [] };
  }

  setCursor(c) {
    this._cursor = c || null;
  }
  setHasMore(h) {
    this._hasMore = !!h;
  }
 setLoading(k, v) {
  if (Object.prototype.hasOwnProperty.call(this._loading, k)) {
    this._loading[k] = !!v;
  }
}
  setLimit(n) {
    this._limit = n || this._limit;
  }

  setSort(v) {
    const allowed = ["price_desc", "price_asc", "id_desc", "rating_desc"];
    this._sort = allowed.includes(v) ? v : "price_desc";
    this.resetFeed();
  }

  setPage() {
    this.resetFeed();
  }

  setActiveType(type) {
    this._selectedType = type || {};
  }

  setTotalCount(n) {
    this._totalCount = Number(n) || 0;
  }

  resetFeed() {
    this._devices = [];
    this._cursor = null;
    this._hasMore = true;
    this._loading.devices = false;
  }
  appendDevices(items) {
    this._devices = [...this._devices, ...(items || [])];
  }

  setSelectedType(type) {
    const same = this._selectedType.id === type?.id;
    if (same) {
      this._selectedType = {};
      this._selectedSubType = {};
      this._selectedMake = {};
      this._selectedModel = {};
      this._selectedBrand = {};
    } else {
      this._selectedType = type || {};
      this._selectedSubType = {};
      this._selectedMake = {};
      this._selectedModel = {};
      this._selectedBrand = {};
    }
    this.resetFeed();
  }

  setSelectedMake(make) {
    const same = this._selectedMake.id === make?.id;
    if (same) {
      this._selectedMake = {};
      this._selectedModel = {};
      this._selectedSubType = {};
      this._selectedBrand = {};
    } else {
      this._selectedMake = make || {};
      this._selectedModel = {};
      this._selectedSubType = {};
      this._selectedBrand = {};
    }
    this.resetFeed();
  }

  setSelectedModel(model) {
    const same = this._selectedModel.id === model?.id;
    if (same) {
      this._selectedModel = {};
      this._selectedSubType = {};
      this._selectedBrand = {};
    } else {
      this._selectedModel = model || {};
      this._selectedSubType = {};
      this._selectedBrand = {};
    }
    this.resetFeed();
  }

  clearSelectedSubType() {
    this._selectedSubType = {};
    this._selectedBrand = {};
    this.resetFeed();
  }

  setSelectedSubType(subtype) {
    if (!subtype || !subtype.id) {
      this._selectedSubType = {};
      this._selectedBrand = {};
      this.resetFeed();
      return;
    }
    if (this._selectedSubType.id === subtype.id) {
      this._selectedSubType = {};
      this._selectedBrand = {};
    } else {
      this._selectedSubType = subtype;
      this._selectedBrand = {};
    }
    this.resetFeed();
  }

  setSelectedBrand(brand) {
    this._selectedBrand =
      this._selectedBrand.id === brand?.id ? {} : brand || {};
    this.resetFeed();
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

  get limit() {
    return this._limit;
  }
  get facets() {
    return this._facets;
  }
  get loading() {
    return this._loading;
  }
  get isLoadingAnything() {
    return this._loading.devices || this._loading.subtypes;
  }
  get cursor() {
    return this._cursor;
  }
  get hasMore() {
    return this._hasMore;
  }
  get sort() {
    return this._sort;
  }
  get totalCount() {
    return this._totalCount;
  }

  get queryParams() {
    return {
      typeId: this._selectedType.id ?? null,
      subtypeId: this._selectedSubType.id ?? null,
      makeId: this._selectedMake.id ?? null,
      modelId: this._selectedModel.id ?? null,
      brandId: this._selectedBrand.id ?? null,
      limit: this._limit,
      cursor: this._cursor,
      sort: this._sort,
    };
  }
}
