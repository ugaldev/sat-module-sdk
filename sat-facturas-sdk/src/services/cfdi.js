const { JsonConverter } = require('@nodecfdi/cfdi-to-json');
const { install } = require('@nodecfdi/cfdiutils-common');
const { DOMImplementation, XMLSerializer, DOMParser } = require('@xmldom/xmldom');

// Registrar DOM para que funcione en Node.js
install(new DOMParser(), new XMLSerializer(), new DOMImplementation());

class CfdiService {
    xmlToJson(xmlContent, blobPath, estado) {
        try {
            const rawJson = JsonConverter.convertToRecord(xmlContent);

            // 1. Extraer identificadores básicos
            const uuid = rawJson.Complemento?.TimbreFiscalDigital?.UUID || '';
            const fecha = rawJson.Fecha || '';
            const tipoComprobante = rawJson.TipoDeComprobante || '';
            const serie = rawJson.Serie || '';
            const folio = rawJson.Folio || '';

            // 2. Formatear Emisor
            const emisor = {
                Rfc: rawJson.Emisor?.Rfc || '',
                Nombre: rawJson.Emisor?.Nombre || ''
            };

            // 3. Formatear Receptor
            const receptor = {
                Rfc: rawJson.Receptor?.Rfc || '',
                Nombre: rawJson.Receptor?.Nombre || '',
                UsoCFDI: rawJson.Receptor?.UsoCFDI || ''
            };

            // 4. Formatear Conceptos (Estandarizar a Array)
            let conceptosRaw = rawJson.Conceptos?.Concepto || [];
            if (!Array.isArray(conceptosRaw)) {
                conceptosRaw = [conceptosRaw];
            }

            const conceptos = conceptosRaw.map(c => ({
                Cantidad: String(c.Cantidad || ''),
                ClaveProdServ: String(c.ClaveProdServ || ''),
                ClaveUnidad: String(c.ClaveUnidad || ''),
                Unidad: String(c.Unidad || ''),
                Descripcion: String(c.Descripcion || ''),
                ValorUnitario: String(c.ValorUnitario || ''),
                Importe: String(c.Importe || ''),
                ObjetoImp: String(c.ObjetoImp || '')
            }));

            // 5. Formatear Impuestos
            const impuestos = {
                TotalImpuestosTrasladados: String(rawJson.Impuestos?.TotalImpuestosTrasladados || '0.00'),
                TotalImpuestosRetenidos: String(rawJson.Impuestos?.TotalImpuestosRetenidos || '0.00')
            };

            // 6. Formatear Totales
            const totales = {
                SubTotal: String(rawJson.SubTotal || ''),
                Moneda: String(rawJson.Moneda || 'MXN'),
                Total: String(rawJson.Total || ''),
                FormaPago: String(rawJson.FormaPago || ''),
                MetodoPago: String(rawJson.MetodoPago || '')
            };

            // 7. Estructura Final Limpia
            const result = {
                UUID: uuid,
                Fecha: fecha,
                TipoDeComprobante: tipoComprobante,
                Serie: serie,
                Folio: folio,
                blobpath: blobPath,
                Estado: estado !== undefined ? Number(estado) : 1,
                Emisor: emisor,
                Receptor: receptor,
                Conceptos: conceptos,
                Impuestos: impuestos,
                Totales: totales,
                global: !!rawJson.InformacionGlobal
            };

            return result;
        } catch (error) {
            console.error('Error transformando XML a JSON:', error.message);
            throw new Error('Error al procesar el XML de la factura: ' + error.message);
        }
    }

