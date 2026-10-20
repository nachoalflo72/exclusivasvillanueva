-- ============================================================
-- EXCLUSIVAS VILLANUEVA - Esquema PostgreSQL v2
-- ============================================================

-- ── ENTIDADES (unifica bodegas, clientes, comerciales) ──────
CREATE TABLE entidades (
    id                  SERIAL PRIMARY KEY,
    tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('bodega','cliente','comercial','distribuidor')),
    codigo              VARCHAR(20) UNIQUE NOT NULL,
    nombre_comercial    VARCHAR(150) NOT NULL,
    nombre_fiscal       VARCHAR(150),
    nif                 VARCHAR(20),
    persona_contacto    VARCHAR(100),
    telefono            VARCHAR(20),
    movil               VARCHAR(20),
    email               VARCHAR(100),
    direccion_fiscal    VARCHAR(200),
    poblacion_fiscal    VARCHAR(100),
    provincia_fiscal    VARCHAR(100),
    cp_fiscal           VARCHAR(10),
    direccion_almacen   VARCHAR(200),
    poblacion_almacen   VARCHAR(100),
    provincia_almacen   VARCHAR(100),
    cp_almacen          VARCHAR(10),
    forma_pago          VARCHAR(50),
    cuenta_bancaria     VARCHAR(30),
    comision_defecto    NUMERIC(5,2) DEFAULT 0.00,
    activa              BOOLEAN DEFAULT TRUE,
    observaciones       TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ── SERIES DE PEDIDO ────────────────────────────────────────
