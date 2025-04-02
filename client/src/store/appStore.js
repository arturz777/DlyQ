import { makeAutoObservable } from "mobx";

class AppStore {
  isLoading = false;
  showLoader = false;

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
}

export default new AppStore();
