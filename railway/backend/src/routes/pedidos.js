const express = require('express');
const router  = express.Router();
const db      = require('../db');
const multer  = require('multer');

// Migración segura: columna descuento por línea
db.query(`ALTER TABLE lineas_pedido ADD COLUMN IF NOT EXISTS descuento_linea_pct NUMERIC`).catch(() => {});
const path    = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/albaranes')),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

async function siguienteNumero(serie_id, client) {
  const { rows } = await client.query(`SELECT fn_siguiente_numero_serie($1) AS numero`, [serie_id]);
  return rows[0].numero;
}

router.get('/', async (req, res) => {
  try {
    const { desde, hasta, entidad_id, serie_id, estado, referencia_id } = req.query;
    let sql = `SELECT p.*,
                 e.nombre_comercial  AS entidad_nombre,
                 e.codigo            AS entidad_codigo,
                 eb.nombre_comercial AS bodega_nombre,
                 s.nombre            AS serie_nombre,
                 s.prefijo           AS serie_prefijo
               FROM pedidos p
               LEFT JOIN entidades e   ON e.id  = p.entidad_id
               LEFT JOIN entidades eb  ON eb.id = p.bodega_entidad_id
               LEFT JOIN series_pedido s ON s.id = p.serie_id
               WHERE 1=1`;
    const params = [];
    if (desde)      { params.push(desde);      sql += ` AND p.fecha >= $${params.length}`; }
    if (hasta)      { params.push(hasta);      sql += ` AND p.fecha <= $${params.length}`; }
    if (entidad_id) { params.push(entidad_id); sql += ` AND p.entidad_id = $${params.length}`; }
    if (serie_id)   { params.push(serie_id);   sql += ` AND p.serie_id = $${params.length}`; }
    if (estado)     { params.push(estado);     sql += ` AND p.estado = $${params.length}`; }
    if (referencia_id) {
      params.push(referencia_id);
      sql += ` AND p.id IN (SELECT pedido_id FROM lineas_pedido WHERE referencia_id = $${params.length})`;
    }
    sql += ` ORDER BY p.fecha DESC, p.id DESC`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const pedido = await db.query(
      `SELECT p.*,
              e.nombre_comercial AS entidad_nombre, e.codigo AS entidad_codigo,
              e.nif AS entidad_nif, e.direccion_fiscal, e.poblacion_fiscal, e.cp_fiscal,
              e.direccion_almacen, e.poblacion_almacen,
              eb.nombre_comercial AS bodega_nombre, eb.email AS bodega_email,
              eb.direccion_fiscal AS bodega_direccion, eb.poblacion_fiscal AS bodega_poblacion,
              eb.cp_fiscal AS bodega_cp, eb.provincia_fiscal AS bodega_provincia, eb.nif AS bodega_nif,
              s.nombre AS serie_nombre, s.prefijo AS serie_prefijo
       FROM pedidos p
       LEFT JOIN entidades e   ON e.id  = p.entidad_id
       LEFT JOIN entidades eb  ON eb.id = p.bodega_entidad_id
       LEFT JOIN series_pedido s ON s.id = p.serie_id
       WHERE p.id = $1`, [req.params.id]
    );
    if (!pedido.rows.length) return res.status(404).json({ error: 'No encontrado' });
    const lineas = await db.query(
      `SELECT lp.*, r.codigo AS ref_codigo, r.nombre AS ref_nombre
       FROM lineas_pedido lp JOIN referencias r ON r.id = lp.referencia_id
       WHERE lp.pedido_id = $1 ORDER BY lp.id`, [req.params.id]
    );
    res.json({ ...pedido.rows[0], lineas: lineas.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { fecha, serie_id, entidad_id, bodega_entidad_id,
            porcentaje_iva, descuento_euros, descuento_pct, observaciones, lineas } = req.body;

    const numero = await siguienteNumero(serie_id, client);
    let base_imponible = 0, total_comisiones = 0;
    const piva = parseFloat(porcentaje_iva || 21);

    for (const l of lineas) {
      const cajas_total = parseFloat(l.cantidad_cajas) + parseFloat(l.cajas_promo || 0);
      const precio_caja = parseFloat(l.precio_botella) * parseInt(l.botellas_por_caja);
      const bruto       = cajas_total * precio_caja;
      const base_linea  = bruto - parseFloat(l.descuento_euros || 0) - (bruto * parseFloat(l.descuento_pct || 0) / 100);
      base_imponible   += base_linea;
      total_comisiones += base_linea * parseFloat(l.comision_pct || 0) / 100;
      l._base_linea     = base_linea;
      l._precio_caja    = precio_caja;
      l._importe_com    = base_linea * parseFloat(l.comision_pct || 0) / 100;
    }

    const dto_e = parseFloat(descuento_euros || 0);
    const dto_p = parseFloat(descuento_pct   || 0);
    base_imponible = base_imponible - dto_e - (base_imponible * dto_p / 100);
    const iva   = base_imponible * piva / 100;
    const total = base_imponible + iva;

    const { rows: [pedido] } = await client.query(
      `INSERT INTO pedidos (numero,fecha,serie_id,entidad_id,bodega_entidad_id,
         base_imponible,porcentaje_iva,iva,total,total_comisiones,
         descuento_euros,descuento_pct,observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [numero, fecha || new Date().toISOString().split('T')[0],
       serie_id, entidad_id, bodega_entidad_id,
       base_imponible.toFixed(2), piva, iva.toFixed(2), total.toFixed(2),
       total_comisiones.toFixed(2), descuento_euros || 0, descuento_pct || 0, observaciones]
    );

    for (const l of lineas) {
      await client.query(
        `INSERT INTO lineas_pedido (pedido_id,referencia_id,cantidad_cajas,cajas_promo,botellas_por_caja,
           precio_botella,precio_caja,descuento_euros,descuento_pct,comision_pct,importe_comision,base_imponible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [pedido.id, l.referencia_id, l.cantidad_cajas, l.cajas_promo || 0, l.botellas_por_caja,
         l.precio_botella, l._precio_caja.toFixed(2),
         l.descuento_euros || 0, l.descuento_pct || 0,
         l.comision_pct || 0, l._importe_com.toFixed(2), l._base_linea.toFixed(2)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(pedido);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Actualiza descuento, IVA y líneas de un pedido
router.put('/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { descuento_pct, porcentaje_iva, lineas } = req.body;

    // Recalcular totales usando descuento por línea si existe, sino el del pedido
    const dPct   = parseFloat(descuento_pct) || 0;
    const ivaPct = parseFloat(porcentaje_iva) || 21;
    let baseDesc = 0;
    for (const l of lineas) {
      const base     = (parseFloat(l.cantidad_cajas)||0) * (parseFloat(l.botellas_por_caja)||0) * (parseFloat(l.precio_botella)||0);
      const dtoLinea = (l.descuento_linea_pct !== null && l.descuento_linea_pct !== undefined)
                       ? parseFloat(l.descuento_linea_pct) : dPct;
      baseDesc += base * (1 - dtoLinea / 100);
    }
    const iva   = baseDesc * ivaPct / 100;
    const total = baseDesc + iva;

    const { rows } = await client.query(
      `UPDATE pedidos SET descuento_pct=$1, porcentaje_iva=$2,
         base_imponible=$3, iva=$4, total=$5
       WHERE id=$6 RETURNING *`,
      [dPct, ivaPct, baseDesc, iva, total, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No encontrado' }); }

    // Reemplazar líneas y calcular total comisiones
    await client.query(`DELETE FROM lineas_pedido WHERE pedido_id=$1`, [req.params.id]);
    let totalComisiones = 0;
    for (const l of lineas) {
      const cajas     = parseFloat(l.cantidad_cajas)    || 0;
      const bpc       = parseFloat(l.botellas_por_caja) || 0;
      const pbot      = parseFloat(l.precio_botella)    || 0;
      const comPct    = parseFloat(l.comision_pct)      || 0;
      // Descuento por línea: usa el específico de la línea, si no el del pedido
      const dtoLinea  = (l.descuento_linea_pct !== null && l.descuento_linea_pct !== undefined)
                        ? parseFloat(l.descuento_linea_pct) : dPct;
      const precioCaja    = pbot * bpc;
      const base          = cajas * precioCaja;
      const baseLineaDesc = base * (1 - dtoLinea / 100);
      const importeCom    = baseLineaDesc * comPct / 100;
      totalComisiones    += importeCom;
      const dtoLineaVal   = (l.descuento_linea_pct !== null && l.descuento_linea_pct !== undefined)
                            ? parseFloat(l.descuento_linea_pct) : null;
      await client.query(
        `INSERT INTO lineas_pedido (pedido_id, referencia_id, cantidad_cajas, cajas_promo, botellas_por_caja, precio_botella, precio_caja, base_imponible, comision_pct, importe_comision, descuento_linea_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [req.params.id, l.referencia_id, cajas, l.cajas_promo||0, bpc, pbot,
         precioCaja.toFixed(2), baseLineaDesc.toFixed(2), comPct, importeCom.toFixed(2), dtoLineaVal]
      );
    }

    // Actualizar también total_comisiones en el pedido
    await client.query(
      `UPDATE pedidos SET total_comisiones=$1 WHERE id=$2`,
      [totalComisiones.toFixed(2), req.params.id]
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.put('/:id/estado', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE pedidos SET estado=$1 WHERE id=$2 RETURNING *`, [req.body.estado, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/albaran', upload.single('albaran'), async (req, res) => {
  try {
    const archivo = req.file ? req.file.filename : null;
    const { rows } = await db.query(
      `UPDATE pedidos SET albaran_escaneado=true,albaran_archivo=$1,estado='servido' WHERE id=$2 RETURNING *`,
      [archivo, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
