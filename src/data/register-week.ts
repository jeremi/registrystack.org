// One record over one working week: the figure every register family page
// and the home page tell. Four steps, each naming the product that does the
// work and showing the thing that exists at the end of it. The cards are the
// site's civic-print figures, never screens: the screens come from the
// office's own application.
import { products, companionServices } from './products';

export type WeekCard =
  | { kind: 'record'; recordType: string; recordId: string; icon?: 'person' | 'household' | 'business' | 'data'; fields: Array<{ label: string; value: string }> }
  | { kind: 'history'; items: Array<{ state: string; note: string }> }
  | { kind: 'answer'; fieldLabel: string; value: string; recipient: string; issuer: string }
  | { kind: 'document'; documentType?: string; format?: string; title: string; fields: Array<{ label: string; value: string }>; footnote?: string; hash?: string }
  | { kind: 'notice'; channel: 'Email' | 'SMS'; to: string; subject: string; status: string }
  | { kind: 'booking'; service: string; place: string; slot: string; status: string };

export interface WeekStep {
  when: string;
  product: string;
  // The product page, or the docs overview for a companion service.
  productHref?: string;
  title: string;
  text: string;
  card: WeekCard;
}

// The product a step names, with the page a reader can follow to it: a product
// page on this site, or the docs overview for a companion service.
export const weekProduct = (key: (typeof products)[number]['key'] | (typeof companionServices)[number]['key']): Pick<WeekStep, 'product' | 'productHref'> => {
  const entry = [...products, ...companionServices].find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`Unknown product ${key}`);
  return { product: entry.name, productHref: entry.href };
};
