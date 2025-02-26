import React, {useContext} from 'react';
import {observer} from "mobx-react-lite";
import {Context} from "../index";
import styles from "./TypeBar.module.css";

const TypeBar = observer(() => {
	const {device} = useContext(Context)


	return (
		<div className={styles.typeBar}>
		{device.types.map(type => (
			<div
				key={type.id}
				id={`type-${type.id}`}
				className={`${styles.typeItem} ${type.id === device.selectedType.id ? styles.active : ''}`}
				onClick={() => {
					device.setSelectedType(type); // Устанавливаем выбранный тип
					document.getElementById(`type-${type.id}`).scrollIntoView({
						behavior: "smooth", // Плавная прокрутка
						block: "start",
					  });
				}}
			>
			<img src={type.img} alt={type.name} className={styles.typeImage} />
			<span className={styles.typeName}>{type.name}</span>
			</div>
		))}
	</div>


	);
});

export default TypeBar;
