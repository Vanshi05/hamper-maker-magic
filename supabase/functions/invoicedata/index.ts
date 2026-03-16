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
    const url = new URL(req.url);
    const invoiceNumber = url.searchParams.get("invoiceNumber");

    if (!invoiceNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "invoiceNumber is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseId = Deno.env.get("AIRTABLE_SALE_BASE_ID");
    const apiKey = Deno.env.get("AIRTABLE_SALE_TOKEN");

    if (!baseId || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Airtable Sale configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Sale record by Sr No
    const saleTableName = encodeURIComponent("Sale");
    const saleFormula = encodeURIComponent(`{Sr No}="${invoiceNumber}"`);
    const saleUrl = `https://api.airtable.com/v0/${baseId}/${saleTableName}?filterByFormula=${saleFormula}&maxRecords=1`;

    console.log("Fetching invoice:", invoiceNumber);
    console.log("Using baseId:", baseId?.substring(0, 8) + "...");

    const saleResponse = await fetch(saleUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!saleResponse.ok) {
      const errorText = await saleResponse.text();
      console.error("Sale fetch error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const saleData = await saleResponse.json();

    if (!saleData.records || saleData.records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const saleRecord = saleData.records[0];
    const saleFields = saleRecord.fields;
    const saleRecordId = saleRecord.id;

    // Debug: log all field names and relevant values
    console.log("Sale field names:", Object.keys(saleFields));
    console.log("Billing Address fields:", JSON.stringify({
      "Billing Address": saleFields["Billing Address"],
      "billing_address": saleFields["billing_address"],
      "SPOC Details": saleFields["SPOC Details"],
      "spoc_details": saleFields["spoc_details"],
      "Contact Person": saleFields["Contact Person"],
      "contact_person": saleFields["contact_person"],
      "Mobile": saleFields["Mobile"],
      "mobile": saleFields["mobile"],
      "Phone": saleFields["Phone"],
      "Email": saleFields["Email"],
      "email": saleFields["email"],
    }));

    // Use so_id display value (e.g. 'RSM | 2526-0088') to link to Sale_LI
    const soId = saleFields.so_id || saleFields["so_id"] || "";
    if (!soId) {
      console.warn("Warning: so_id not found in Sale record for Sr No:", invoiceNumber);
    }

    // Fetch Sale_LI (line items) linked via so_id display value
    const liTableName = encodeURIComponent("Sale_LI");
    const liFormula = encodeURIComponent(`FIND("${soId}", ARRAYJOIN({so}))`);
    const liUrl = `https://api.airtable.com/v0/${baseId}/${liTableName}?filterByFormula=${liFormula}`;

    const liResponse = await fetch(liUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!liResponse.ok) {
      const errorText = await liResponse.text();
      console.error("Line items fetch error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const liData = await liResponse.json();
    const lineItems = (liData.records || []).map((record: any) => {
      // Use fancy_config from Sale_LI (lookup from Gift Hamper table), fallback to gh_config
      const fancyConfigRaw = record.fields.fancy_config || record.fields["fancy_config"] || "";
      const ghConfigRaw = record.fields.gh_config || record.fields["gh_config"] || "";
      const configRaw = fancyConfigRaw || ghConfigRaw;
      const ghConfig = Array.isArray(configRaw) ? configRaw.join("\n") : (configRaw || "");
      
      return {
        id: record.id,
        gift_hamper_name: record.fields.gift_hamper_name || record.fields["Gift Hamper Name"] || "",
        mrp: record.fields.mrp || record.fields["MRP (Selling Price)"] || 0,
        pre_tax_price: record.fields.pre_tax_price || record.fields["Pre GST Price"] || 0,
        qty_sold: record.fields.qty_sold || record.fields["Qty"] || 1,
        gst: record.fields.gst || record.fields["GST"] || 0,
        gh_config: ghConfig,
      };
    });

    // If any line items still have empty gh_config, try fetching fancy_config from Gift Hamper table (separate base)
    const itemsMissingConfig = lineItems.filter((item: any) => !item.gh_config && item.gift_hamper_name);
    
    if (itemsMissingConfig.length > 0) {
      const ghBaseId = Deno.env.get("AIRTABLE_BASE_ID");
      const ghApiKey = Deno.env.get("AIRTABLE_TOKEN");

      if (ghBaseId && ghApiKey) {
        const uniqueNames = [...new Set(itemsMissingConfig.map((item: any) => item.gift_hamper_name))];
        
        for (const hamperName of uniqueNames) {
          try {
            const ghTableName = encodeURIComponent("Gift Hamper");
            const ghFormula = encodeURIComponent(`{Gift Hamper Name}="${hamperName}"`);
            const ghUrl = `https://api.airtable.com/v0/${ghBaseId}/${ghTableName}?filterByFormula=${ghFormula}&maxRecords=1&fields%5B%5D=fancy_config&fields%5B%5D=Gift%20Hamper%20Name`;

            const ghResponse = await fetch(ghUrl, {
              headers: { Authorization: `Bearer ${ghApiKey}` },
            });

            if (ghResponse.ok) {
              const ghData = await ghResponse.json();
              if (ghData.records && ghData.records.length > 0) {
                const fancyConfig = ghData.records[0].fields.fancy_config || "";
                lineItems.forEach((item: any) => {
                  if (item.gift_hamper_name === hamperName && !item.gh_config) {
                    item.gh_config = fancyConfig;
                  }
                });
              }
            }
          } catch (e) {
            console.warn("Failed to fetch fancy_config for:", hamperName, e);
          }
        }
      }
    }

    // Calculate totals
    let taxableAmount = 0;
    let taxAmount = 0;

    lineItems.forEach((item: any) => {
      const itemTotal = (item.pre_tax_price || 0) * (item.qty_sold || 1);
      taxableAmount += itemTotal;
      taxAmount += (itemTotal * (item.gst || 0)) / 100;
    });

    const grandTotal = taxableAmount + taxAmount;

    // Billing address comes from Sale_LI "Billing Address" field - collect from line items
    let billingAddress = "";
    for (const record of (liData.records || [])) {
      const addr = record.fields["Billing Address"] || record.fields["billing_address"] || "";
      if (addr) {
        billingAddress = Array.isArray(addr) ? addr.join("\n") : addr;
        break;
      }
    }

    // SPOC Details comes from Sale record - parse contact, mobile, email
    const spocRaw = saleFields["SPOC Details"] || saleFields["spoc_details"] || saleFields["spoc_list (from Client)"] || saleFields["spoc_master_list (from Client)"] || "";
    const spocDetails = Array.isArray(spocRaw) ? spocRaw.join("\n") : (spocRaw || "");
    let contactPerson = "";
    let mobile = "";
    let email = "";

    if (spocDetails) {
      const hasLabels = /contact\s*person:/i.test(spocDetails) || /mobile:/i.test(spocDetails) || /email:/i.test(spocDetails);

      if (hasLabels) {
        // Labeled format: "Contact person: Name\nMobile: 12345\nEmail: x@y.com"
        const contactMatch = spocDetails.match(/Contact\s*person:\s*(.+?)(?=\s*(?:Mobile:|Email:|$))/is);
        if (contactMatch) contactPerson = contactMatch[1].trim();
        const mobileMatch = spocDetails.match(/Mobile:\s*([+\d][\d\s-]*)/i);
        if (mobileMatch) mobile = mobileMatch[1].trim();
        const emailMatch = spocDetails.match(/Email:\s*([^\s]+@[^\s]+)/i);
        if (emailMatch) email = emailMatch[1].trim();
      } else {
        // Simple format: "Name\nPhone\nEmail" on separate lines
        const lines = spocDetails.split(/\n/).map((l: string) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (!email && line.includes('@')) {
            email = line;
          } else if (!mobile && line.match(/^[+]?\d[\d\s-]{6,}/)) {
            mobile = line;
          } else if (!contactPerson) {
            contactPerson = line;
          }
        }
      }
    }

    console.log("Parsed SPOC:", JSON.stringify({ spocDetails, contactPerson, mobile, email, billingAddress }));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          invoice: {
            invoiceNumber: saleFields.sales_invoice_number || saleFields["Invoice Number"] || invoiceNumber,
            srNo: saleFields["Sr No"] || saleFields.sr_no || invoiceNumber,
            invoiceDate: saleFields["Invoice Date"] || saleFields.invoice_date || "",
            billingAddress: billingAddress,
            gst: saleFields["GST"] || saleFields.gst || "",
            contactPerson: contactPerson,
            mobile: mobile,
            email: email,
            recordId: saleRecordId,
          },
          items: lineItems,
          totals: {
            taxableAmount: Math.round(taxableAmount * 100) / 100,
            taxAmount: Math.round(taxAmount * 100) / 100,
            grandTotal: Math.round(grandTotal * 100) / 100,
          },
        },
      }),
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
