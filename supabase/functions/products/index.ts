import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseId = Deno.env.get("AIRTABLE_BASE_ID");
    const apiKey = Deno.env.get("AIRTABLE_TOKEN");

    if (!baseId || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Airtable configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tableName = encodeURIComponent("Product");
    // Fetch all products with pagination
    let allRecords: any[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams();
      if (offset) params.set("offset", offset);
      // Request specific fields to minimize payload
      const fields = [
        "p_id", "fancy_name", "category", "product_type", "product_tier",
        "pre_tax_db", "unsold_after_receivables", "image"
      ];
      fields.forEach(f => params.append("fields[]", f));

      const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?${params.toString()}`;

      const response = await fetch(airtableUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Airtable error:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
    } while (offset);

    // Map to clean product objects
    const products = allRecords.map((record: any) => {
      const f = record.fields;
      const img = f.image && Array.isArray(f.image) && f.image.length > 0
        ? f.image[0].url
        : null;
      return {
        p_id: f.p_id || "",
        fancy_name: f.fancy_name || "",
        category: f.category || "",
        product_type: f.product_type || "",
        product_tier: f.product_tier || "",
        pre_tax_db: Number(f.pre_tax_db) || 0,
        unsold_after_receivables: Number(f.unsold_after_receivables) || 0,
        image: img,
      };
    });

    console.log(`Fetched ${products.length} products from Airtable`);

    return new Response(
      JSON.stringify({ success: true, data: products }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
