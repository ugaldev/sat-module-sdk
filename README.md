# SAT Module SDK 🇲🇽

SDK completo para interactuar con los servicios del SAT (Servicio de Administración Tributaria) de México. Permite autenticación, consulta de facturas, timbrado de CFDI 4.0, y descarga de documentos fiscales.

## 📦 Estructura del Proyecto

```
sat-module-sdk/
├── index.js                 # Punto de entrada principal (SatSDK)
├── sat-session-sdk/         # Submódulo de autenticación y sesión
│   ├── index.js
│   └── src/
│       ├── services/
│       │   └── session.js   # SatSession - Login, Refresh, Info Fiscal
│       └── utils/
│           ├── auth.js
│           ├── formatter.js
│           └── validation.js
└── sat-facturas-sdk/        # Submódulo de facturación
    ├── index.js
    └── src/
        ├── services/
        │   ├── facturas.js  # SatFactura - Consulta, Timbrado, Validación
        │   ├── cfdi.js      # CfdiService - Conversión XML/JSON
        │   └── sello.js     # SelloService - Sellado con FIEL/CSD
        ├── models/
        │   └── cfdi.model.js
        └── utils/
            ├── dates.js
            ├── formatter.js
            └── validation.js
```

---

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <repo-url> sat-module-sdk

# Instalar dependencias
cd sat-module-sdk
npm install

# Instalar dependencias de submódulos
cd sat-session-sdk && npm install
cd ../sat-facturas-sdk && npm install
```

### Dependencias Principales
- `axios` - Cliente HTTP
- `@nodecfdi/credentials` - Manejo de certificados FIEL/CSD
- `fast-xml-parser` - Parsing de XML

---

## 🔧 Uso Básico

```javascript
import SatSDK from 'sat-module-sdk';

const sat = new SatSDK();

// Acceso a submódulos
sat.session   // SatSession - Autenticación
sat.facturas  // SatFactura - Facturación
sat.sello     // SelloService - Sellado Digital
sat.cfdi      // CfdiService - Conversión XML/JSON
```

---

## 📚 API Reference

### **SatSession** (`sat.session`)

Módulo de autenticación y gestión de sesión con el SAT.

#### `login(rfc, password)`
Autentica con el portal del SAT usando RFC y CIEC.

```javascript
const loginRes = await sat.session.login('XAXX010101000', 'miPassword');

if (loginRes.success) {
    console.log('Token:', loginRes.data.access_token);
    console.log('Usuario:', loginRes.userInfo.fullname);
}
```

**Retorna:**
```javascript
{
    success: boolean,
    data: {
        access_token: string,
        refresh_token: string,
        expires_in: number,
        token_type: "bearer"
    },
    userInfo: { rfc, fullname, email, ... }
}
```

---

#### `refreshToken(refreshToken)`
Renueva el token de acceso sin necesidad de re-autenticar.

```javascript
const refreshRes = await sat.session.refreshToken(loginRes.data.refresh_token);
```

---

#### `getFiscalInfo(token, rfc)`
Obtiene información fiscal detallada: certificados, eFirma, domicilio, etc.

```javascript
const info = await sat.session.getFiscalInfo(token, 'XAXX010101000');

console.log('Certificados:', info.data.certificados);
console.log('eFirma:', info.data.efirma);
console.log('Domicilio:', info.data.fiscalInfo);
```

---

#### `getCsf(token, rfc)`
Descarga la Constancia de Situación Fiscal en PDF.

```javascript
const csf = await sat.session.getCsf(token, 'XAXX010101000');
fs.writeFileSync(csf.data.fileName, csf.data.pdfBuffer);
```

---

#### `getCum(token, rfc)`
Descarga la Opinión de Cumplimiento (32-D) en PDF.

```javascript
const cum = await sat.session.getCum(token, 'XAXX010101000');
fs.writeFileSync(cum.data.fileName, cum.data.pdfBuffer);
```

---

### **SatFactura** (`sat.facturas`)

Módulo principal de facturación electrónica.

#### `login(rfc, password)`
Login específico para el servicio de facturación móvil del SAT.

```javascript
const loginRes = await sat.facturas.login('XAXX010101000', 'miPassword');
const token = loginRes.data.access_token;
```

---

#### `consultar(token, options)`
Consulta facturas emitidas o recibidas.

```javascript
const facturas = await sat.facturas.consultar(token, {
    rfc: 'XAXX010101000',
    tipo: 'emitidas',        // 'emitidas' | 'recibidas'
    fechaInicio: '2024-01-01',
    fechaFin: '2024-01-31',
    estado: 1                 // 1 = Vigentes, 0 = Canceladas
});

