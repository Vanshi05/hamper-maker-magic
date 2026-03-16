import { forwardRef } from "react";
import { CatalogPageData } from "./CatalogForm";

interface CatalogPreviewProps {
  page: CatalogPageData;
  renderMode?: "live" | "export";
}

export const CatalogPreview = forwardRef<HTMLDivElement, CatalogPreviewProps>(
  ({ page, renderMode = "live" }, ref) => {
    // Full Image Page - just the image covering the entire page
    if (page.type === "full-image") {
      return (
        <div
          ref={ref}
          className="catalog-page bg-white overflow-hidden"
          style={{ fontFamily: "'Asap', sans-serif" }}
        >
          {page.image ? (
            <img
              src={page.image}
              alt="Full page"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/10 to-accent/5">
              <div className="text-center text-muted-foreground/50">
                <div className="w-32 h-20 mx-auto mb-4 border-2 border-dashed border-accent/30 rounded-lg flex items-center justify-center">
                  <span className="text-4xl">🖼️</span>
                </div>
                <p className="text-sm">Upload full page image</p>
                <p className="text-xs text-muted-foreground/40 mt-1">1200×630px recommended</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Format price with Indian Rupee symbol
    const formatPrice = (price?: number) => {
      if (!price) return null;
      return `₹${price.toLocaleString('en-IN')}`;
    };

    const salePrice = page.preTaxPrice;
    const originalPrice = salePrice ? Math.round(salePrice * 1.33) : null; // ~25% markup for strikethrough
    const mrpStrikeTop = renderMode === "export" ? "0.90em" : "0.54em";
    return (
      <div
        ref={ref}
        className="catalog-page overflow-hidden flex"
        style={{ fontFamily: "'Asap', sans-serif", backgroundColor: '#ede2d6' }}
      >
        {/* Left - Image Section (65% width to match template) */}
        <div className="w-[65%] h-full relative" style={{ backgroundColor: '#ede2d6' }}>
          {page.image ? (
            <img
              src={page.image}
              alt="Hamper"
              className="w-full h-full object-cover"
              style={{ display: 'block' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#ede2d6' }}>
              <div className="text-center text-muted-foreground/50">
                <div className="w-24 h-24 mx-auto mb-4 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
                  <span className="text-4xl">📦</span>
                </div>
                <p className="text-sm">Upload hamper photo</p>
              </div>
            </div>
          )}
        </div>

        {/* Right - Beige background with overlapping white card */}
        <div 
          className="w-[35%] h-full relative"
          style={{ backgroundColor: '#ede2d6' }}
        >
          {/* White content card - overlaps image */}
          <div 
            className="absolute top-6 bottom-6 right-4 bg-white flex flex-col px-6 py-6"
            style={{ 
              left: '-30px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}
          >
            {/* Title */}
            <h1 
              className="text-[18px] font-bold mb-3 leading-tight"
              style={{ 
                color: '#7a6451',
                fontFamily: "'Asap', sans-serif"
              }}
            >
              {page.title || "Hamper Title"}
            </h1>

            {/* Description as bullet points */}
            <div className="flex-1 space-y-2 overflow-hidden" style={{ paddingLeft: '4px' }}>
              {page.description ? (
                page.description.split('\n').filter((line: string) => line.trim()).map((line: string, index: number) => (
                  <div 
                    key={index} 
                    className="text-[10px] flex"
                    style={{ 
                      color: '#7a6451',
                      fontFamily: "'Asap', sans-serif",
                      lineHeight: '1.5',
                    }}
                  >
                    <span style={{ marginRight: '6px', flexShrink: 0 }}>•</span>
                    <span>{line.trim()}</span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-muted-foreground/50 italic">
                  Add description to your hamper...
                </div>
              )}
            </div>

            {/* Footer Section */}
            <div className="mt-auto pt-3 space-y-2 border-t border-gray-200">
              {/* Eco Stats */}
              <p 
                className="text-[10px] italic pt-2"
                style={{ color: '#2D6A4F', fontFamily: "'Asap', sans-serif" }}
              >
                {page.plasticPercent || "80"}% less plastic pollution | {page.carbonPercent || "71"}% less carbon emissions
              </p>

              {/* Pricing */}
              <div className="flex items-baseline gap-2 flex-wrap">
                {originalPrice && (
                  <span 
                    className="text-[10px]"
                    style={{ color: '#7a6451', fontFamily: "'Asap', sans-serif" }}
                  >
                    MRP{' '}
                      <span
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          lineHeight: 1,
                          verticalAlign: 'baseline',
                        }}
                      >
                        <span style={{ display: 'inline-block' }}>
                          {originalPrice.toLocaleString('en-IN')}
                        </span>
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: mrpStrikeTop,
                            height: '1px',
                            backgroundColor: '#7a6451',
                            pointerEvents: 'none',
                          }}
                        />
                      </span>
                  </span>
                )}
                <span 
                  className="text-[10px] font-bold"
                  style={{ color: '#7a6451', fontFamily: "'Asap', sans-serif" }}
                >
                  {formatPrice(salePrice) || "₹750"}
                </span>
                <span 
                  className="text-[10px]"
                  style={{ color: '#7a6451', fontFamily: "'Asap', sans-serif" }}
                >
                  Bulk pricing | Tax & shipping extra
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CatalogPreview.displayName = "CatalogPreview";
