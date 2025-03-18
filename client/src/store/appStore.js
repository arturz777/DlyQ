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
      }, 300); // 🔥 Даем 300 мс на плавное исчезновение
    }, 500); // 🔥 Минимум 500 мс показываем
  }
}

export default new AppStore();
