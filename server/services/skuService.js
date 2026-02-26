const sequelize = require("../db");
const { QueryTypes } = require("sequelize");
const { Type } = require("../models/models");

function pad(n, len = 6) {
  return String(n).padStart(len, "0");
}

async function nextSkuForType(typeId, transaction) {
  const type = await Type.findByPk(typeId, { transaction });
  const codeRaw = (type?.code || "").trim();
  if (!codeRaw) throw new Error(`Type ${typeId} has no code for SKU`);
  const code = codeRaw.toUpperCase();

  await sequelize.query(
    `
    INSERT INTO "warehouse_counters" ("typeId","lastNumber")
    VALUES (:typeId, 0)
    ON CONFLICT ("typeId") DO NOTHING
    `,
    { replacements: { typeId }, type: QueryTypes.INSERT, transaction }
  );

  const rows = await sequelize.query(
    `
    SELECT "lastNumber"
    FROM "warehouse_counters"
    WHERE "typeId" = :typeId
    FOR UPDATE
    `,
    { replacements: { typeId }, type: QueryTypes.SELECT, transaction }
  );

  const last = Number(rows?.[0]?.lastNumber || 0);
  const next = last + 1;

  await sequelize.query(
    `
    UPDATE "warehouse_counters"
    SET "lastNumber" = :next, "updatedAt" = now()
    WHERE "typeId" = :typeId
    `,
    { replacements: { typeId, next }, type: QueryTypes.UPDATE, transaction }
  );

  return `${code}-${pad(next)}`;
}

module.exports = { nextSkuForType };
