import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { Context } from "../index";
import { Pagination } from "react-bootstrap";

const Pages = observer(() => {
  const { device } = useContext(Context);
  const pageCount = Math.ceil(device.totalCount / device.limit);
  const pages = [];

   // Рассчитываем видимые страницы: только те, для которых есть товары
  const visiblePages = Math.min(pageCount, Math.ceil(device.totalCount / device.limit));

  for (let i = 0; i < visiblePages; i++) {
    pages.push(i + 1); // Добавляем номера страниц в массив
  }

  return (
    <Pagination className="mt-3">
      {pages.map((page) => (
        <Pagination.Item
          key={page}
          active={device.page === page}
          onClick={() => device.setPage(page)}
        >
          {page}
        </Pagination.Item>
      ))}
    </Pagination>
  );
});

export default Pages;
