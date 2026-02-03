const { Credential } = require('@nodecfdi/credentials');
const fs = require('fs');

class SelloService {

    sellar(comprobante, cerPath, keyPath, password) {
        try {
            const fiel = Credential.openFiles(cerPath, keyPath, password);
            const certificadoBase64 = this._obtenerCertificadoBase64(cerPath);

            const serialObj = fiel.certificate().serialNumber();
            const hex = serialObj._hexadecimal || (typeof serialObj.hex === 'function' ? serialObj.hex() : '');

            const noCertificadoHex = hex;
            const noCertificadoString = Buffer.from(hex, 'hex').toString('utf8');

            if (comprobante.noCertificado !== undefined) comprobante.noCertificado = noCertificadoHex;
            else if (comprobante.NoCertificado !== undefined) comprobante.NoCertificado = noCertificadoHex;
            else comprobante.noCertificado = noCertificadoHex;

            if (comprobante.certificado !== undefined) comprobante.certificado = certificadoBase64;
            else if (comprobante.Certificado !== undefined) comprobante.Certificado = certificadoBase64;
            else comprobante.certificado = certificadoBase64;

            const cadenaOriginal = this.generarCadenaOriginal(comprobante, noCertificadoString);

            const sello = fiel.sign(cadenaOriginal, 'sha256');
            const selloBase64 = Buffer.from(sello, 'binary').toString('base64');

            if (comprobante.sello !== undefined) comprobante.sello = selloBase64;
            else if (comprobante.Sello !== undefined) comprobante.Sello = selloBase64;
            else comprobante.sello = selloBase64;

            return {
                cadenaOriginal,
                sello: selloBase64,
                certificado: certificadoBase64,
                noCertificado: noCertificadoHex,
                noCertificadoString,
                comprobanteSellado: comprobante
            };

        } catch (error) {
            throw new Error(`Error al sellar el comprobante: ${error.message}`);
        }
    }

    _obtenerCertificadoBase64(cerPath) {
        return fs.readFileSync(cerPath).toString('base64');
    }

