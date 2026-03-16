export default async function handler(req, res) {
  try {
    // Allows quickly testing both bases:
    // - /api/test-airtable            -> uses AIRTABLE_BASE_ID (+ AIRTABLE_TOKEN)
    // - /api/test-airtable?base=sale  -> uses AIRTABLE_SALE_BASE_ID (+ AIRTABLE_SALE_TOKEN)
    const base = (req.query?.base || "").toString().toLowerCase();
    const isSale = base === "sale";

    const baseId = isSale
      ? process.env.AIRTABLE_SALE_BASE_ID
      : process.env.AIRTABLE_BASE_ID;

    const apiKey = isSale
      ? (process.env.AIRTABLE_SALE_API_KEY ||
          process.env.AIRTABLE_SALE_TOKEN ||
          process.env.AIRTABLE_API_KEY ||
          process.env.AIRTABLE_TOKEN)
      : (process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN);

    if (!baseId || !apiKey) {
      return res.status(500).json({
        success: false,
        error:
          isSale
            ? "Missing Airtable env vars for Sale base. Set AIRTABLE_SALE_BASE_ID and AIRTABLE_SALE_TOKEN (or AIRTABLE_SALE_API_KEY)."
            : "Missing Airtable env vars. Set AIRTABLE_BASE_ID and AIRTABLE_TOKEN (or AIRTABLE_API_KEY)."
      });
    }

    // Use a known table per base (only for connectivity testing)
    const tableName = encodeURIComponent(isSale ? "Sale" : "Gift Hamper");

    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?maxRecords=1`;

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

    return res.status(200).json({
      success: true,
      message: "Airtable connection successful",
      recordCount: data.records.length,
      sampleRecord: data.records[0] || null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
