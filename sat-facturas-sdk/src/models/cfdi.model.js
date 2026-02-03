/**
 * @typedef {Object} Traslado
 * @property {string} base - Base para el impuesto (Requerido)
 * @property {string} impuesto - Clave del impuesto (002 IVA, etc.)
 * @property {string} tipoFactor - Tasa, Cuota o Exento
 * @property {string} [tasaOCuota] - Valor de la tasa (Opcional si es Exento)
 * @property {string} [importe] - Importe calculado (Opcional si es Exento)
 */

/**
 * @typedef {Object} Retencion
 * @property {string} base - Base para la retención
 * @property {string} impuesto - Clave (001 ISR, 002 IVA)
 * @property {string} tipoFactor - Tasa o Cuota
 * @property {string} tasaOCuota - Valor de la tasa
 * @property {string} importe - Importe retenido
 */

/**
 * @typedef {Object} Concepto
 * @property {string} claveProdServ - Clave SAT (Requerido)
 * @property {string} [noIdentificacion] - SKU o ID interno (Opcional)
 * @property {string} cantidad - Cantidad con decimales (Requerido)
 * @property {string} claveUnidad - Clave SAT (E48, ACT, etc.)
 * @property {string} [unidad] - Nombre de la unidad (Opcional)
 * @property {string} descripcion - Descripción del bien/servicio (Requerido)
 * @property {string} valorUnitario - Precio unitario (Requerido)
 * @property {string} importe - Subtotal del concepto (Requerido)
 * @property {string} objetoImp - 01 (No), 02 (Sí), 03 (Sí pero no desglose)
 * @property {Array<{numero: string}>} [cuentaPredial] - Opcional (Rentas)
 * @property {Object} [impuestos] 
 * @property {Object} [impuestos.traslados]
 * @property {Traslado[]} [impuestos.traslados.traslado]
 * @property {Object} [impuestos.retenciones]
 * @property {Retencion[]} [impuestos.retenciones.retencion]
 */

/**
 * @typedef {Object} CFDI40
 * @property {Object} comprobante
 * @property {string} [comprobante.serie] - Opcional
 * @property {string} [comprobante.folio] - Opcional
 * @property {string} comprobante.fecha - Formato ISO8601 (YYYY-MM-DDTHH:mm:ss)
 * @property {string} comprobante.formaPago - Clave (01, 03, 99...)
 * @property {string} comprobante.tipoDeComprobante - I (Ingreso), E (Egreso), etc.
 * @property {string} comprobante.moneda - MXN, USD...
 * @property {string} [comprobante.tipoCambio] - Requerido si no es MXN
 * @property {string} comprobante.subTotal - Suma de importes conceptos
 * @property {string} comprobante.total - Subtotal - Descuentos - Retenciones + Traslados
 * @property {string} comprobante.metodoPago - PUE o PPD
 * @property {string} comprobante.lugarExpedicion - Código Postal
 * @property {string} comprobante.exportacion - 01 (No aplica)
 * @property {Object} [comprobante.informacionGlobal] - Solo para RFC Genérico
 * @property {string} comprobante.informacionGlobal.periodicidad
 * @property {string} comprobante.informacionGlobal.meses
 * @property {string} comprobante.informacionGlobal.año
 * @property {Object} comprobante.emisor
 * @property {string} comprobante.emisor.rfc
 * @property {string} comprobante.emisor.nombre
 * @property {string} comprobante.emisor.regimenFiscal
 * @property {Object} comprobante.receptor
 * @property {string} comprobante.receptor.rfc
 * @property {string} comprobante.receptor.nombre
 * @property {string} comprobante.receptor.domicilioFiscalReceptor - CP Receptor
 * @property {string} comprobante.receptor.regimenFiscalReceptor
 * @property {string} comprobante.receptor.usoCFDI - S01, G03, etc.
 * @property {Object} comprobante.conceptos
 * @property {Concepto[]} comprobante.conceptos.concepto
 * @property {Object} comprobante.impuestos
 * @property {string} [comprobante.impuestos.totalImpuestosRetenidos]
 * @property {string} [comprobante.impuestos.totalImpuestosTrasladados]
 */

const CFDIModel = {};

module.exports = { CFDIModel };
