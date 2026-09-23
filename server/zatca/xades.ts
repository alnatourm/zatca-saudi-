import crypto from 'crypto';

export interface XadesSignatureParams {
  invoiceHashBase64: string;
  privateKeyPem: string;
  csidCertificateBase64: string;
  issueDateTime: string; // ISO 8601: YYYY-MM-DDTHH:mm:ssZ
}

export function buildCompleteXadesSignature(params: XadesSignatureParams): string {
  // 1. Calculate SHA-256 digest of the X.509 Certificate DER bytes
  const certDerBuffer = Buffer.from(params.csidCertificateBase64, 'base64');
  const certDigestBase64 = crypto.createHash('sha256').update(certDerBuffer).digest('base64');

  // 2. Build Canonical SignedProperties Block
  const signedPropertiesXml = 
    `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">` +
      `<xades:SignedSignatureProperties>` +
        `<xades:SigningTime>${params.issueDateTime}</xades:SigningTime>` +
        `<xades:SigningCertificate>` +
          `<xades:Cert>` +
            `<xades:CertDigest>` +
              `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
              `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigestBase64}</ds:DigestValue>` +
            `</xades:CertDigest>` +
            `<xades:IssuerSerial>` +
              `<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">CN=ZATCA-Pre-Production-Issuing-CA, OU=E-Invoicing, O=ZATCA, C=SA</ds:X509IssuerName>` +
              `<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">1</ds:X509SerialNumber>` +
            `</xades:Cert>` +
          `</xades:SigningCertificate>` +
        `</xades:SignedSignatureProperties>` +
      `</xades:SignedProperties>`;

  // 3. Digest of the SignedProperties block
  const signedPropertiesHashBase64 = crypto.createHash('sha256').update(signedPropertiesXml, 'utf8').digest('base64');

  // 4. Construct SignedInfo containing both references
  const signedInfoXml = 
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>` +
      `<ds:Reference Id="invoiceSignedData" URI="">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath></ds:Transform>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath></ds:Transform>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath></ds:Transform>` +
          `<ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${params.invoiceHashBase64}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignedProperties" URI="#xadesSignedProperties">` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
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