    /**
     * Convierte un JSON sellado a XML de CFDI 4.0
     * @param {Object} data - Resulado del sellado (comprobante con Sellos y Certificado)
     */
    jsonToXml(data) {
        const c = data.comprobante || data;

        const get = (obj, key) => {
            if (!obj) return undefined;
            return obj[key] !== undefined ? obj[key] : obj[key.charAt(0).toLowerCase() + key.slice(1)];
        };
        const val = (v) => (v === null || v === undefined) ? '' : String(v).trim();
        const cap = (s) => {
            const str = val(s).toLowerCase();
            return str.charAt(0).toUpperCase() + str.slice(1);
        };

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0"`;

        const addAttr = (attr, value) => {
            if (value) xml += ` ${attr}="${value.replace(/"/g, '&quot;')}"`;
        };

        addAttr('Serie', get(c, 'Serie'));
        addAttr('Folio', get(c, 'Folio'));
        addAttr('Fecha', get(c, 'Fecha'));
        addAttr('Sello', get(c, 'Sello'));
        addAttr('FormaPago', get(c, 'FormaPago'));
        addAttr('NoCertificado', get(c, 'NoCertificado'));
        addAttr('Certificado', get(c, 'Certificado'));
        addAttr('CondicionesDePago', get(c, 'CondicionesDePago'));
        addAttr('SubTotal', get(c, 'SubTotal'));
        addAttr('Descuento', get(c, 'Descuento'));
        addAttr('Moneda', get(c, 'Moneda'));
        addAttr('TipoCambio', get(c, 'TipoCambio'));
        addAttr('Total', get(c, 'Total'));
        addAttr('TipoDeComprobante', get(c, 'TipoDeComprobante'));
        addAttr('Exportacion', get(c, 'Exportacion'));
        addAttr('MetodoPago', get(c, 'MetodoPago'));
        addAttr('LugarExpedicion', get(c, 'LugarExpedicion'));
        addAttr('Confirmacion', get(c, 'Confirmacion'));

        xml += '>';

        const ig = get(c, 'InformacionGlobal');
        if (ig) {
            xml += `\n    <cfdi:InformacionGlobal Periodicidad="${get(ig, 'Periodicidad')}" Meses="${get(ig, 'Meses')}" Año="${get(ig, 'Año')}"/>`;
        }

        const em = get(c, 'Emisor');
        xml += `\n    <cfdi:Emisor Rfc="${get(em, 'Rfc')}" Nombre="${get(em, 'Nombre')}" RegimenFiscal="${get(em, 'RegimenFiscal')}"`;
        if (get(em, 'FacAtrAdquirente')) xml += ` FacAtrAdquirente="${get(em, 'FacAtrAdquirente')}"`;
        xml += '/>';

        const re = get(c, 'Receptor');
        xml += `\n    <cfdi:Receptor Rfc="${get(re, 'Rfc')}" Nombre="${get(re, 'Nombre')}" DomicilioFiscalReceptor="${get(re, 'DomicilioFiscalReceptor')}" RegimenFiscalReceptor="${get(re, 'RegimenFiscalReceptor')}" UsoCFDI="${val(get(re, 'UsoCFDI')).replace('_', '')}"`;
        if (get(re, 'ResidenciaFiscal')) xml += ` ResidenciaFiscal="${get(re, 'ResidenciaFiscal')}"`;
        if (get(re, 'NumRegIdTrib')) xml += ` NumRegIdTrib="${get(re, 'NumRegIdTrib')}"`;
        xml += '/>';

        xml += '\n    <cfdi:Conceptos>';
        const conceptosNode = get(c, 'Conceptos');
        const conceptos = Array.isArray(conceptosNode) ? conceptosNode : (get(conceptosNode, 'Concepto') || []);

        conceptos.forEach(con => {
            xml += `\n        <cfdi:Concepto ClaveProdServ="${get(con, 'ClaveProdServ')}" Cantidad="${get(con, 'Cantidad')}" ClaveUnidad="${get(con, 'ClaveUnidad')}" Descripcion="${get(con, 'Descripcion')}" ValorUnitario="${get(con, 'ValorUnitario')}" Importe="${get(con, 'Importe')}" ObjetoImp="${get(con, 'ObjetoImp')}"`;
            if (get(con, 'NoIdentificacion')) xml += ` NoIdentificacion="${get(con, 'NoIdentificacion')}"`;
            if (get(con, 'Unidad')) xml += ` Unidad="${get(con, 'Unidad')}"`;
            if (get(con, 'Descuento')) xml += ` Descuento="${get(con, 'Descuento')}"`;
            xml += '>';

            const imp = get(con, 'Impuestos');
            if (imp) {
                xml += '\n            <cfdi:Impuestos>';
                const trasNode = get(imp, 'Traslados');
                if (trasNode) {
                    xml += '\n                <cfdi:Traslados>';
                    const list = Array.isArray(trasNode) ? trasNode : (get(trasNode, 'Traslado') || []);
                    list.forEach(t => {
                        xml += `\n                    <cfdi:Traslado Base="${get(t, 'Base')}" Impuesto="${get(t, 'Impuesto')}" TipoFactor="${cap(get(t, 'TipoFactor'))}"`;
                        if (cap(get(t, 'TipoFactor')) !== 'Exento') {
                            xml += ` TasaOCuota="${get(t, 'TasaOCuota')}" Importe="${get(t, 'Importe')}"`;
                        }
                        xml += '/>';
                    });
                    xml += '\n                </cfdi:Traslados>';
                }
                const retNode = get(imp, 'Retenciones');
                if (retNode) {
                    xml += '\n                <cfdi:Retenciones>';
                    const list = Array.isArray(retNode) ? retNode : (get(retNode, 'Retencion') || []);
                    list.forEach(r => {
                        xml += `\n                    <cfdi:Retencion Base="${get(r, 'Base')}" Impuesto="${get(r, 'Impuesto')}" TipoFactor="${cap(get(r, 'TipoFactor'))}" TasaOCuota="${get(r, 'TasaOCuota')}" Importe="${get(r, 'Importe')}"/>`;
                    });
                    xml += '\n                </cfdi:Retenciones>';
                }
                xml += '\n            </cfdi:Impuestos>';
            }

            const predial = get(con, 'CuentaPredial');
            if (predial) {
                const list = Array.isArray(predial) ? predial : [predial];
                list.forEach(p => {
                    xml += `\n            <cfdi:CuentaPredial Numero="${get(p, 'Numero')}"/>`;
                });
            }

            xml += '\n        </cfdi:Concepto>';
        });
        xml += '\n    </cfdi:Conceptos>';

        const impG = get(c, 'Impuestos');
        if (impG) {
            xml += `\n    <cfdi:Impuestos`;
            if (get(impG, 'TotalImpuestosRetenidos')) xml += ` TotalImpuestosRetenidos="${get(impG, 'TotalImpuestosRetenidos')}"`;
            if (get(impG, 'TotalImpuestosTrasladados')) xml += ` TotalImpuestosTrasladados="${get(impG, 'TotalImpuestosTrasladados')}"`;
            xml += '>';

            const retG = get(impG, 'Retenciones');
            if (retG) {
                xml += '\n        <cfdi:Retenciones>';
                const rl = Array.isArray(retG) ? retG : (get(retG, 'Retencion') || []);
                rl.forEach(rg => {
                    xml += `\n            <cfdi:Retencion Impuesto="${get(rg, 'Impuesto')}" Importe="${get(rg, 'Importe')}"/>`;
                });
                xml += '\n        </cfdi:Retenciones>';
            }
            const trasG = get(impG, 'Traslados');
            if (trasG) {
                xml += '\n        <cfdi:Traslados>';
                const tl = Array.isArray(trasG) ? trasG : (get(trasG, 'Traslado') || []);
                tl.forEach(tg => {
                    xml += `\n            <cfdi:Traslado Base="${get(tg, 'Base')}" Impuesto="${get(tg, 'Impuesto')}" TipoFactor="${cap(get(tg, 'TipoFactor'))}" TasaOCuota="${get(tg, 'TasaOCuota')}" Importe="${get(tg, 'Importe')}"/>`;
                });
                xml += '\n        </cfdi:Traslados>';
            }
            xml += '\n    </cfdi:Impuestos>';
        }

        xml += '\n</cfdi:Comprobante>';
        return xml;
    }
}

module.exports = new CfdiService();
