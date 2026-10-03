import allCollections from '../../images_for_ShopbyCategory/all_collections.jpg';
import sarees from '../../images_for_ShopbyCategory/sarees.jpg';
import lehengas from '../../images_for_ShopbyCategory/lehengas.jpg';
import kurtis from '../../images_for_ShopbyCategory/kurtis.jpg';
import leggings from '../../images_for_ShopbyCategory/leggings.jpg';
import tops from '../../images_for_ShopbyCategory/tops.jpg';
import coOrdSets from '../../images_for_ShopbyCategory/co_ord_sets.jpg';
import dresses3Pcs from '../../images_for_ShopbyCategory/dresses_3pcs.jpg';
import frocks from '../../images_for_ShopbyCategory/frocks.jpg';
import nightDresses from '../../images_for_ShopbyCategory/night_dresses.jpg';
import bambooNightDresses from '../../images_for_ShopbyCategory/bamboo_night_dresses.jpg';

// Category copy and fallback tile photos come from the local Shop by Category image set.
export const CATEGORIES = [
  { key: 'Sarees', label: 'Sarees', singular: 'Saree', blurb: 'Classic silhouettes', img: sarees },
  { key: 'Lehengas', label: 'Lehengas', singular: 'Lehenga', blurb: 'Festive favorites', img: lehengas },
  { key: 'Kurti', label: 'Kurti', singular: 'Kurti', blurb: 'Everyday elegance', img: kurtis },
  { key: 'Leggings', label: 'Leggings', singular: 'Leggings', blurb: 'Comfort and style', img: leggings },
  { key: 'Tops', label: 'Tops', singular: 'Top', blurb: 'Minimal essentials', img: tops },
  { key: 'Co-Ord sets', label: 'Co-Ord sets', singular: 'Co-Ord set', blurb: 'Matching separates', img: coOrdSets },
  { key: 'Dresses(3-pcs)', label: 'Dresses(3-pcs)', singular: 'Dress(3-pcs)', blurb: 'Set styling', img: dresses3Pcs },
  { key: 'Frocks', label: 'Frocks', singular: 'Frock', blurb: 'Light and playful', img: frocks },
  { key: 'Night dresses', label: 'Night dresses', singular: 'Night dress', blurb: 'Soft comfort', img: nightDresses },
  {
    key: 'Bamboo night dresses',
    label: 'Bamboo night dresses',
    singular: 'Bamboo night dress',
    blurb: 'Breathable lounge',
    img: bambooNightDresses,
  },
];

export const ALL_COLLECTIONS_TILE = {
  key: 'all',
  label: 'All collections',
  blurb: 'Complete curation',
  img: allCollections,
};

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const categoryMeta = (key) => CATEGORIES.find((c) => c.key === key) || { key, label: key, singular: key, blurb: '' };

export const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const BLOUSE_PIECE_OPTIONS = ['Included (Unstitched)', 'Included (Stitched)', 'Not included'];

export const ADMIN_BASE = '/adminDivya';

// Laptop/desktop content width (phones are unaffected: every class is md: and up).
export const DESK = 'md:max-w-6xl md:mx-auto md:w-full md:px-8';

// Package defaults per category (same numbers as server/src/validators/product.js CATEGORY_DEFAULTS).
export const CATEGORY_WEIGHT_GRAMS = {
  Sarees: 700,
  Lehengas: 1500,
  Kurti: 400,
  Leggings: 250,
  Tops: 250,
  'Co-Ord sets': 500,
  'Dresses(3-pcs)': 600,
  Frocks: 400,
  'Night dresses': 350,
  'Bamboo night dresses': 350,
};
export const DEFAULT_WEIGHT_GRAMS = 500;
export const DEFAULT_DIMENSIONS_CM = { l: 30, b: 25, h: 5 };
export const weightFor = (category) => CATEGORY_WEIGHT_GRAMS[category] ?? DEFAULT_WEIGHT_GRAMS;

/** SKU the server would generate: code-label, upper case, spaces → dashes. */
export const autoSku = (code, label) =>
  code
    ? `${code}-${label}`
        .toUpperCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9-]/g, '')
        .replace(/-+/g, '-')
        .slice(0, 60)
    : '';

/** Policy pages (Phase 8): [slug, title]. */
export const POLICIES = [
  ['shipping', 'Shipping policy'],
  ['returns', 'Returns & refunds'],
  ['terms', 'Terms of use'],
  ['privacy', 'Privacy policy'],
  ['contact', 'Contact us'],
];
