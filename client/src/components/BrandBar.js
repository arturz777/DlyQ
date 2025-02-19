// BrandBar.js
import React, { useContext } from 'react';
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { Card, Row, Col } from "react-bootstrap";
import styles from './BrandBar.module.css'; 

const BrandBar = observer(() => {
    const { device } = useContext(Context);

    const handleBrandClick = (brand) => {
      if (device.selectedBrand.id !== brand.id) {
        device.setSelectedBrand(brand); // Устанавливаем бренд, только если он изменился
      } else {
        device.setSelectedBrand({}); // Сбрасываем, если кликнули на тот же бренд
      }
    };

    return (
      <div className={styles.brandBar}>
      {device.brands.map((brand) => (
          <div
          key={brand.id} 
          className={`${styles.brandItem} ${brand.id === device.selectedBrand.id ? styles.active : ''}`}
          onClick={() => handleBrandClick(brand)}
          >
            <span>{brand.name}</span>
          </div>
      ))}
  </div>

    );
});

export default BrandBar;