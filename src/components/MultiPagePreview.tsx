import { forwardRef } from "react";
import { CatalogPageData } from "./CatalogForm";
import { CatalogPreview } from "./CatalogPreview";

interface MultiPagePreviewProps {
  pages: CatalogPageData[];
}

export const MultiPagePreview = forwardRef<HTMLDivElement, MultiPagePreviewProps>(
  ({ pages }, ref) => {
    return (
      <div ref={ref}>
        {pages.map((page) => (
          <div key={page.id} className="pdf-page">
            <CatalogPreview page={page} renderMode="export" />
          </div>
        ))}
      </div>
    );
  }
);

MultiPagePreview.displayName = "MultiPagePreview";
