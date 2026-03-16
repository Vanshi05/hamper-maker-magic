//api/invoice/data.js

export default async function handler(req, res) {
  try {
    const { invoiceNumber } = req.query;

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        error: "invoiceNumber is required"
      });
    }

    const baseId = process.env.AIRTABLE_SALE_BASE_ID;
    // Prefer a sale-specific token if provided (useful when Sale is in a different base/workspace)
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

    // Fetch Sale record by Sr No
    const saleTableName = encodeURIComponent("Sale");
    const saleFormula = encodeURIComponent(`{Sr No}="${invoiceNumber}"`);
    const saleUrl = `https://api.airtable.com/v0/${baseId}/${saleTableName}?filterByFormula=${saleFormula}&maxRecords=1`;

    const saleResponse = await fetch(saleUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!saleResponse.ok) {
      const text = await saleResponse.text();
      return res.status(500).json({ success: false, error: text });
    }

    const saleData = await saleResponse.json();

    if (!saleData.records || saleData.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found"
      });
    }

    const saleRecord = saleData.records[0];
    const saleFields = saleRecord.fields;
    const saleRecordId = saleRecord.id;
    
    // Extract so_id display value for linking to Sale_LI
    const soId = saleFields.so_id || saleFields["so_id"] || "";
    
    if (!soId) {
      console.warn("Warning: so_id not found in Sale record for invoice:", invoiceNumber);
    }

    // Fetch Sale_LI (line items) linked to this Sale via so_id
    const liTableName = encodeURIComponent("Sale_LI");
    // Use so_id display value since ARRAYJOIN on linked records returns display values
    const liFormula = encodeURIComponent(`FIND("${soId}", ARRAYJOIN({so}))`);
    const liUrl = `https://api.airtable.com/v0/${baseId}/${liTableName}?filterByFormula=${liFormula}`;

    const liResponse = await fetch(liUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!liResponse.ok) {
      const text = await liResponse.text();
      return res.status(500).json({ success: false, error: text });
    }

    const liData = await liResponse.json();
    const lineItems = (liData.records || []).map(record => ({
      id: record.id,
      gift_hamper_name: record.fields.gift_hamper_name || record.fields["Gift Hamper Name"] || "",
      mrp: record.fields.mrp || record.fields["MRP (Selling Price)"] || 0,
      pre_tax_price: record.fields.pre_tax_price || record.fields["Pre GST Price"] || 0,
      qty_sold: record.fields.qty_sold || record.fields["Qty"] || 1,
      gst: record.fields.gst || record.fields["GST"] || 0,
      gh_config: record.fields.fancy_config || record.fields.gh_config || record.fields["Gift Hamper Config"] || ""
    }));

    // Calculate totals
    let taxableAmount = 0;
    let taxAmount = 0;

    lineItems.forEach(item => {
      const itemTotal = (item.pre_tax_price || 0) * (item.qty_sold || 1);
      taxableAmount += itemTotal;
      taxAmount += (itemTotal * (item.gst || 0)) / 100;
    });

    const grandTotal = taxableAmount + taxAmount;

    // Try to get contact details from dedicated fields first, then parse from SPOC Details
    const spocDetails = saleFields["SPOC Details"] || saleFields.spoc_details || "";
    
    // Check for dedicated fields first
    let contactPerson = saleFields["Contact Person"] || saleFields["contact_person"] || saleFields["SPOC Name"] || saleFields["spoc_name"] || "";
    let mobile = saleFields["Mobile"] || saleFields["mobile"] || saleFields["Phone"] || saleFields["phone"] || saleFields["SPOC Mobile"] || saleFields["spoc_mobile"] || "";
    let email = saleFields["Email"] || saleFields["email"] || saleFields["SPOC Email"] || saleFields["spoc_email"] || "";

    // If not found in dedicated fields, parse from SPOC Details
    if (spocDetails && (!contactPerson || !mobile || !email)) {
      // Split by newlines to handle both formats
      const lines = spocDetails.split(/\n/).map(l => l.trim()).filter(Boolean);
      
      // Check if it's labeled format (has "Contact person:", "Mobile:", "Email:")
      const hasLabels = spocDetails.toLowerCase().includes("contact person:") || 
                        spocDetails.toLowerCase().includes("mobile:") || 
                        spocDetails.toLowerCase().includes("email:");
      
      if (hasLabels) {
        // Format 1: Labeled format
        if (!contactPerson) {
          const contactMatch = spocDetails.match(/Contact\s*person:\s*(.+?)(?=\s*(?:Mobile|Email|$))/is);
          if (contactMatch) {
            contactPerson = contactMatch[1].trim();
          }
        }
        if (!mobile) {
          const mobileMatch = spocDetails.match(/Mobile:\s*([+\d][\d\s-]*)/i);
          if (mobileMatch) {
            mobile = mobileMatch[1].trim();
          }
        }
        if (!email) {
          const emailMatch = spocDetails.match(/Email:\s*([^\s]+@[^\s]+)/i);
          if (emailMatch) {
            email = emailMatch[1].trim();
          }
        }
      } else {
        // Format 2: Simple format (Name, Company, Phone, Email on separate lines)
        // Find name - first line that's not a number or email
        if (!contactPerson) {
          for (const line of lines) {
            if (!line.match(/^\d/) && !line.includes('@')) {
              contactPerson = line;
              break;
            }
          }
        }
        // Find mobile - line with 10+ digit number (may start with +)
        if (!mobile) {
          for (const line of lines) {
            const phoneMatch = line.match(/([+]?\d[\d\s-]{9,})/);
            if (phoneMatch) {
              mobile = phoneMatch[1].trim();
              break;
            }
          }
        }
        // Find email - line with @ symbol
        if (!email) {
          for (const line of lines) {
            if (line.includes('@')) {
              email = line.trim();
              break;
            }
          }
        }
      }
    }

    console.log("SPOC Details parsed:", { spocDetails, contactPerson, mobile, email });

    return res.status(200).json({
      success: true,
      data: {
        invoice: {
          invoiceNumber: saleFields.sales_invoice_number || saleFields["Invoice Number"] || invoiceNumber,
          invoiceDate: saleFields["Invoice Date"] || saleFields.invoice_date || "",
          billingAddress: saleFields["Billing Address"] || saleFields.billing_address || "",
          gst: saleFields["GST"] || saleFields.gst || "",
          contactPerson: contactPerson,
          mobile: mobile,
          email: email,
          recordId: saleRecordId
        },
        items: lineItems,
        totals: {
          taxableAmount: Math.round(taxableAmount * 100) / 100,
          taxAmount: Math.round(taxAmount * 100) / 100,
          grandTotal: Math.round(grandTotal * 100) / 100
        }
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