console.log('Facturas encontradas:', facturas.processed.length);
```

---

#### `getFacturasCompletas(token, options)`
Consulta facturas vigentes Y canceladas en una sola llamada.

```javascript
const todas = await sat.facturas.getFacturasCompletas(token, {
    rfc: 'XAXX010101000',
    tipo: 'emitidas'
});
```

---

#### `facturasDetalladas(token, options)`
Obtiene facturas con su XML completo parseado a JSON.

```javascript
const detalladas = await sat.facturas.facturasDetalladas(token, {
    rfc: 'XAXX010101000',
    tipo: 'recibidas'
});

detalladas.facturas.forEach(f => {
    console.log(f.emisor, f.total, f.conceptos);
});
```

---

#### `validarReceptor(token, receptor, rfcEmisor)`
Valida que los datos del receptor coincidan con el SAT antes de facturar.

```javascript
const validacion = await sat.facturas.validarReceptor(token, {
    rfc: 'ZAUC00020xxxx',
    nombre: 'CARLOS IRAN ZAMORA UGALDE',
    codigoPostal: '00000',
    regimenFiscal: '605',
    usoCFDI: 'S01'
}, 'PERA6608xxxxxx');

if (validacion.data === 'OK') {
    console.log('✅ Receptor válido');
} else {
    console.log('❌ NO_COINCIDE_INFO_RECEPTOR');
}
```

---

#### `eliminarReceptorFavorito(token, receptor, rfcEmisor)`
Elimina un cliente de la lista de favoritos del SAT.

```javascript
await sat.facturas.eliminarReceptorFavorito(token, receptorData, 'PERA660800000');
```

---

#### `validarLocal(comprobante)`
Validación local de estructura CFDI sin conexión al SAT.

```javascript
const errores = sat.facturas.validarLocal(miComprobante);
if (!errores.valido) {
    console.log('Errores:', errores.errores);
}
```

---

#### `validarFactura(token, comprobante)`
Valida el comprobante contra los servidores del SAT.

```javascript
const validacion = await sat.facturas.validarFactura(token, comprobante);
```

---

#### `timbrar(token, comprobanteSellado, rfc)`
Timbra un CFDI ya sellado y obtiene el UUID oficial.

```javascript
const resultado = await sat.facturas.timbrar(token, sellado.comprobanteSellado, 'XAXX010101000');

if (resultado.success) {
    console.log('UUID:', resultado.data.comprobante.timbreFiscalDigital.uuid);
}
```

---

#### `getXml(token, options)` / `getPdf(token, options)`
Descarga el XML o PDF de una factura existente.

```javascript
const xml = await sat.facturas.getXml(token, {
    rfcEmisor: 'XAXX010101000',
    uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
    blobpath: factura.blobpath
});
```

---

#### `myFacturaInfo(token, rfc)`
Obtiene el perfil de facturación: códigos postales, permisos y alertas.

```javascript
const perfil = await sat.facturas.myFacturaInfo(token, 'XAXX010101000');
console.log('Puede Facturar:', perfil.data.puedeFacturar);
console.log('CPs registrados:', perfil.data.codigosPostales);
```

---

### **SelloService** (`sat.sello`)

Servicio de sellado digital usando FIEL o CSD.

#### `sellar(comprobante, cerPath, keyPath, password)`
Genera la Cadena Original, firma digital y devuelve el comprobante sellado.

```javascript
const sellado = sat.sello.sellar(
    comprobante,
    './certificado.cer',
    './llave.key',
    'miPasswordFIEL'
);

