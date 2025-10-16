import { makeAutoObservable } from "mobx";

class AppStore {
  isLoading = false;
  showLoader = false;
  maintenance = { enabled: false };
  maintenanceLoaded = false;

  constructor() {
    makeAutoObservable(this);
  }

  startLoading() {
    this.isLoading = true;
    this.showLoader = true;
  }

  stopLoading() {
    setTimeout(() => {
      this.isLoading = false;
      setTimeout(() => {
        this.showLoader = false;
      }, 300); 
    }, 500); 
  }

  setIsLoading(value) {
    this.isLoading = value;
  }

    setMaintenance(value) {
    this.maintenance = { enabled: !!value?.enabled };
    this.maintenanceLoaded = true; 
  }
}

export default new AppStore();
