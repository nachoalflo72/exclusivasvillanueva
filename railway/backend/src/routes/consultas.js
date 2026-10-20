const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/consultas/kpis — métricas agregadas según filtros
router.get('/kpis', async (req, res) => {
  try {
    const { desde, hasta, entidad_id, bodega_id, referencia_id } = req.query;

    // Construir cláusulas de fecha reutilizables
    const buildFechaWhere = (baseIdx) => {
      const params = [];
      const clauses = [];
      if (desde) { params.push(desde); clauses.push(`p.fecha >= $${baseIdx + params.length}`); }
      if (hasta) { params.push(hasta); clauses.push(`p.fecha <= $${baseIdx + params.length}`); }
      return { params, where: clauses.length ? ' AND ' + clauses.join(' AND ') : '' };
    };

    const result = {};

    // ── KPIs de BODEGA ────────────────────────────────────────
    if (bodega_id) {
      // 1. Nº botellas vendidas de esa bodega
      const f1 = buildFechaWhere(1);
      const { rows: r1 } = await db.query(
        `SELECT COALESCE(SUM((lp.cantidad_cajas + lp.cajas_promo) * lp.botellas_por_caja), 0) AS total
         FROM lineas_pedido lp
         JOIN pedidos p ON p.id = lp.pedido_id
         WHERE p.bodega_entidad_id = $1 ${f1.where}`,
        [bodega_id, ...f1.params]
      );
      result.bodega_botellas = parseFloat(r1[0].total);

      // 2. Importe total de pedidos de esa bodega
      const f2 = buildFechaWhere(1);
      const { rows: r2 } = await db.query(
        `SELECT COALESCE(SUM(p.total), 0) AS total_importe
         FROM pedidos p
         WHERE p.bodega_entidad_id = $1 ${f2.where}`,
        [bodega_id, ...f2.params]
      );
      result.bodega_importe = parseFloat(r2[0].total_importe);

      // 3. Comisiones de esa bodega
      const f3 = buildFechaWhere(1);
      const { rows: r3 } = await db.query(
        `SELECT COALESCE(SUM(p.total_comisiones), 0) AS total
         FROM pedidos p
         WHERE p.bodega_entidad_id = $1 ${f3.where}`,
        [bodega_id, ...f3.params]
      );
      result.bodega_comisiones = parseFloat(r3[0].total);
    }

    // ── KPIs de CLIENTE/ENTIDAD ───────────────────────────────
    if (entidad_id) {
      // 4. Nº botellas vendidas a ese cliente
      const f4 = buildFechaWhere(1);
      const { rows: r4 } = await db.query(
        `SELECT COALESCE(SUM((lp.cantidad_cajas + lp.cajas_promo) * lp.botellas_por_caja), 0) AS total
         FROM lineas_pedido lp
         JOIN pedidos p ON p.id = lp.pedido_id
         WHERE p.entidad_id = $1 ${f4.where}`,
        [entidad_id, ...f4.params]
      );
      result.cliente_botellas = parseFloat(r4[0].total);

      // 5. Importe de pedidos de ese cliente
      const f5 = buildFechaWhere(1);
      const { rows: r5 } = await db.query(
        `SELECT COALESCE(SUM(p.total), 0) AS total
         FROM pedidos p
         WHERE p.entidad_id = $1 ${f5.where}`,
        [entidad_id, ...f5.params]
      );
      result.cliente_importe = parseFloat(r5[0].total);

      // 6. Dinero facturado a ese cliente (facturas)
      const fechaFactParams = [entidad_id];
      let sqlFacturas = `SELECT COALESCE(SUM(f.total), 0) AS total FROM facturas f WHERE f.entidad_id = $1`;
      if (desde) { fechaFactParams.push(desde); sqlFacturas += ` AND f.fecha >= $${fechaFactParams.length}`; }
      if (hasta)  { fechaFactParams.push(hasta);  sqlFacturas += ` AND f.fecha <= $${fechaFactParams.length}`; }
      const { rows: r6 } = await db.query(sqlFacturas, fechaFactParams);
      result.cliente_facturado = parseFloat(r6[0].total);
    }

    // ── KPIs de REFERENCIA ────────────────────────────────────
    if (referencia_id) {
      // 7. Nº botellas totales de esa referencia
      const f7 = buildFechaWhere(1);
      const { rows: r7 } = await db.query(
        `SELECT COALESCE(SUM((lp.cantidad_cajas + lp.cajas_promo) * lp.botellas_por_caja), 0) AS total
         FROM lineas_pedido lp
         JOIN pedidos p ON p.id = lp.pedido_id
         WHERE lp.referencia_id = $1 ${f7.where}`,
        [referencia_id, ...f7.params]
      );
      result.ref_botellas_total = parseFloat(r7[0].total);

      // 8. Nº botellas de esa referencia a un cliente concreto
      if (entidad_id) {
        const f8 = buildFechaWhere(2);
        const { rows: r8 } = await db.query(
          `SELECT COALESCE(SUM((lp.cantidad_cajas + lp.cajas_promo) * lp.botellas_por_caja), 0) AS total
           FROM lineas_pedido lp
           JOIN pedidos p ON p.id = lp.pedido_id
           WHERE lp.referencia_id = $1
             AND p.entidad_id = $2
             ${f8.where}`,
          [referencia_id, entidad_id, ...f8.params]
        );
        result.ref_botellas_cliente = parseFloat(r8[0].total);
      }
    }

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/consultas — listado de pedidos con filtros
router.get('/', async (req, res) => {
  try {
    const { desde, hasta, entidad_id, bodega_id, referencia_id } = req.query;
    let sql = `SELECT p.fecha, p.numero AS numero_pedido,
      e.codigo AS codigo_cliente, e.nombre_comercial AS nombre_cliente,
      p.total AS importe
    FROM pedidos p
    LEFT JOIN entidades e ON e.id = p.entidad_id
    WHERE 1=1`;
    const params = [];
    if (desde)         { params.push(desde);         sql += ` AND p.fecha >= $${params.length}`; }
    if (hasta)         { params.push(hasta);         sql += ` AND p.fecha <= $${params.length}`; }
    if (entidad_id)    { params.push(entidad_id);    sql += ` AND p.entidad_id = $${params.length}`; }
    if (bodega_id)     { params.push(bodega_id);     sql += ` AND p.bodega_entidad_id = $${params.length}`; }
    if (referencia_id) {
      params.push(referencia_id);
      sql += ` AND p.id IN (SELECT pedido_id FROM lineas_pedido WHERE referencia_id = $${params.length})`;
    }
    sql += ' ORDER BY p.fecha DESC';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