console.log('Cadena Original:', sellado.cadenaOriginal);
console.log('Sello:', sellado.sello);
console.log('No. Certificado:', sellado.noCertificado);
```

**Retorna:**
```javascript
{
    cadenaOriginal: string,
    sello: string,              // Base64
    certificado: string,        // Base64
    noCertificado: string,
    comprobanteSellado: Object  // Listo para timbrar
}
```

---

### **CfdiService** (`sat.cfdi`)

Servicio de conversión entre formatos XML y JSON.

#### `xmlToJson(xmlString, blobpath, estado)`
Convierte un XML de CFDI a objeto JSON limpio.

```javascript
const json = sat.cfdi.xmlToJson(xmlString);
console.log(json.emisor, json.receptor, json.conceptos);
```

---

#### `jsonToXml(comprobanteSellado)`
Genera XML válido a partir de un comprobante JSON sellado.

```javascript
const xml = sat.cfdi.jsonToXml(sellado.comprobanteSellado);
fs.writeFileSync('factura.xml', xml);
```

---

## 🔐 Autenticación y Tokens

El SAT usa OAuth 2.0. Los tokens tienen una duración de ~24 horas.

```javascript
// Login inicial
const login = await sat.facturas.login(rfc, password);
const token = login.data.access_token;
const refresh = login.data.refresh_token;

// Refrescar cuando expire (sin pedir password de nuevo)
const newLogin = await sat.facturas.refreshToken(token, refresh);
```

---

## 🧾 Flujo Completo de Timbrado

```javascript
import SatSDK from 'sat-module-sdk';

const sat = new SatSDK();

async function timbrarFactura() {
    // 1. Login
    const login = await sat.facturas.login('MIRF000101ABC', 'miCIEC');
    const token = login.data.access_token;

    // 2. Preparar comprobante
    const comprobante = {
        fecha: '2024-01-15T10:30:00',
        tipoDeComprobante: 'I',
        lugarExpedicion: '06600',
        emisor: { rfc: 'MIRF000101ABC', nombre: 'MI EMPRESA', regimenFiscal: '601' },
        receptor: { rfc: 'XAXX010101000', nombre: 'PUBLICO GENERAL', ... },
        conceptos: { concepto: [{ ... }] },
        subTotal: '100.00',
        total: '116.00',
        // ...
    };

    // 3. Validar localmente
    const errores = sat.facturas.validarLocal(comprobante);
    if (!errores.valido) throw new Error(errores.errores.join(', '));

    // 4. Sellar con FIEL
    const sellado = sat.sello.sellar(comprobante, './cert.cer', './key.key', 'passwordFIEL');

    // 5. Timbrar
    const resultado = await sat.facturas.timbrar(token, sellado.comprobanteSellado, 'MIRF000101ABC');

    console.log('✅ Factura timbrada:', resultado.data.comprobante.timbreFiscalDigital.uuid);
}
```

---

## 📋 Códigos de Error Comunes

| Código | Mensaje | Solución |
|--------|---------|----------|
| `invalid_grant` | Credenciales incorrectas | Verificar RFC y CIEC |
| `NO_COINCIDE_INFO_RECEPTOR` | Datos del receptor no coinciden | Verificar RFC, Nombre y CP del cliente |
| `403 Forbidden` | Token expirado | Usar `refreshToken()` o re-autenticar |
| `400 Bad Request` | Estructura de CFDI inválida | Revisar con `validarLocal()` |

---

## 🛡️ Seguridad

- **Nunca** guardes contraseñas en código fuente.
- Usa variables de entorno para credenciales.
- Los archivos `.cer` y `.key` deben estar protegidos.
- Implementa rotación de tokens en producción.

```javascript
const rfc = process.env.SAT_RFC;
const password = process.env.SAT_PASSWORD;
```

---

## 📄 Licencia

MIT License - Carlos Irán Zamora Ugalde

---

## 🤝 Contribuciones

Pull requests son bienvenidos. Para cambios mayores, abre un issue primero.

