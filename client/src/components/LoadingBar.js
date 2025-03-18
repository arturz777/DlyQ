import React from "react";
import { observer } from "mobx-react-lite";
import appStore from "../store/appStore";
import styles from "./LoadingBar.module.css";

const LoadingBar = observer(() => {
  return appStore.isLoading ? <div className={styles.loadingBar}></div> : null;
});

export default LoadingBar;
