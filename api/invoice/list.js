//api/invoice/list.js
export default async function handler(req, res) {
  try {
    const baseId = process.env.AIRTABLE_SALE_BASE_ID;
    const apiKey =
      process.env.AIRTABLE_SALE_API_KEY ||
      process.env.AIRTABLE_SALE_TOKEN ||
      process.env.AIRTABLE_API_KEY ||
      process.env.AIRTABLE_TOKEN;

    if (!baseId || !apiKey) {
      return res.status(500).json({
        success: false,
        error:
          "Missing Airtable env vars. Set AIRTABLE_SALE_BASE_ID and AIRTABLE_SALE_TOKEN (or AIRTABLE_SALE_API_KEY). You can also use AIRTABLE_TOKEN/AIRTABLE_API_KEY if the same token has access to both bases."
      });
    }

    const tableName = encodeURIComponent("Sale");
    // Sort by Invoice Date descending, get last 20
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?maxRecords=20&sort%5B0%5D%5Bfield%5D=invoice_date&sort%5B0%5D%5Bdirection%5D=desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({
        success: false,
        error: errorText
      });
    }

    const data = await response.json();

    const invoices = (data.records || []).map(record => ({
      srNo: String(record.fields["autonum"] ?? record.fields.autonum ?? ""),
      invoiceNumber: record.fields.sales_invoice_number || record.fields["Invoice Number"] || "",
      invoiceDate: record.fields.invoice_date || record.fields["Invoice Date"] || "",
    })).filter(inv => inv.srNo);

    return res.status(200).json({
      success: true,
      data: invoices
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