CREATE TABLE series_pedido (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,
    prefijo     VARCHAR(10) NOT NULL,
    descripcion TEXT,
    contador    INTEGER DEFAULT 0,
    activa      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ── REFERENCIAS ─────────────────────────────────────────────
CREATE TABLE referencias (
    id                  SERIAL PRIMARY KEY,
    codigo              VARCHAR(30) UNIQUE NOT NULL,
    nombre              VARCHAR(200) NOT NULL,
    bodega_entidad_id   INTEGER NOT NULL REFERENCES entidades(id),
    precio_compra       NUMERIC(10,2) DEFAULT 0.00,
    precio_venta        NUMERIC(10,2) DEFAULT 0.00,
    botellas_por_caja   INTEGER DEFAULT 6,
    comision            NUMERIC(5,2) DEFAULT 0.00,
    promo_activa        BOOLEAN DEFAULT FALSE,
    promo_cajas_compra  INTEGER,
    promo_cajas_regalo  INTEGER,
    activa              BOOLEAN DEFAULT TRUE,
    observaciones       TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ── PEDIDOS ──────────────────────────────────────────────────
CREATE TABLE pedidos (
    id                  SERIAL PRIMARY KEY,
    numero              VARCHAR(30) UNIQUE NOT NULL,
    fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
    serie_id            INTEGER NOT NULL REFERENCES series_pedido(id),
    entidad_id          INTEGER NOT NULL REFERENCES entidades(id),
    bodega_entidad_id   INTEGER NOT NULL REFERENCES entidades(id),
    base_imponible      NUMERIC(10,2) DEFAULT 0.00,
    porcentaje_iva      NUMERIC(5,2) DEFAULT 21.00,
    iva                 NUMERIC(10,2) DEFAULT 0.00,
    total               NUMERIC(10,2) DEFAULT 0.00,
    total_comisiones    NUMERIC(10,2) DEFAULT 0.00,
    descuento_euros     NUMERIC(10,2) DEFAULT 0.00,
    descuento_pct       NUMERIC(5,2) DEFAULT 0.00,
    estado              VARCHAR(20) DEFAULT 'borrador'
                        CHECK (estado IN ('borrador','enviado','servido','facturado','anulado')),
    comision_liquidada  BOOLEAN DEFAULT FALSE,
    fecha_liquidacion   DATE,
    email_enviado       BOOLEAN DEFAULT FALSE,
    fecha_email         TIMESTAMP,
    albaran_escaneado   BOOLEAN DEFAULT FALSE,
    albaran_archivo     VARCHAR(300),
    observaciones       TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ── LINEAS PEDIDO ────────────────────────────────────────────
CREATE TABLE lineas_pedido (
    id                  SERIAL PRIMARY KEY,
    pedido_id           INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    referencia_id       INTEGER NOT NULL REFERENCES referencias(id),
    cantidad_cajas      NUMERIC(10,2) NOT NULL DEFAULT 0,
    cajas_promo         NUMERIC(10,2) DEFAULT 0,
    botellas_por_caja   INTEGER NOT NULL,
    precio_botella      NUMERIC(10,2) NOT NULL,
    precio_caja         NUMERIC(10,2) NOT NULL,
    descuento_euros     NUMERIC(10,2) DEFAULT 0.00,
    descuento_pct       NUMERIC(5,2) DEFAULT 0.00,
    comision_pct        NUMERIC(5,2) DEFAULT 0.00,
    importe_comision    NUMERIC(10,2) DEFAULT 0.00,
    base_imponible      NUMERIC(10,2) DEFAULT 0.00,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- ── FACTURAS ─────────────────────────────────────────────────
CREATE TABLE facturas (
    id                  SERIAL PRIMARY KEY,
    numero              VARCHAR(30) UNIQUE NOT NULL,
    fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
    entidad_id          INTEGER NOT NULL REFERENCES entidades(id),
    base_imponible      NUMERIC(10,2) DEFAULT 0.00,
    porcentaje_iva      NUMERIC(5,2) DEFAULT 21.00,
    iva                 NUMERIC(10,2) DEFAULT 0.00,
    total               NUMERIC(10,2) DEFAULT 0.00,
    estado              VARCHAR(20) DEFAULT 'emitida'
                        CHECK (estado IN ('emitida','cobrada','anulada')),
    email_enviado       BOOLEAN DEFAULT FALSE,
    fecha_email         TIMESTAMP,
    observaciones       TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ── LINEAS FACTURA ───────────────────────────────────────────
CREATE TABLE lineas_factura (
    id              SERIAL PRIMARY KEY,
    factura_id      INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
    pedido_id       INTEGER REFERENCES pedidos(id),
    referencia_id   INTEGER REFERENCES referencias(id),
    descripcion     VARCHAR(300),
    cantidad_cajas  NUMERIC(10,2),
    precio_unitario NUMERIC(10,2),
    base_imponible  NUMERIC(10,2) DEFAULT 0.00,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── STOCK ─────────────────────────────────────────────────────
CREATE TABLE stock (
    id              SERIAL PRIMARY KEY,
    referencia_id   INTEGER NOT NULL UNIQUE REFERENCES referencias(id),
    cantidad_cajas  NUMERIC(10,2) DEFAULT 0.00,
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE movimientos_stock (
    id              SERIAL PRIMARY KEY,
    referencia_id   INTEGER NOT NULL REFERENCES referencias(id),
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
    cantidad_cajas  NUMERIC(10,2) NOT NULL,
    motivo          VARCHAR(100),
    pedido_id       INTEGER REFERENCES pedidos(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── CONFIGURACION ─────────────────────────────────────────────
CREATE TABLE configuracion (
    id               INTEGER PRIMARY KEY DEFAULT 1,
    nombre_comercial VARCHAR(150),
    nif              VARCHAR(20),
    direccion        VARCHAR(200),
    poblacion        VARCHAR(100),
    provincia        VARCHAR(100),
    cp               VARCHAR(10),
    telefono         VARCHAR(20),
    email            VARCHAR(100),
    smtp_host        VARCHAR(100),
    smtp_puerto      INTEGER DEFAULT 587,
    smtp_usuario     VARCHAR(100),
    smtp_password    VARCHAR(200),
    smtp_remitente   VARCHAR(100),
    iva_defecto      NUMERIC(5,2) DEFAULT 21.00,
    updated_at       TIMESTAMP DEFAULT NOW()
);

-- ── INDICES ───────────────────────────────────────────────────
CREATE INDEX idx_pedidos_fecha        ON pedidos(fecha);
CREATE INDEX idx_pedidos_entidad      ON pedidos(entidad_id);
CREATE INDEX idx_pedidos_bodega       ON pedidos(bodega_entidad_id);
CREATE INDEX idx_pedidos_serie        ON pedidos(serie_id);
CREATE INDEX idx_pedidos_estado       ON pedidos(estado);
CREATE INDEX idx_lineas_pedido        ON lineas_pedido(pedido_id);
CREATE INDEX idx_lineas_referencia    ON lineas_pedido(referencia_id);
CREATE INDEX idx_referencias_bodega   ON referencias(bodega_entidad_id);
CREATE INDEX idx_facturas_entidad     ON facturas(entidad_id);
CREATE INDEX idx_entidades_tipo       ON entidades(tipo);

-- ── FUNCION: siguiente número de serie ───────────────────────
CREATE OR REPLACE FUNCTION fn_siguiente_numero_serie(p_serie_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    v_prefijo  VARCHAR;
    v_contador INTEGER;
    v_numero   VARCHAR;
BEGIN
    UPDATE series_pedido
       SET contador = contador + 1
     WHERE id = p_serie_id
    RETURNING prefijo, contador INTO v_prefijo, v_contador;

    v_numero := v_prefijo || '-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(v_contador::TEXT, 4, '0');
    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- ── TRIGGER: updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entidades_upd   BEFORE UPDATE ON entidades   FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_referencias_upd BEFORE UPDATE ON referencias FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_pedidos_upd     BEFORE UPDATE ON pedidos     FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
CREATE TRIGGER trg_facturas_upd    BEFORE UPDATE ON facturas    FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- ── DATOS INICIALES ───────────────────────────────────────────
INSERT INTO configuracion (id, nombre_comercial, email)
VALUES (1, 'Exclusivas Villanueva', '');

INSERT INTO series_pedido (nombre, prefijo, descripcion) VALUES
  ('Serie A - Bodega factura', 'A', 'Sirve bodega, factura bodega'),
  ('Serie B - Comercial sirve', 'B', 'Sirve comercial, factura bodega'),
  ('Serie C - Venta propia', 'C', 'Compra y vende el comercial');
