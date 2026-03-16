//api/get-gift-hamper.js
export default async function handler(req, res) {
  try {
    const { gh_id } = req.query;

    if (!gh_id) {
      return res.status(400).json({
        success: false,
        error: "gh_id is required"
      });
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;

    if (!baseId || !apiKey) {
      return res.status(500).json({
        success: false,
        error:
          "Missing Airtable env vars. Set AIRTABLE_BASE_ID and AIRTABLE_TOKEN (or AIRTABLE_API_KEY)."
      });
    }
    const tableName = encodeURIComponent("Gift Hamper");

    const formula = encodeURIComponent(`{gh_id}="${gh_id}"`);
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula=${formula}&maxRecords=1`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ success: false, error: text });
    }

    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Gift Hamper not found"
      });
    }

    const record = data.records[0].fields;

    // Attachment field handling
    const image =
      record.Image && record.Image.length > 0
        ? record.Image[0].url
        : null;

    return res.status(200).json({
      success: true,
      data: {
        gh_id,
        name: record["Gift Hamper Name"] || "",
        image,
        gh_bom: record.gh_bom || "",
        pre_tax_sale_price_without_shipping:
          record.pre_tax_sale_price_without_shipping || 0
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