    generarCadenaOriginal(c, noCertificadoForChain) {
        const nodos = [];
        const get = (obj, key) => {
            if (!obj) return undefined;
            return obj[key] !== undefined ? obj[key] : obj[key.charAt(0).toLowerCase() + key.slice(1)];
        };
        const val = (v) => (v === null || v === undefined) ? '' : String(v).trim();

        // Helper para "Exento" -> "Exento", "TASA" -> "Tasa"
        const cap = (s) => {
            const str = val(s).toLowerCase();
            return str.charAt(0).toUpperCase() + str.slice(1);
        };

        // 1. DATOS GENERALES
        nodos.push("4.0");
        if (get(c, 'Serie')) nodos.push(val(get(c, 'Serie')));
        if (get(c, 'Folio')) nodos.push(val(get(c, 'Folio')));
        nodos.push(val(get(c, 'Fecha')));
        if (get(c, 'FormaPago')) nodos.push(val(get(c, 'FormaPago')));
        nodos.push(val(noCertificadoForChain));
        if (get(c, 'CondicionesDePago')) nodos.push(val(get(c, 'CondicionesDePago')));
        nodos.push(val(get(c, 'SubTotal')));
        if (get(c, 'Descuento')) nodos.push(val(get(c, 'Descuento')));
        nodos.push(val(get(c, 'Moneda')));
        if (get(c, 'TipoCambio')) nodos.push(val(get(c, 'TipoCambio')));
        nodos.push(val(get(c, 'Total')));
        nodos.push(val(get(c, 'TipoDeComprobante')));
        nodos.push(val(get(c, 'Exportacion')));
        if (get(c, 'MetodoPago')) nodos.push(val(get(c, 'MetodoPago')));
        nodos.push(val(get(c, 'LugarExpedicion')));
        if (get(c, 'Confirmacion')) nodos.push(val(get(c, 'Confirmacion')));

        // 2. INFORMACIÓN GLOBAL
        const ig = get(c, 'InformacionGlobal');
        if (ig) {
            nodos.push(val(get(ig, 'Periodicidad')));
            nodos.push(val(get(ig, 'Meses')));
            nodos.push(val(get(ig, 'Año')));
        }

        // 3. CFDI RELACIONADOS
        const rel = get(c, 'CfdiRelacionados');
        if (rel) {
            nodos.push(val(get(rel, 'TipoRelacion')));
            const list = Array.isArray(get(rel, 'CfdiRelacionado')) ? get(rel, 'CfdiRelacionado') : (get(rel, 'CfdiRelacionado') ? [get(rel, 'CfdiRelacionado')] : []);
            list.forEach(item => nodos.push(val(get(item, 'UUID'))));
        }

        // 4. EMISOR
        const emisor = get(c, 'Emisor') || {};
        nodos.push(val(get(emisor, 'Rfc')));
        nodos.push(val(get(emisor, 'Nombre')));
        nodos.push(val(get(emisor, 'RegimenFiscal')));
        if (get(emisor, 'FacAtrAdquirente')) nodos.push(val(get(emisor, 'FacAtrAdquirente')));

        // 5. RECEPTOR
        const receptor = get(c, 'Receptor') || {};
        nodos.push(val(get(receptor, 'Rfc')));
        nodos.push(val(get(receptor, 'Nombre')));
        nodos.push(val(get(receptor, 'DomicilioFiscalReceptor')));
        if (get(receptor, 'ResidenciaFiscal')) nodos.push(val(get(receptor, 'ResidenciaFiscal')));
        if (get(receptor, 'NumRegIdTrib')) nodos.push(val(get(receptor, 'NumRegIdTrib')));
        nodos.push(val(get(receptor, 'RegimenFiscalReceptor')));
        nodos.push(val(get(receptor, 'UsoCFDI')).replace('_', '')); // REGLA: S_01 -> S01

        // 6. CONCEPTOS
        const conceptosNode = get(c, 'Conceptos');
        const conceptos = Array.isArray(conceptosNode) ? conceptosNode : (get(conceptosNode, 'Concepto') || []);

        conceptos.forEach(con => {
            nodos.push(val(get(con, 'ClaveProdServ')));
            if (get(con, 'NoIdentificacion')) nodos.push(val(get(con, 'NoIdentificacion')));
            nodos.push(val(get(con, 'Cantidad')));
            nodos.push(val(get(con, 'ClaveUnidad')));
            if (get(con, 'Unidad')) nodos.push(val(get(con, 'Unidad')));
            nodos.push(val(get(con, 'Descripcion')));
            nodos.push(val(get(con, 'ValorUnitario')));
            nodos.push(val(get(con, 'Importe')));
            if (get(con, 'Descuento')) nodos.push(val(get(con, 'Descuento')));
            nodos.push(val(get(con, 'ObjetoImp')));

            const imp = get(con, 'Impuestos');
            if (imp) {
                const tras = get(imp, 'Traslados');
                if (tras) {
                    const list = Array.isArray(tras) ? tras : (get(tras, 'Traslado') || []);
                    list.forEach(t => {
                        nodos.push(val(get(t, 'Base')));
                        nodos.push(val(get(t, 'Impuesto')));
                        const tf = cap(get(t, 'TipoFactor'));
                        nodos.push(tf);
                        if (tf !== 'Exento') {
                            nodos.push(val(get(t, 'TasaOCuota')));
                            nodos.push(val(get(t, 'Importe')));
                        }
                    });
                }
                const ret = get(imp, 'Retenciones');
                if (ret) {
                    const list = Array.isArray(ret) ? ret : (get(ret, 'Retencion') || []);
                    list.forEach(r => {
                        nodos.push(val(get(r, 'Base')));
                        nodos.push(val(get(r, 'Impuesto')));
                        nodos.push(cap(get(r, 'TipoFactor')));
                        nodos.push(val(get(r, 'TasaOCuota')));
                        nodos.push(val(get(r, 'Importe')));
                    });
                }
            }
            if (get(con, 'CuentaPredial')) {
                const list = Array.isArray(get(con, 'CuentaPredial')) ? get(con, 'CuentaPredial') : [get(con, 'CuentaPredial')];
                list.forEach(p => nodos.push(val(get(p, 'Numero'))));
            }
        });

        // 7. IMPUESTOS GLOBALES
        const impG = get(c, 'Impuestos');
        if (impG) {
            const retG = get(impG, 'Retenciones');
            if (retG) {
                const rl = Array.isArray(retG) ? retG : (get(retG, 'Retencion') || []);
                rl.forEach(rg => {
                    nodos.push(val(get(rg, 'Impuesto')));
                    nodos.push(val(get(rg, 'Importe')));
                });
                nodos.push(val(get(impG, 'TotalImpuestosRetenidos')));
            }
            const trasG = get(impG, 'Traslados');
            if (trasG) {
                const tl = Array.isArray(trasG) ? trasG : (get(trasG, 'Traslado') || []);
                tl.forEach(tg => {
                    nodos.push(val(get(tg, 'Base'))); // EL CABO SUELTO: Faltaba la BASE en el global
                    nodos.push(val(get(tg, 'Impuesto')));
                    nodos.push(cap(get(tg, 'TipoFactor')));
                    nodos.push(val(get(tg, 'TasaOCuota')));
                    nodos.push(val(get(tg, 'Importe')));
                });
                nodos.push(val(get(impG, 'TotalImpuestosTrasladados')));
            }
        }

        return `||${nodos.join('|')}||`;
    }
}

module.exports = SelloService;
