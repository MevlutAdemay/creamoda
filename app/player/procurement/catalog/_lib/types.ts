/**
 * Serializable catalog item for client components.
 * Derived from PlayerProduct + ProductTemplate + categoryL3 + first image.
 */
export type CatalogProduct = {
  id: string;
  /** Display code: internalSkuCode ?? template.code */
  code: string;
  templateCode: string;
  /** Display name: displayName ?? template.name */
  name: string;
  baseCost: number;
  shippingProfile: string;
  /** From ProductTemplate.categoryL3.manufacturingGroup */
  manufacturingGroup: string | null;
  /** First ProductImageTemplate url or null */
  imageUrl: string | null;
};

export type CatalogGroup = {
  value: string;
  label: string;
  count: number;
};
