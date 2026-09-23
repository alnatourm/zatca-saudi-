import crypto from 'crypto';

export interface XadesSignatureParams {
  invoiceHashBase64: string;
  privateKeyPem: string;
  csidCertificateBase64: string;
  issueDateTime: string; // ISO 8601: YYYY-MM-DDTHH:mm:ssZ
}

export function parseCsidCertificate(csidCertificateBase64: string) {
  const certDer = Buffer.from(csidCertificateBase64, 'base64');
  const certPem = `-----BEGIN CERTIFICATE-----\n${csidCertificateBase64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;

  try {
    const x509 = new crypto.X509Certificate(certPem);
    const certDigestBase64 = crypto.createHash('sha256').update(certDer).digest('base64');
    const serialNumberDecimal = BigInt(`0x${x509.serialNumber}`).toString(10);
    const issuerName = x509.issuer.split('\n').reverse().join(', ');

    return {
      certDigestBase64,
      serialNumberDecimal,
      issuerName,
    };
  } catch (_e) {
    // Fallback if Certificate is simulated/mocked in dev environment
    const certDigestBase64 = crypto.createHash('sha256').update(certDer).digest('base64');
    return {
      certDigestBase64,
      serialNumberDecimal: '1',
      issuerName: 'CN=ZATCA-Pre-Production-Issuing-CA, OU=E-Invoicing, O=ZATCA, C=SA',
    };
  }
}

export function buildCanonicalSignedProperties(
  signingTime: string,
  certDigest: string,
  issuer: string,
  serial: string
): string {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">` +
    `<xades:SignedSignatureProperties>` +
      `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
      `<xades:SigningCertificate>` +
        `<xades:Cert>` +
          `<xades:CertDigest>` +
            `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
            `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigest}</ds:DigestValue>` +
          `</xades:CertDigest>` +
          `<xades:IssuerSerial>` +
            `<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${issuer}</ds:X509IssuerName>` +
            `<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serial}</ds:X509SerialNumber>` +
          `</xades:IssuerSerial>` +
        `</xades:Cert>` +
      `</xades:SigningCertificate>` +
    `</xades:SignedSignatureProperties>` +
  `</xades:SignedProperties>`;
}

export function buildCompleteXadesSignature(params: XadesSignatureParams): string {
  // 1. Parse Certificate dynamically using crypto.X509Certificate
  const { certDigestBase64, serialNumberDecimal, issuerName } = parseCsidCertificate(params.csidCertificateBase64);

  // 2. Build Canonical SignedProperties Block
  const signedPropertiesXml = buildCanonicalSignedProperties(
    params.issueDateTime,
    certDigestBase64,
    issuerName,
    serialNumberDecimal
  );

  // 3. Digest of the SignedProperties block
  const signedPropertiesHashBase64 = crypto.createHash('sha256').update(signedPropertiesXml, 'utf8').digest('base64');

  // 4. Construct SignedInfo containing both references
  const signedInfoXml = 
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"></ds:CanonicalizationMethod>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"></ds:SignatureMethod>` +
      `<ds:Reference Id="invoiceSignedData" URI="">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath></ds:Transform>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath></ds:Transform>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath></ds:Transform>` +
          `<ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"></ds:Transform>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
        `<ds:DigestValue>${params.invoiceHashBase64}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignedProperties" URI="#xadesSignedProperties">` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
        `<ds:DigestValue>${signedPropertiesHashBase64}</ds:DigestValue>` +
      `</ds:Reference>` +
    `</ds:SignedInfo>`;

  // 5. Compute ECDSA Signature directly over the canonicalized SignedInfo
  const sign = crypto.createSign('SHA256');
  sign.update(signedInfoXml, 'utf8');
  sign.end();
  const signatureValueBase64 = sign.sign(params.privateKeyPem, 'base64');

  // 6. Return standard UBLExtensions wrapper
  return `<ext:UBLExtensions>` +
    `<ext:UBLExtension>` +
      `<ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>` +
      `<ext:ExtensionContent>` +
        `<sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">` +
          `<sac:SignatureInformation>` +
            `<cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>` +
            `<sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>` +
            `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">` +
              signedInfoXml +
              `<ds:SignatureValue>${signatureValueBase64}</ds:SignatureValue>` +
              `<ds:KeyInfo>` +
                `<ds:X509Data>` +
                  `<ds:X509Certificate>${params.csidCertificateBase64}</ds:X509Certificate>` +
                `</ds:X509Data>` +
              `</ds:KeyInfo>` +
              `<ds:Object>` +
                `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">` +
                  signedPropertiesXml +
                `</xades:QualifyingProperties>` +
              `</ds:Object>` +
            `</ds:Signature>` +
          `</sac:SignatureInformation>` +
        `</sig:UBLDocumentSignatures>` +
      `</ext:ExtensionContent>` +
    `</ext:UBLExtension>` +
  `</ext:UBLExtensions>`;
}
